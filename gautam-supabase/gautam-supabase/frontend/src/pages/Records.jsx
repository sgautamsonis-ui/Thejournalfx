import React, { useEffect, useMemo, useState } from "react";
import { biasApi, prefsApi, aiApi, uploadApi } from "@/lib/api";
import { toast } from "sonner";
import { X, Pencil, Save, Trash2, Upload, Clipboard, Sparkles, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { useLightbox } from "@/components/ImageLightbox";
import { compressImage } from "@/lib/imageUtils";

export default function Records() {
  const openLightbox = useLightbox();
  const [items, setItems] = useState([]);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [htfPresets, setHtfPresets] = useState([]);

  const load = () => biasApi.list().then(setItems).catch(()=>{});
  useEffect(() => { load(); prefsApi.list("htf_poi").then(l => setHtfPresets(l.map(x=>x.value))).catch(()=>{}); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (type!=="all") list = list.filter(x => x.type===type);
    if (q) { const s = q.toLowerCase(); list = list.filter(x => (x.narrative||"").toLowerCase().includes(s) || (x.direction||"").toLowerCase().includes(s) || (x.session||"").toLowerCase().includes(s)); }
    return list;
  }, [items, type, q]);

  const openRec = (b) => {
    setSel(b); // show the lightweight version instantly
    setEdit(null);
    biasApi.get(b.id).then(setSel).catch(() => {}); // then fill in images
  };
  const startEdit = () => setEdit({...sel});
  const cancelEdit = () => setEdit(null);
  const toggleP = (k, v) => setEdit(p => ({...p, [k]: (p[k]||[]).includes(v) ? p[k].filter(x=>x!==v) : [...(p[k]||[]), v]}));

  const saveEdit = async () => {
    setSaving(true);
    try { const updated = await biasApi.update(edit.id, edit); setSel(updated); setEdit(null); toast.success("Bias updated"); load(); }
    catch { toast.error("Save failed"); } finally { setSaving(false); }
  };
  const del = async () => { if (!confirm("Delete this bias record?")) return; await biasApi.delete(sel.id); toast.success("Deleted"); setSel(null); load(); };

  const [uploadingCount, setUploadingCount] = useState(0);
  const addImg = async (data) => {
    setUploadingCount(c => c + 1);
    try {
      const { url } = await uploadApi.image(data);
      setEdit(p => ({...p, images: [...(p.images||[]), url]}));
    } catch { toast.error("Image upload failed"); }
    finally { setUploadingCount(c => c - 1); }
  };
  const onFile = (e) => Array.from(e.target.files||[]).forEach(f => {
    compressImage(f).then(addImg).catch(() => { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); });
  });

  useEffect(() => {
    if (!edit) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type?.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            compressImage(f).then(addImg).catch(() => { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); });
            toast.success("Chart pasted");
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line
  }, [edit]);

  return (
    <div className="records-premium p-4 sm:p-6 max-w-[1300px] mx-auto space-y-3" data-testid="records-page">
      <div className="records-hero">
        <div><div className="records-eyebrow">Market intelligence</div><h1 className="font-display text-3xl font-bold mt-1">Bias Records</h1><p className="text-[#6D6D82] mt-1 text-sm">Every plan you’ve written, ready to review before the next session.</p></div>
        <div className="records-stats"><span><b>{items.length}</b> total</span><span><b>{items.filter(x => x.type === "weekly").length}</b> weekly</span><span><b>{items.filter(x => x.type === "daily").length}</b> daily</span></div>
      </div>

      <div className="records-toolbar tjfx-card p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]"/>
          <input value={q} onChange={e=>setQ(e.target.value)} className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" placeholder="Search narrative, direction, session..."/>
        </div>
        <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl">
          {[["all","All"],["weekly","Weekly"],["daily","Daily"]].map(([k,l]) => (
            <button key={k} onClick={()=>setType(k)} className={`px-4 h-8 text-xs rounded-lg font-medium ${type===k?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82]"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length===0 && <div className="tjfx-card p-8 text-center text-[#6D6D82]">No records match.</div>}
        {filtered.map(b => (
          <button key={b.id} onClick={()=>openRec(b)} data-testid={`record-card-${b.id}`}
            className="record-row tjfx-card w-full p-3.5 text-left tjfx-card-hover flex items-center gap-4 flex-wrap md:flex-nowrap">
            <div className="flex flex-col items-start gap-0.5 shrink-0 w-24">
              <div className="text-[11px] uppercase tracking-wide text-[#7C3AED] font-semibold">{b.type}</div>
              <div className="tjfx-mono text-sm text-[#16151F] font-semibold">{b.date}</div>
            </div>
            <div className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${b.direction==="bullish"?"bg-emerald-50 text-emerald-700":b.direction==="bearish"?"bg-red-50 text-red-700":"bg-gray-50 text-gray-600"}`}>{b.direction}</div>
            <div className="flex-1 min-w-0 text-xs text-[#6D6D82] truncate">{b.narrative || "—"}</div>
            <div className="shrink-0 flex items-center gap-4 text-[11px] text-[#6D6D82] ml-auto">
              <span>Confidence <span className="tjfx-mono font-semibold text-[#16151F]">{b.confidence}%</span></span>
              {b.images?.length>0 && <span>{b.images.length} chart{b.images.length>1?"s":""}</span>}
            </div>
          </button>
        ))}
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={()=>{setSel(null); setEdit(null);}}>
          <div onClick={e=>e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-[600px] bg-white shadow-2xl overflow-y-auto scroll-thin p-6 space-y-4 animate-in">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#7C3AED] font-semibold">{sel.type} bias</div>
                <div className="font-display text-2xl font-bold tjfx-mono">{sel.date}</div>
              </div>
              <div className="flex gap-2">
                {!edit ? (
                  <button onClick={startEdit} data-testid="record-edit-btn" className="h-9 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1"><Pencil className="w-4 h-4"/> Edit</button>
                ) : (
                  <>
                    <button onClick={cancelEdit} className="h-9 px-3 rounded-xl border border-[#E8E8F1] text-sm">Cancel</button>
                    <button onClick={saveEdit} disabled={saving} data-testid="record-save-btn" className="h-9 px-3 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-60"><Save className="w-4 h-4"/>{saving?"Saving...":"Save"}</button>
                  </>
                )}
                <button onClick={()=>{setSel(null); setEdit(null);}} className="w-9 h-9 rounded-xl hover:bg-[#F6F6FB] flex items-center justify-center"><X className="w-4 h-4"/></button>
              </div>
            </div>

            {edit ? <BiasEditForm b={edit} setB={setEdit} toggleP={toggleP} onFile={onFile} htfPresets={htfPresets} uploadingCount={uploadingCount}/> :
              <BiasView b={sel}/>
            }

            {!edit && <button onClick={del} data-testid="record-delete-btn" className="w-full h-10 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> Delete Record</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function BiasView({ b }) {
  const openLightbox = useLightbox();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-[#F6F6FB]"><div className="text-[11px] text-[#6D6D82]">Direction</div><div className={`font-semibold capitalize ${b.direction==="bullish"?"text-emerald-600":b.direction==="bearish"?"text-red-500":""}`}>{b.direction}</div></div>
        <div className="p-3 rounded-xl bg-[#F6F6FB]"><div className="text-[11px] text-[#6D6D82]">Confidence</div><div className="font-semibold tjfx-mono">{b.confidence}%</div></div>
        <div className="p-3 rounded-xl bg-[#F6F6FB]"><div className="text-[11px] text-[#6D6D82]">Session</div><div className="font-semibold">{b.session || "—"}</div></div>
      </div>
      {b.narrative && <div><div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-1">Narrative</div><div className="p-3 bg-[#F6F6FB] rounded-xl text-sm whitespace-pre-wrap">{b.narrative}</div></div>}
      {b.poi_tags?.length>0 && <div><div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">HTF POI</div><div className="flex flex-wrap gap-1.5">{b.poi_tags.map(t => <span key={t} className="chip active">{t}</span>)}</div></div>}
      {b.key_levels?.length>0 && <div><div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">Key Levels</div><div className="space-y-1">{b.key_levels.map((l,i) => <div key={i} className="flex justify-between p-2 rounded-lg bg-[#F6F6FB] text-sm"><span>{l.name}</span><span className="tjfx-mono">{l.price}</span></div>)}</div></div>}
      {b.targets?.length>0 && <div><div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">Targets</div><div className="space-y-1">{b.targets.map((t,i) => <div key={i} className="flex justify-between p-2 rounded-lg bg-emerald-50 text-sm"><span>{t.name}</span><span className="tjfx-mono">{t.price}</span></div>)}</div></div>}
      {b.notes?.length>0 && <div><div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">Notes</div><ul className="list-disc pl-5 text-sm space-y-1">{b.notes.map((n,i) => <li key={i}>{n}</li>)}</ul></div>}
      {b.ai_summary && <div className="p-4 rounded-2xl bg-gradient-to-br from-[#F3E8FF] to-white"><div className="text-[11px] text-[#7C3AED] uppercase tracking-wide font-semibold mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3"/> AI Summary</div><p className="text-sm whitespace-pre-wrap">{b.ai_summary}</p></div>}
      {b.images?.length>0 && (
        <div>
          <div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">Chart Gallery ({b.images.length})</div>
          <div className="grid grid-cols-2 gap-2">{b.images.map((s,i) => <img key={i} alt="" src={s} onClick={()=>openLightbox(b.images,i)} className="w-full rounded-lg cursor-zoom-in"/>)}</div>
        </div>
      )}
    </div>
  );
}

function BiasEditForm({ b, setB, toggleP, onFile, htfPresets, uploadingCount = 0 }) {
  const openLightbox = useLightbox();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[["bullish","Bullish",TrendingUp,"emerald"],["bearish","Bearish",TrendingDown,"red"],["neutral","Neutral",Minus,"gray"]].map(([k,l,Icon,c]) => (
          <button key={k} onClick={()=>setB({...b, direction:k})} className={`p-3 rounded-xl border-2 text-xs font-medium flex flex-col items-center gap-1 ${b.direction===k? (c==="emerald"?"bg-emerald-50 border-emerald-400 text-emerald-700":c==="red"?"bg-red-50 border-red-400 text-red-700":"bg-gray-50 border-gray-400 text-gray-700") : "border-[#E8E8F1]"}`}>
            <Icon className="w-4 h-4"/> {l}
          </button>
        ))}
      </div>
      <div>
        <div className="text-[11px] text-[#6D6D82] mb-1">Confidence <span className="tjfx-mono text-[#7C3AED] font-semibold">{b.confidence}%</span></div>
        <input type="range" min="0" max="100" value={b.confidence} onChange={e=>setB({...b, confidence:parseInt(e.target.value)})} className="w-full accent-[#7C3AED]"/>
      </div>
      <div>
        <div className="text-[11px] text-[#6D6D82] mb-1">Date</div>
        <input type="date" value={b.date} onChange={e=>setB({...b,date:e.target.value})} className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm tjfx-mono"/>
      </div>
      <div>
        <div className="text-[11px] text-[#6D6D82] mb-1">Narrative</div>
        <textarea rows={5} value={b.narrative||""} onChange={e=>setB({...b, narrative:e.target.value})} className="w-full p-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"/>
      </div>
      {htfPresets.length>0 && (
        <div>
          <div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">HTF POI</div>
          <div className="flex flex-wrap gap-1.5">{htfPresets.map(v => <button key={v} onClick={()=>toggleP("poi_tags",v)} className={`chip ${(b.poi_tags||[]).includes(v)?"active":""}`} style={{fontSize:11,padding:"3px 8px"}}>{v}</button>)}</div>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] text-[#6D6D82] uppercase tracking-wide">Chart Gallery <span className="tjfx-mono">{(b.images||[]).length}</span></div>
          <label className="text-[11px] text-[#7C3AED] font-medium cursor-pointer flex items-center gap-1"><Upload className="w-3 h-3"/> Add<input type="file" accept="image/*" multiple hidden onChange={onFile}/></label>
        </div>
        <div className="text-[10px] text-[#A1A1AA] mb-2 flex items-center gap-1"><Clipboard className="w-3 h-3"/> Ctrl+V to paste</div>
        <div className="grid grid-cols-3 gap-2">
          {(b.images||[]).map((s,i) => (
            <div key={i} className="relative group">
              <img alt="" src={s} onClick={()=>openLightbox(b.images,i)} className="w-full h-20 object-cover rounded-lg cursor-zoom-in"/>
              <button onClick={()=>setB({...b, images: b.images.filter((_,j)=>j!==i)})} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 opacity-0 group-hover:opacity-100"><X className="w-3 h-3 mx-auto text-red-500"/></button>
            </div>
          ))}
          {Array.from({length: uploadingCount}).map((_,i) => <div key={`u${i}`} className="w-full h-20 rounded-lg border-2 border-dashed border-[#7C3AED]/40 bg-[#F3E8FF]/40 flex items-center justify-center text-[10px] text-[#7C3AED] animate-pulse">Uploading...</div>)}
        </div>
      </div>
    </div>
  );
}
