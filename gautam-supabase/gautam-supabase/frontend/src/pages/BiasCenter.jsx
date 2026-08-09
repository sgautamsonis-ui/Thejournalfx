import React, { useEffect, useState } from "react";
import { biasApi, aiApi, prefsApi } from "@/lib/api";
import { Save, Sparkles, TrendingUp, TrendingDown, Minus, Trash2, Upload, Clipboard, X } from "lucide-react";
import { toast } from "sonner";

const inp = "w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 outline-none text-sm bg-white tjfx-mono";
const Field = ({ label, children }) => (
  <div>
    <label className="block text-[12px] font-medium text-[#6D6D82] mb-1.5">{label}</label>
    {children}
  </div>
);

// Same pattern as Add Trade's "HTF Points of Interest" / "Entry Confirmations":
// pick a timeframe + a type, hit Add, it becomes a removable chip below.
function PairedPresetBuilder({ title, description, timeframeLabel, typeLabel, timeframes, types, draft, onDraftChange, items, onAdd, onRemove, testid }) {
  return (
    <div className="tjfx-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          {description && <p className="text-xs text-[#6D6D82] mt-1">{description}</p>}
        </div>
        <span className="text-[11px] text-[#A1A1AA]">Manage options in Settings</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
        <Field label={timeframeLabel}>
          <select value={draft.timeframe} onChange={e=>onDraftChange({...draft,timeframe:e.target.value})} className={inp} data-testid={`${testid}-timeframe`}>
            <option value="">Select timeframe...</option>
            {timeframes.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        <Field label={typeLabel}>
          <select value={draft.type} onChange={e=>onDraftChange({...draft,type:e.target.value})} className={inp} data-testid={`${testid}-type`}>
            <option value="">Select type...</option>
            {types.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        <div className="flex items-end">
          <button type="button" onClick={onAdd} data-testid={`${testid}-add`} className="h-10 w-full sm:w-auto px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold">+ Add</button>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#F0F0F5]">
          {items.map(value => (
            <span key={value} className="chip active inline-flex items-center gap-1.5 pr-1">
              {value}
              <button type="button" onClick={()=>onRemove(value)} aria-label={`Remove ${value}`} className="w-5 h-5 rounded-full hover:bg-white/60 flex items-center justify-center"><X className="w-3 h-3"/></button>
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-[#F0F0F5] text-sm text-[#6D6D82]">No POIs added yet.</div>
      )}
    </div>
  );
}

const MAX_IMAGES = 15;

const emptyBias = (type) => ({
  type, date: new Date().toISOString().slice(0,10),
  direction: "neutral", confidence: 60, narrative: "",
  poi_tags: [], setup_tags: [], key_levels: [], targets: [], invalidation: null,
  session: "London", notes: [], images: [], ai_summary: null, ai_confidence: null,
});

function currentPeriodStart(type) {
  const d = new Date();
  if (type==="daily") return d.toISOString().slice(0,10);
  // weekly - Sunday start (Sunday to Saturday week)
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0,10);
}

function periodEndFromStart(startStr) {
  const d = new Date(startStr + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0,10);
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BiasCenter() {
  const [tab, setTab] = useState("weekly");
  const [b, setB] = useState(emptyBias("weekly"));
  const [history, setHistory] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [htfTimeframes, setHtfTimeframes] = useState([]);
  const [htfPoiTypes, setHtfPoiTypes] = useState([]);
  const [poiDraft, setPoiDraft] = useState({ timeframe: "", type: "" });
  const [sessionPresets, setSessionPresets] = useState([]);
  const [keyLevelPresets, setKeyLevelPresets] = useState([]);
  const [keyLevelDraft, setKeyLevelDraft] = useState("");

  useEffect(() => {
    prefsApi.listMany(["htf_timeframe","htf_poi_type","session"]).then(prefData => {
      setHtfTimeframes((prefData.htf_timeframe || []).map(x=>x.value));
      setHtfPoiTypes((prefData.htf_poi_type || []).map(x=>x.value));
      setSessionPresets((prefData.session || []).map(x=>x.value));
    }).catch(()=>{});
  }, []);

  // Pull the right key-level presets based on active tab
  useEffect(() => {
    const kind = tab === "weekly" ? "key_level_weekly" : "key_level_daily";
    prefsApi.list(kind).then(l => setKeyLevelPresets(l.map(x=>x.value))).catch(()=>{});
  }, [tab]);

  const load = async () => {
    const list = await biasApi.list(tab).catch(()=>[]);
    setHistory(list);
    // Auto: if latest record is for current period → edit it, else start fresh (auto-move old to Records)
    const periodStart = currentPeriodStart(tab);
    const current = list.find(x => x.date === periodStart);
    if (current) setB(current);
    else setB(emptyBias(tab));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const addPoiTag = () => {
    if (!poiDraft.timeframe || !poiDraft.type) { toast.error("Choose a timeframe and POI type"); return; }
    const value = `${poiDraft.timeframe} · ${poiDraft.type}`;
    if (b.poi_tags.includes(value)) { toast.error("This POI has already been added"); return; }
    setB(p => ({...p, poi_tags: [...p.poi_tags, value]}));
    setPoiDraft({ timeframe: "", type: "" });
  };
  const removePoiTag = (value) => setB(p => ({...p, poi_tags: p.poi_tags.filter(x=>x!==value)}));

  const save = async () => {
    try {
      if (b.id) await biasApi.update(b.id, b); else {
        const r = await biasApi.create(b); setB(r);
      }
      toast.success("Bias saved. Older bias records are in Records.");
      load();
    } catch { toast.error("Save failed"); }
  };

  const newRecord = () => {
    setB({...emptyBias(tab), date: currentPeriodStart(tab)});
    toast.info(`Started fresh ${tab} bias. Previous bias moved to Records.`);
  };

  const del = async () => {
    if (!b.id || !confirm("Delete this bias record?")) return;
    await biasApi.delete(b.id);
    toast.success("Deleted"); newRecord(); load();
  };

  const runAI = async () => {
    setAiLoading(true);
    try {
      const r = await aiApi.biasSummary(b);
      setB(p => ({...p, ai_summary: r.summary, ai_confidence: 90}));
      toast.success("AI summary generated");
    } catch { toast.error("AI failed"); } finally { setAiLoading(false); }
  };

  const addImage = (dataUrl) => setB(p => {
    if (p.images.length >= MAX_IMAGES) { toast.error(`Max ${MAX_IMAGES} images`); return p; }
    return {...p, images: [...p.images, dataUrl]};
  });
  const uploadImg = (e) => {
    Array.from(e.target.files||[]).forEach(f => {
      const r = new FileReader();
      r.onload = () => addImage(r.result);
      r.readAsDataURL(f);
    });
  };

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type?.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            const r = new FileReader();
            r.onload = () => addImage(r.result);
            r.readAsDataURL(f);
            toast.success("Chart pasted");
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line
  }, []);

  const addLevel = (name = "") => setB(p => ({...p, key_levels: [...p.key_levels, { name, price: 0 }]}));
  const addLevelFromPreset = () => {
    if (!keyLevelDraft) { toast.error("Choose a key level"); return; }
    addLevel(keyLevelDraft);
    setKeyLevelDraft("");
  };
  const addTarget = () => setB(p => ({...p, targets: [...p.targets, { name: `T${p.targets.length+1}`, price: 0 }]}));
  const addNote = () => setB(p => ({...p, notes: [...p.notes, ""]}));

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5" data-testid="bias-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Bias Center</h1>
          <p className="text-[#6D6D82] mt-1">Build your market narrative. Old bias auto-moves to <span className="text-[#7C3AED]">Records</span> when a new period starts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runAI} disabled={aiLoading} className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] hover:text-[#7C3AED] text-sm font-medium flex items-center gap-2" data-testid="ai-summary-btn">
            <Sparkles className="w-4 h-4"/> {aiLoading?"Thinking...":"AI Summary"}
          </button>
          <button onClick={newRecord} className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm font-medium" data-testid="new-bias-btn">+ New Bias</button>
          <button onClick={save} className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2" data-testid="save-bias-btn">
            <Save className="w-4 h-4"/> Save Bias
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl w-fit">
        {["weekly","daily"].map(k => (
          <button key={k} onClick={()=>setTab(k)} data-testid={`tab-${k}`}
            className={`px-4 h-9 text-sm rounded-lg font-medium capitalize ${tab===k?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82]"}`}>
            {k} Bias
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <div className="tjfx-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold">Chart Gallery <span className="text-xs text-[#6D6D82] font-normal tjfx-mono ml-1">{b.images.length}/{MAX_IMAGES}</span></h3>
              <label className="text-sm text-[#7C3AED] font-medium cursor-pointer flex items-center gap-1"><Upload className="w-4 h-4"/> Add<input type="file" multiple accept="image/*" hidden onChange={uploadImg}/></label>
            </div>
            <div className="text-[11px] text-[#6D6D82] mb-3 flex items-center gap-1"><Clipboard className="w-3 h-3"/> Press <kbd className="px-1.5 py-0.5 rounded bg-[#F3E8FF] text-[#7C3AED] text-[10px] mx-1">Ctrl+V</kbd> to paste chart screenshots directly</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {b.images.map((s,i)=><div key={i} className="relative group"><img alt="" src={s} className="w-full h-28 object-cover rounded-lg"/><button onClick={()=>setB({...b,images:b.images.filter((_,j)=>j!==i)})} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3 mx-auto text-red-500"/></button></div>)}
              {b.images.length===0 && <div className="col-span-full text-center py-8 text-sm text-[#6D6D82] border-2 border-dashed border-[#E8E8F1] rounded-xl">No chart screenshots yet. Upload or paste from clipboard.</div>}
            </div>
          </div>

          <div className="tjfx-card p-6">
            <h3 className="font-display text-lg font-bold mb-4">1. Direction & Confidence</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-[12px] text-[#6D6D82] mb-2">Market Direction</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["bullish","Bullish",TrendingUp,"emerald"],
                    ["bearish","Bearish",TrendingDown,"red"],
                    ["neutral","Neutral",Minus,"gray"],
                  ].map(([k,l,Icon,c]) => (
                    <button key={k} onClick={()=>setB({...b, direction:k})} data-testid={`dir-${k}`}
                      className={`p-4 rounded-2xl border-2 text-sm font-medium flex flex-col items-center gap-1 ${b.direction===k? (c==="emerald"?"bg-emerald-50 border-emerald-400 text-emerald-700":c==="red"?"bg-red-50 border-red-400 text-red-700":"bg-gray-50 border-gray-400 text-gray-700") : "border-[#E8E8F1]"}`}>
                      <Icon className="w-5 h-5"/> {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[#6D6D82] mb-2">Confidence: <span className="tjfx-mono font-semibold text-[#7C3AED]">{b.confidence}%</span></div>
                <input type="range" min="0" max="100" value={b.confidence} onChange={e=>setB({...b, confidence:parseInt(e.target.value)})} className="w-full accent-[#7C3AED]" data-testid="confidence-slider"/>
                <div className="flex justify-between text-[11px] text-[#6D6D82] mt-1"><span>Low</span><span>Moderate</span><span>High</span></div>
              </div>
            </div>
          </div>

          <div className="tjfx-card p-6">
            <h3 className="font-display text-lg font-bold mb-3">2. Market Narrative</h3>
            <textarea data-testid="narrative-input" value={b.narrative} onChange={e=>setB({...b,narrative:e.target.value})} rows={8} className="w-full p-4 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm leading-relaxed" placeholder="Write your market narrative..."/>
            <div className="text-[11px] text-[#A1A1AA] text-right mt-1">{b.narrative.split(/\s+/).filter(Boolean).length} words</div>
          </div>

          <PairedPresetBuilder
            title="3. HTF Confluences / POIs" description="Select a timeframe and POI type, then add it to this bias."
            timeframeLabel="HTF Timeframe" typeLabel="POI Type" timeframes={htfTimeframes} types={htfPoiTypes}
            draft={poiDraft} onDraftChange={setPoiDraft} items={b.poi_tags} onAdd={addPoiTag} onRemove={removePoiTag}
            testid="bias-htf-poi"
          />

          <div className="grid md:grid-cols-2 gap-5">
            <div className="tjfx-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-bold">Key Levels</h3>
                <button onClick={()=>addLevel("")} className="text-sm text-[#7C3AED] font-medium">+ Add custom</button>
              </div>
              {keyLevelPresets.length>0 && (
                <div className="mb-3 flex gap-2">
                  <select value={keyLevelDraft} onChange={e=>setKeyLevelDraft(e.target.value)} className={inp} data-testid="key-level-preset-select">
                    <option value="">Select key level...</option>
                    {keyLevelPresets.map(nm => <option key={nm} value={nm}>{nm}</option>)}
                  </select>
                  <button type="button" onClick={addLevelFromPreset} className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold shrink-0" data-testid="key-level-preset-add">+ Add</button>
                </div>
              )}
              <div className="space-y-2">
                {b.key_levels.map((l,i)=>(
                  <div key={i} className="flex gap-2">
                    <input placeholder="Name" value={l.name} onChange={e=>{const c=[...b.key_levels];c[i]={...c[i],name:e.target.value};setB({...b,key_levels:c});}} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm"/>
                    <input placeholder="Price" type="number" step="any" value={l.price} onChange={e=>{const c=[...b.key_levels];c[i]={...c[i],price:parseFloat(e.target.value)||0};setB({...b,key_levels:c});}} className="w-28 h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm tjfx-mono"/>
                    <button onClick={()=>setB({...b,key_levels:b.key_levels.filter((_,j)=>j!==i)})} className="w-9 h-9 rounded-lg text-[#6D6D82] hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4 mx-auto"/></button>
                  </div>
                ))}
                {b.key_levels.length===0 && <div className="text-xs text-[#A1A1AA]">Tap a quick-add chip above or click "+ Add custom"</div>}
              </div>
            </div>
            <div className="tjfx-card p-6">
              <div className="flex items-center justify-between mb-3"><h3 className="font-display text-lg font-bold">Targets</h3><button onClick={addTarget} className="text-sm text-[#7C3AED] font-medium">+ Add</button></div>
              <div className="space-y-2">
                {b.targets.map((tg,i)=>(
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"/>
                    <input placeholder="Name" value={tg.name} onChange={e=>{const c=[...b.targets];c[i]={...c[i],name:e.target.value};setB({...b,targets:c});}} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm"/>
                    <input placeholder="Price" type="number" step="any" value={tg.price} onChange={e=>{const c=[...b.targets];c[i]={...c[i],price:parseFloat(e.target.value)||0};setB({...b,targets:c});}} className="w-28 h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm tjfx-mono"/>
                    <button onClick={()=>setB({...b,targets:b.targets.filter((_,j)=>j!==i)})} className="w-9 h-9 rounded-lg text-[#6D6D82] hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4 mx-auto"/></button>
                  </div>
                ))}
                <div className="flex gap-2 items-center pt-2 border-t border-[#E8E8F1]">
                  <div className="w-2 h-2 rounded-full bg-red-500"/>
                  <div className="flex-1 text-sm text-[#6D6D82]">Invalidation Level</div>
                  <input type="number" step="any" value={b.invalidation||""} onChange={e=>setB({...b,invalidation:parseFloat(e.target.value)||null})} className="w-28 h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm tjfx-mono"/>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <div className="tjfx-card p-6" data-testid="bias-session-card" style={{display: tab==="weekly" ? "none" : "block"}}>
            <div className="text-[12px] text-[#6D6D82] mb-2">Session</div>
            <div className="grid grid-cols-2 gap-2">
              {(sessionPresets.length?sessionPresets:["Asian","London","New York","Overlap"]).map(s => <button key={s} onClick={()=>setB({...b,session:s})} className={`h-10 rounded-xl text-sm font-medium border ${b.session===s?"bg-[#F3E8FF] border-[#7C3AED] text-[#7C3AED]":"border-[#E8E8F1]"}`}>{s}</button>)}
            </div>
            <div className="mt-4 text-[12px] text-[#6D6D82] mb-2">Date <span className="text-[10px] text-[#A1A1AA]">(automatic)</span></div>
            <div className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] text-sm tjfx-mono flex items-center bg-[#F6F6FB] text-[#6D6D82]">{formatDisplayDate(b.date)}</div>
          </div>

          {tab==="weekly" && (
            <div className="tjfx-card p-6">
              <div className="text-[12px] text-[#6D6D82] mb-2">Week Starting – End <span className="text-[10px] text-[#A1A1AA]">(automatic)</span></div>
              <div className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] text-sm tjfx-mono flex items-center bg-[#F6F6FB] text-[#6D6D82]">
                {formatDisplayDate(b.date)} – {formatDisplayDate(periodEndFromStart(b.date))}
              </div>
            </div>
          )}

          {b.ai_summary && (
            <div className="tjfx-card p-6 bg-gradient-to-br from-[#F3E8FF] to-white">
              <h3 className="font-display text-lg font-bold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#7C3AED]"/> AI Summary</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{b.ai_summary}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">AI Confidence: {b.ai_confidence||90}%</div>
            </div>
          )}

          <div className="tjfx-card p-6">
            <div className="flex items-center justify-between mb-3"><h3 className="font-display text-lg font-bold">Notes & Reminders</h3><button onClick={addNote} className="text-sm text-[#7C3AED] font-medium">+ Add</button></div>
            <div className="space-y-2">
              {b.notes.map((n,i)=>(
                <div key={i} className="flex gap-2 items-center"><input value={n} onChange={e=>{const c=[...b.notes];c[i]=e.target.value;setB({...b,notes:c});}} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm" placeholder="Reminder..."/><button onClick={()=>setB({...b,notes:b.notes.filter((_,j)=>j!==i)})} className="w-9 h-9 rounded-lg text-[#6D6D82] hover:bg-red-50"><Trash2 className="w-4 h-4 mx-auto"/></button></div>
              ))}
              {b.notes.length===0 && <div className="text-sm text-[#6D6D82]">No notes yet.</div>}
            </div>
          </div>

          <div className="tjfx-card p-6">
            <h3 className="font-display text-lg font-bold mb-3">Bias Records</h3>
            <div className="space-y-2 max-h-72 overflow-auto scroll-thin">
              {history.length===0 && <div className="text-sm text-[#6D6D82]">No records yet.</div>}
              {history.map(h => (
                <button key={h.id} onClick={()=>setB(h)} className={`w-full text-left p-3 rounded-xl border ${b.id===h.id?"border-[#7C3AED] bg-[#F3E8FF]/40":"border-[#E8E8F1] hover:border-[#7C3AED]"}`} data-testid={`bias-record-${h.id}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="tjfx-mono text-[#6D6D82]">{h.date}</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${h.direction==="bullish"?"bg-emerald-50 text-emerald-700":h.direction==="bearish"?"bg-red-50 text-red-700":"bg-gray-50 text-gray-600"}`}>{h.direction}</div>
                  </div>
                  <div className="text-xs text-[#6D6D82] mt-1 line-clamp-1">{h.narrative || "—"}</div>
                </button>
              ))}
            </div>
            {b.id && <button onClick={del} className="mt-3 w-full h-9 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> Delete Record</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
