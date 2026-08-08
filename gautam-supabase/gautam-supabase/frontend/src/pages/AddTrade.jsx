import React, { useEffect, useMemo, useState } from "react";
import { tradesApi, aiApi, notebookApi, prefsApi, accountsApi } from "@/lib/api";
import { computePnl } from "@/lib/pnlCalc";
import { setPendingTrade, clearPendingTrade, notifyTradeSync } from "@/lib/pendingTrade";
import { useAccount } from "@/context/AccountContext";import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Sparkles, Save, X, Upload, Star, CheckCircle2, Circle, ClipboardList, Clipboard } from "lucide-react";

const MAX_IMAGES = 15;
const Chip = ({ label, active, onClick, testid }) => (
  <button type="button" data-testid={testid} onClick={onClick} className={`chip ${active?"active":""}`}>{label}</button>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[12px] font-medium text-[#6D6D82] mb-1.5">{label}</label>
    {children}
  </div>
);
const inp = "w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 outline-none text-sm bg-white tjfx-mono";

export default function AddTrade() {
  const nav = useNavigate();
  const { accounts, activeId, active, reload: reloadAccounts } = useAccount();
  const [t, setT] = useState({
    account_id: (activeId && activeId!=="all") ? activeId : (accounts[0]?.id || null),
    symbol: "XAUUSD", direction: "long", order_type: "Market",
    entry_price: "", exit_price: "", stop_loss: "", take_profit: "",
    lot_size: 0.1, risk_percent: 1, commission: 0, swap: 0,
    session: "London", strategy: "", status: "closed",
    date: new Date().toISOString().slice(0,10),
    htf_poi: [], entry_tags: [], setup_tags: [], mood_before: [], mood_after: [], mistakes: [], strengths: [],
    rating: 4, notes: "", screenshots: [],
  });
  const [saving, setSaving] = useState(false);
  const [aiReview, setAiReview] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [rules, setRules] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [ruleChecks, setRuleChecks] = useState({});
  const [itemChecks, setItemChecks] = useState({});

  // preferences pulled from Settings
  const [presets, setPresets] = useState({
    symbol: [], strategy: [], session: [], mood: [], mistake: [], strength: [], setup_tag: [],
    htf_poi_type: [], htf_timeframe: [], entry_confirmation_type: [], entry_timeframe: [],
  });
  const [htfDraft, setHtfDraft] = useState({ timeframe: "", type: "" });
  const [entryDraft, setEntryDraft] = useState({ timeframe: "", type: "" });

  useEffect(() => {
    notebookApi.list("rule").then(setRules).catch(()=>{});
    notebookApi.list("checklist").then(setChecklists).catch(()=>{});
    ["symbol","strategy","session","mood","mistake","strength","setup_tag","htf_poi_type","htf_timeframe","entry_confirmation_type","entry_timeframe"].forEach(k =>
      prefsApi.list(k).then(list => setPresets(p => ({...p, [k]: list.map(x=>x.value)}))).catch(()=>{})
    );
  }, []);

  // Sync default account_id whenever context changes
  useEffect(() => {
    setT(prev => ({...prev, account_id: prev.account_id || (activeId && activeId!=="all" ? activeId : (accounts[0]?.id || null))}));
  }, [activeId, accounts]);


  // set defaults once prefs load
  useEffect(() => {
    setT(prev => ({
      ...prev,
      symbol: prev.symbol || presets.symbol[0] || "XAUUSD",
      session: prev.session || presets.session[0] || "London",
      strategy: prev.strategy || presets.strategy[0] || "",
    }));
  }, [presets.symbol, presets.session, presets.strategy]);

  // Auto compute net PnL, R multiple and risk with proper broker formulas
  const computed = useMemo(() => {
    const r = computePnl({
      symbol: t.symbol, direction: t.direction,
      entry: t.entry_price, exit: t.exit_price, lot: t.lot_size,
      stop_loss: t.stop_loss, commission: t.commission, swap: t.swap,
    });
    const rMultiple = r.risk ? Math.round((r.pnl / r.risk) * 100) / 100 : 0;
    return { pnl: r.pnl, r: rMultiple, risk: r.risk, cls: r.cls, pipValue: r.pipValuePerLot };
  }, [t]);

  const toggle = (key, val) => setT(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(x=>x!==val) : [...p[key], val] }));
  const addPairedPreset = (field, draft, setDraft, label) => {
    if (!draft.timeframe || !draft.type) { toast.error(`Choose a ${label.toLowerCase()} timeframe and type`); return; }
    const value = `${draft.timeframe} · ${draft.type}`;
    if (t[field].includes(value)) { toast.error("This selection has already been added"); return; }
    setT(p => ({ ...p, [field]: [...p[field], value] }));
    setDraft({ timeframe: "", type: "" });
  };
  const removePairedPreset = (field, value) => setT(p => ({ ...p, [field]: p[field].filter(x => x !== value) }));

  const addImage = (dataUrl) => setT(p => {
    if (p.screenshots.length >= MAX_IMAGES) { toast.error(`Max ${MAX_IMAGES} images`); return p; }
    return { ...p, screenshots: [...p.screenshots, dataUrl] };
  });

  const onFile = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const r = new FileReader();
      r.onload = () => addImage(r.result);
      r.readAsDataURL(f);
    });
  };

  // paste from clipboard
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
            toast.success("Image pasted");
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line
  }, []);

  const runAI = async () => {
    setAiLoading(true);
    try {
      const r = await aiApi.tradeReview({ ...t, net_pnl: computed.pnl });
      setAiReview(r.review);
    } catch { toast.error("AI review failed"); } finally { setAiLoading(false); }
  };

  const save = async () => {
    if (!t.symbol || !t.entry_price) { toast.error("Symbol and Entry required"); return; }
    setSaving(true);
    try {
      const followedRules = rules.filter(r => ruleChecks[r.id]).map(r => r.title);
      const followedItems = [];
      checklists.forEach(cl => (cl.items||[]).forEach((it, idx) => { if (itemChecks[`${cl.id}-${idx}`]) followedItems.push(`${cl.title}: ${it.text}`); }));
      const trade = {
        ...t,
        // The client supplies the id so the optimistic row and persisted row
        // are the same item, not two visually similar rows.
        id: globalThis.crypto?.randomUUID?.() || `trade_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        entry_price: parseFloat(t.entry_price)||0,
        exit_price: t.exit_price? parseFloat(t.exit_price): null,
        stop_loss: t.stop_loss? parseFloat(t.stop_loss): null,
        take_profit: t.take_profit? parseFloat(t.take_profit): null,
        lot_size: parseFloat(t.lot_size)||0,
        risk_percent: parseFloat(t.risk_percent)||0,
        commission: parseFloat(t.commission)||0,
        swap: parseFloat(t.swap)||0,
        net_pnl: computed.pnl, r_multiple: computed.r,
        strengths: [...(t.strengths||[]), ...followedRules, ...followedItems].filter((v,i,a)=>a.indexOf(v)===i),
      };
      setPendingTrade(trade);
      // Navigate immediately. The request continues in the background and the
      // Trade View reconciles the optimistic row when it completes.
      nav("/trades");
      tradesApi.create(trade).then((saved) => {
        clearPendingTrade();
        notifyTradeSync({ trade: saved });
        reloadAccounts?.();
        toast.success("Trade saved");
      }).catch(() => {
        clearPendingTrade();
        notifyTradeSync({ error: true, id: trade.id });
        toast.error("Trade could not be saved. Please try again.");
      });
    } catch (e) { toast.error("Save failed"); setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5" data-testid="add-trade-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Add Trade</h1>
          <p className="text-[#6D6D82] mt-1">Log every detail in under 2 minutes. <span className="text-[#7C3AED]">Presets are managed in Settings.</span></p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={runAI} disabled={aiLoading} data-testid="ai-review-btn" className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] hover:text-[#7C3AED] text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4"/> {aiLoading? "Thinking...":"AI Review"}
          </button>
          <button onClick={save} disabled={saving} data-testid="save-trade-btn" className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4"/> {saving?"Saving...":"Save Trade"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Trade Details */}
          <div className="tjfx-card p-6">
            <h3 className="font-display text-lg font-bold mb-4">Trade Details</h3>
            {accounts.length>0 && (
              <div className="mb-5 p-3 rounded-2xl bg-[#F6F6FB] flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[#6D6D82]">Trading Account</div>
                  <select value={t.account_id||""} onChange={e=>setT({...t,account_id:e.target.value})} className="w-full h-9 mt-1 px-2 rounded-lg border border-[#E8E8F1] text-sm font-semibold bg-white" data-testid="account-select-trade">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.broker} · {a.account_type}</option>)}
                  </select>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-[#6D6D82]">Balance</div>
                  <div className="tjfx-mono text-lg font-bold text-[#7C3AED]">${((accounts.find(a=>a.id===t.account_id)?.balance)||0).toFixed(2)}</div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Symbol">
                <select value={t.symbol} onChange={e=>setT({...t,symbol:e.target.value})} className={inp} data-testid="symbol-select">
                  {(presets.symbol.length?presets.symbol:["XAUUSD"]).map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Direction">
                <div className="flex gap-2">
                  {["long","short"].map(d => (
                    <button key={d} type="button" onClick={()=>setT({...t,direction:d})} data-testid={`dir-${d}`}
                      className={`flex-1 h-10 rounded-xl border text-sm font-medium ${t.direction===d?(d==="long"?"bg-emerald-50 border-emerald-300 text-emerald-700":"bg-red-50 border-red-300 text-red-700"):"border-[#E8E8F1]"}`}>
                      {d==="long"?"↑ Long":"↓ Short"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Order Type">
                <select value={t.order_type} onChange={e=>setT({...t,order_type:e.target.value})} className={inp}>
                  {["Market","Limit","Stop"].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={t.status} onChange={e=>setT({...t,status:e.target.value})} className={inp} data-testid="status-select">
                  <option value="closed">Closed</option><option value="open">Open</option><option value="cancelled">Cancelled</option>
                </select>
              </Field>
              <Field label="Entry Price"><input data-testid="entry-input" value={t.entry_price} onChange={e=>setT({...t,entry_price:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Exit Price"><input value={t.exit_price} onChange={e=>setT({...t,exit_price:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Stop Loss"><input value={t.stop_loss} onChange={e=>setT({...t,stop_loss:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Take Profit"><input value={t.take_profit} onChange={e=>setT({...t,take_profit:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Lot Size"><input value={t.lot_size} onChange={e=>setT({...t,lot_size:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Risk %"><input value={t.risk_percent} onChange={e=>setT({...t,risk_percent:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Commission"><input value={t.commission} onChange={e=>setT({...t,commission:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Swap"><input value={t.swap} onChange={e=>setT({...t,swap:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Date"><input value={t.date} onChange={e=>setT({...t,date:e.target.value})} type="date" className={inp}/></Field>
              <Field label="Session">
                <select value={t.session} onChange={e=>setT({...t,session:e.target.value})} className={inp}>{(presets.session.length?presets.session:["London"]).map(s=><option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Strategy">
                <select value={t.strategy} onChange={e=>setT({...t,strategy:e.target.value})} className={inp.replace("tjfx-mono","")} data-testid="strategy-select">
                  <option value="">Select strategy...</option>
                  {presets.strategy.map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-4 p-4 rounded-2xl bg-[#F6F6FB]">
              <div><div className="text-[11px] text-[#6D6D82]">Net P&L</div><div data-testid="calc-pnl" className={`tjfx-mono text-xl font-semibold ${computed.pnl>=0?"text-emerald-600":"text-red-500"}`}>{computed.pnl>=0?"+":""}${computed.pnl}</div></div>
              <div><div className="text-[11px] text-[#6D6D82]">R Multiple</div><div data-testid="calc-r" className="tjfx-mono text-xl font-semibold">{computed.r}R</div></div>
              <div><div className="text-[11px] text-[#6D6D82]">Risk</div><div data-testid="calc-risk" className="tjfx-mono text-xl font-semibold">${computed.risk}</div></div>
              <div><div className="text-[11px] text-[#6D6D82]">Type · pip/lot</div><div className="tjfx-mono text-xs text-[#6D6D82]">{computed.cls}<br/><span className="text-[#7C3AED]">${computed.pipValue}</span></div></div>
            </div>
          </div>

          <PairedPresetBuilder
            title="HTF Points of Interest" description="Choose the higher-timeframe context, then add it to this trade."
            timeframeLabel="HTF Timeframe" typeLabel="POI Type" timeframes={presets.htf_timeframe} types={presets.htf_poi_type}
            draft={htfDraft} onDraftChange={setHtfDraft} items={t.htf_poi}
            onAdd={() => addPairedPreset("htf_poi", htfDraft, setHtfDraft, "HTF POI")} onRemove={value => removePairedPreset("htf_poi", value)}
            testid="htf-poi"
          />
          <PairedPresetBuilder
            title="Entry Confirmations" description="Record the timeframe and confirmation that triggered your entry."
            timeframeLabel="Entry Timeframe" typeLabel="Confirmation Type" timeframes={presets.entry_timeframe} types={presets.entry_confirmation_type}
            draft={entryDraft} onDraftChange={setEntryDraft} items={t.entry_tags}
            onAdd={() => addPairedPreset("entry_tags", entryDraft, setEntryDraft, "entry confirmation")} onRemove={value => removePairedPreset("entry_tags", value)}
            testid="entry-confirmation"
          />
          <div className="tjfx-card p-6">
            <h3 className="font-display text-lg font-bold mb-3">Tags</h3>
            <ChipRow label="Optional setup tags" items={presets.setup_tag} selected={t.setup_tags} onToggle={v=>toggle("setup_tags",v)}/>
          </div>

          <div className="tjfx-card p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Psychology</h3>
            <ChipRow label="Mood Before" items={presets.mood} selected={t.mood_before} onToggle={v=>toggle("mood_before",v)}/>
            <ChipRow label="Mood After" items={presets.mood} selected={t.mood_after} onToggle={v=>toggle("mood_after",v)}/>
            <ChipRow label="Mistakes" items={presets.mistake} selected={t.mistakes} onToggle={v=>toggle("mistakes",v)}/>
            <ChipRow label="Strengths" items={presets.strength} selected={t.strengths} onToggle={v=>toggle("strengths",v)}/>
            <div>
              <div className="text-[12px] text-[#6D6D82] mb-2">Rating</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={()=>setT({...t,rating:n})}><Star className={`w-6 h-6 ${n<=t.rating?"fill-[#F59E0B] text-[#F59E0B]":"text-[#E8E8F1]"}`}/></button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[#6D6D82] mb-2">Notes</div>
              <textarea value={t.notes} onChange={e=>setT({...t,notes:e.target.value})} rows={4} className="w-full p-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" placeholder="What did you learn from this trade?"/>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <div className="tjfx-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold">Screenshots</h3>
              <span className="text-xs text-[#6D6D82] tjfx-mono">{t.screenshots.length}/{MAX_IMAGES}</span>
            </div>
            <label className="block border-2 border-dashed border-[#E8E8F1] rounded-2xl p-6 text-center hover:border-[#7C3AED] transition-colors cursor-pointer">
              <Upload className="w-6 h-6 mx-auto text-[#7C3AED] mb-2"/>
              <div className="text-sm text-[#6D6D82]">Drop files, click to upload<br/>or press <kbd className="px-1.5 py-0.5 rounded bg-[#F3E8FF] text-[#7C3AED] text-xs">Ctrl+V</kbd> to paste</div>
              <input type="file" multiple accept="image/*" onChange={onFile} className="hidden" data-testid="upload-input"/>
            </label>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[#6D6D82]"><Clipboard className="w-3 h-3"/> Paste up to {MAX_IMAGES} images from clipboard</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {t.screenshots.map((s,i) => (
                <div key={i} className="relative group">
                  <img src={s} alt="" className="w-full h-24 object-cover rounded-lg"/>
                  <button onClick={()=>setT({...t,screenshots:t.screenshots.filter((_,j)=>j!==i)})} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3"/></button>
                </div>
              ))}
            </div>
          </div>

          {aiReview && (
            <div className="tjfx-card p-6 bg-gradient-to-br from-[#F3E8FF] to-white">
              <h3 className="font-display text-lg font-bold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#7C3AED]"/> AI Review</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiReview}</p>
            </div>
          )}

          {(rules.length>0 || checklists.length>0) && (
            <div className="tjfx-card p-6 space-y-4" data-testid="rules-sync-card">
              <h3 className="font-display text-lg font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#7C3AED]"/> My Rules & Checklists</h3>
              {rules.length>0 && (
                <div>
                  <div className="text-[11px] text-[#6D6D82] mb-2 uppercase tracking-wide">Rules</div>
                  <div className="space-y-1.5">
                    {rules.map(r => (
                      <button type="button" key={r.id} onClick={()=>setRuleChecks(p=>({...p,[r.id]:!p[r.id]}))}
                        className="w-full flex items-start gap-2 text-left text-sm hover:bg-[#F6F6FB] rounded-lg px-2 py-1.5">
                        {ruleChecks[r.id] ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"/> : <Circle className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5"/>}
                        <span className={ruleChecks[r.id]?"text-emerald-700":""}>{r.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {checklists.map(cl => (
                <div key={cl.id}>
                  <div className="text-[11px] text-[#6D6D82] mb-2 uppercase tracking-wide">{cl.title}</div>
                  <div className="space-y-1.5">
                    {(cl.items||[]).map((it, idx) => {
                      const k = `${cl.id}-${idx}`;
                      return (
                        <button type="button" key={idx} onClick={()=>setItemChecks(p=>({...p,[k]:!p[k]}))}
                          className="w-full flex items-start gap-2 text-left text-sm hover:bg-[#F6F6FB] rounded-lg px-2 py-1.5">
                          {itemChecks[k] ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"/> : <Circle className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5"/>}
                          <span className={itemChecks[k]?"text-emerald-700":""}>{it.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-[#A1A1AA]">Checked items are added to this trade's Strengths on save.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PairedPresetBuilder({ title, description, timeframeLabel, typeLabel, timeframes, types, draft, onDraftChange, items, onAdd, onRemove, testid }) {
  return (
    <div className="tjfx-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div><h3 className="font-display text-lg font-bold">{title}</h3><p className="text-xs text-[#6D6D82] mt-1">{description}</p></div>
        <span className="text-[11px] text-[#A1A1AA]">Manage options in Settings</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
        <Field label={timeframeLabel}><select value={draft.timeframe} onChange={e=>onDraftChange({...draft,timeframe:e.target.value})} className={inp} data-testid={`${testid}-timeframe`}><option value="">Select timeframe...</option>{timeframes.map(value => <option key={value} value={value}>{value}</option>)}</select></Field>
        <Field label={typeLabel}><select value={draft.type} onChange={e=>onDraftChange({...draft,type:e.target.value})} className={inp} data-testid={`${testid}-type`}><option value="">Select type...</option>{types.map(value => <option key={value} value={value}>{value}</option>)}</select></Field>
        <div className="flex items-end"><button type="button" onClick={onAdd} data-testid={`${testid}-add`} className="h-10 w-full sm:w-auto px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold">+ Add</button></div>
      </div>
      {items.length > 0 ? <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#F0F0F5]">{items.map(value => <span key={value} className="chip active inline-flex items-center gap-1.5 pr-1">{value}<button type="button" onClick={()=>onRemove(value)} aria-label={`Remove ${value}`} className="w-5 h-5 rounded-full hover:bg-white/60 flex items-center justify-center"><X className="w-3 h-3"/></button></span>)}</div> : <div className="mt-4 pt-4 border-t border-[#F0F0F5] text-sm text-[#6D6D82]">No selections yet. Add the combinations used for this trade.</div>}
    </div>
  );
}

function ChipBlock({ title, items, selected, onToggle }) {
  return (
    <div className="tjfx-card p-6">
      <h3 className="font-display text-lg font-bold mb-3">{title}</h3>
      {items.length===0 ? <div className="text-sm text-[#6D6D82]">No presets. Add them in Settings → Trade Presets.</div> :
        <div className="flex flex-wrap gap-2">{items.map(v => <Chip key={v} label={v} active={selected.includes(v)} onClick={()=>onToggle(v)} />)}</div>
      }
    </div>
  );
}

function ChipRow({ label, items, selected, onToggle }) {
  return (
    <div>
      <div className="text-[12px] text-[#6D6D82] mb-2">{label}</div>
      {items.length===0 ? <div className="text-xs text-[#A1A1AA]">Manage in Settings → Trade Presets</div> :
        <div className="flex flex-wrap gap-2">{items.map(v => <Chip key={v} label={v} active={selected.includes(v)} onClick={()=>onToggle(v)} />)}</div>
      }
    </div>
  );
}
