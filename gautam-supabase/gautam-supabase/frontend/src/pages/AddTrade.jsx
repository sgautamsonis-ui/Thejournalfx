import React, { useEffect, useMemo, useState } from "react";
import { tradesApi, aiApi, notebookApi, prefsApi, accountsApi, biasApi } from "@/lib/api";
import { computePnl } from "@/lib/pnlCalc";
import { setPendingTrade, clearPendingTrade, notifyTradeSync } from "@/lib/pendingTrade";
import { useAccount } from "@/context/AccountContext";import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Sparkles, Save, X, Upload, Star, CheckCircle2, Circle, ClipboardList, Clipboard } from "lucide-react";
import { AttachmentPanel, LinkedBiasCard } from "@/components/TradePanels";

const MAX_IMAGES = 15;
const BUILDER_DEFAULTS = {
  htf_timeframe: ["Monthly", "Weekly", "Daily", "4H", "1H"],
  htf_poi_type: ["Bullish OB", "Bearish OB", "Bullish FVG", "Bearish FVG", "Demand", "Supply", "Liquidity", "Breaker", "IFVG"],
  entry_timeframe: ["4H", "1H", "15M", "5M", "1M"],
  entry_confirmation_type: ["MSS", "BOS", "CHOCH", "FVG", "IFVG", "SMT", "Breaker", "Displacement", "Order Block", "Equal High", "Equal Low"],
};
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
    htf_poi_type: BUILDER_DEFAULTS.htf_poi_type, htf_timeframe: BUILDER_DEFAULTS.htf_timeframe,
    entry_confirmation_type: BUILDER_DEFAULTS.entry_confirmation_type, entry_timeframe: BUILDER_DEFAULTS.entry_timeframe,
  });
  const [htfDraft, setHtfDraft] = useState({ timeframe: "", type: "" });
  const [entryDraft, setEntryDraft] = useState({ timeframe: "", type: "" });

  useEffect(() => {
    const kinds = ["symbol","strategy","session","mood","mistake","strength","setup_tag","htf_poi_type","htf_timeframe","entry_confirmation_type","entry_timeframe"];
    const cacheKey = "tjfx-preference-cache-v1";
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.data) setPresets(p => ({ ...p, ...Object.fromEntries(Object.entries(cached.data).map(([k, v]) => [k, v.map(x => x.value)])) }));
    } catch { /* a stale cache must never block the form */ }
    Promise.all([notebookApi.list("rule"), notebookApi.list("checklist"), prefsApi.listMany(kinds)])
      .then(([ruleList, checklistList, prefData]) => {
        setRules(ruleList); setChecklists(checklistList);
        setPresets(p => ({ ...p, ...Object.fromEntries(Object.entries(prefData).map(([k, v]) => [k, v.map(x => x.value)])) }));
        try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: prefData })); } catch {}
      }).catch(()=>{});
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

  const recommendedLot = useMemo(() => {
    const balance = Number(accounts.find(a => a.id === t.account_id)?.balance || 0);
    const riskAmount = balance * (Number(t.risk_percent) || 0) / 100;
    const oneLotRisk = computePnl({
      symbol: t.symbol, direction: t.direction, entry: t.entry_price,
      exit: t.take_profit || t.entry_price, stop_loss: t.stop_loss, lot: 1,
    }).risk;
    if (!riskAmount || !oneLotRisk) return { lot: null, riskAmount: 0, target: 0 };
    const lot = Math.floor((riskAmount / oneLotRisk) * 100) / 100;
    const target = computePnl({
      symbol: t.symbol, direction: t.direction, entry: t.entry_price,
      exit: t.take_profit, stop_loss: t.stop_loss, lot,
    }).pnl;
    return { lot, riskAmount, target };
  }, [accounts, t.account_id, t.direction, t.entry_price, t.risk_percent, t.stop_loss, t.symbol, t.take_profit]);

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

  return <AddTradeWorkspace t={t} setT={setT} presets={presets} accounts={accounts} computed={computed} recommendedLot={recommendedLot}
    htfDraft={htfDraft} setHtfDraft={setHtfDraft} entryDraft={entryDraft} setEntryDraft={setEntryDraft}
    addPairedPreset={addPairedPreset} removePairedPreset={removePairedPreset} toggle={toggle}
    saving={saving} save={save} onFile={onFile} />;

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
            <SectionHeading number="1" title="Trade Details" subtitle="Execution, risk and account information" />
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

            <div className="mt-5 rounded-2xl border border-[#DDD6FE] bg-gradient-to-r from-[#F5F3FF] to-[#FAF5FF] p-4" data-testid="lot-size-calculator">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div><h4 className="font-display font-bold text-[#4C1D95]">Lot Size Calculator</h4><p className="text-xs text-[#6D6D82] mt-0.5">Calculated from account balance, risk %, entry and stop loss.</p></div>
                <span className="text-xs font-semibold text-[#7C3AED]">Auto calculation</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-white/80 border border-white p-3"><div className="text-[11px] text-[#6D6D82]">Risk Amount</div><div className="tjfx-mono text-lg font-bold mt-1">${recommendedLot.riskAmount.toFixed(2)}</div></div>
                <div className="rounded-xl bg-white/80 border border-white p-3"><div className="text-[11px] text-[#6D6D82]">Recommended Lot</div><div className="tjfx-mono text-lg font-bold text-[#6D28D9] mt-1">{recommendedLot.lot === null ? "--" : recommendedLot.lot.toFixed(2)}</div></div>
                <div className="rounded-xl bg-white/80 border border-white p-3"><div className="text-[11px] text-[#6D6D82]">Risk / Reward</div><div className="tjfx-mono text-lg font-bold mt-1">{computed.r}R</div></div>
                <div className="rounded-xl bg-white/80 border border-white p-3"><div className="text-[11px] text-[#6D6D82]">TP Estimate</div><div className={`tjfx-mono text-lg font-bold mt-1 ${recommendedLot.target >= 0 ? "text-emerald-600" : "text-red-500"}`}>{recommendedLot.lot === null ? "--" : `${recommendedLot.target >= 0 ? "+" : ""}$${recommendedLot.target.toFixed(2)}`}</div></div>
              </div>
              {recommendedLot.lot !== null ? <button type="button" onClick={()=>setT({...t,lot_size:recommendedLot.lot})} className="mt-3 text-xs font-semibold text-[#6D28D9] hover:text-[#4C1D95]">Use recommended lot size</button> : <div className="mt-3 text-xs text-[#6D6D82]">Enter Entry Price, Stop Loss and Risk % to calculate the lot size.</div>}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-4 p-4 rounded-2xl bg-[#F6F6FB]">
              <div><div className="text-[11px] text-[#6D6D82]">Net P&L</div><div data-testid="calc-pnl" className={`tjfx-mono text-xl font-semibold ${computed.pnl>=0?"text-emerald-600":"text-red-500"}`}>{computed.pnl>=0?"+":""}${computed.pnl}</div></div>
              <div><div className="text-[11px] text-[#6D6D82]">R Multiple</div><div data-testid="calc-r" className="tjfx-mono text-xl font-semibold">{computed.r}R</div></div>
              <div><div className="text-[11px] text-[#6D6D82]">Risk</div><div data-testid="calc-risk" className="tjfx-mono text-xl font-semibold">${computed.risk}</div></div>
              <div><div className="text-[11px] text-[#6D6D82]">Type · pip/lot</div><div className="tjfx-mono text-xs text-[#6D6D82]">{computed.cls}<br/><span className="text-[#7C3AED]">${computed.pipValue}</span></div></div>
            </div>
          </div>

          <PairedPresetBuilder
            number="3" title="HTF Points of Interest" description="Choose the higher-timeframe context, then add it to this trade."
            timeframeLabel="HTF Timeframe" typeLabel="POI Type" timeframes={presets.htf_timeframe} types={presets.htf_poi_type}
            draft={htfDraft} onDraftChange={setHtfDraft} items={t.htf_poi}
            onAdd={() => addPairedPreset("htf_poi", htfDraft, setHtfDraft, "HTF POI")} onRemove={value => removePairedPreset("htf_poi", value)}
            testid="htf-poi"
          />
          <PairedPresetBuilder
            number="4" title="Entry Confirmations" description="Record the timeframe and confirmation that triggered your entry."
            timeframeLabel="Entry Timeframe" typeLabel="Confirmation Type" timeframes={presets.entry_timeframe} types={presets.entry_confirmation_type}
            draft={entryDraft} onDraftChange={setEntryDraft} items={t.entry_tags}
            onAdd={() => addPairedPreset("entry_tags", entryDraft, setEntryDraft, "entry confirmation")} onRemove={value => removePairedPreset("entry_tags", value)}
            testid="entry-confirmation"
          />
          <div className="tjfx-card p-6">
            <SectionHeading number="5" title="Psychology, Tags & Notes" subtitle="Capture your mindset and tag the setup." />
            <ChipRow label="Optional setup tags" items={presets.setup_tag} selected={t.setup_tags} onToggle={v=>toggle("setup_tags",v)}/>
          </div>

          <div className="tjfx-card p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Psychology & Mood</h3>
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

function SectionHeading({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-[0_5px_14px_rgba(124,58,237,0.3)]">{number}</span>
      <div><h3 className="font-display text-lg font-bold leading-6">{title}</h3>{subtitle && <p className="text-xs text-[#6D6D82] mt-0.5">{subtitle}</p>}</div>
    </div>
  );
}

function PairedPresetBuilder({ number, title, description, timeframeLabel, typeLabel, timeframes, types, draft, onDraftChange, items, onAdd, onRemove, testid }) {
  return (
    <div className="tjfx-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div className="flex items-start gap-3"><span className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-sm font-bold flex items-center justify-center shrink-0">{number}</span><div><h3 className="font-display text-lg font-bold">{title}</h3><p className="text-xs text-[#6D6D82] mt-1">{description}</p></div></div>
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

function AddTradeWorkspace({ t, setT, presets, accounts, computed, recommendedLot, htfDraft, setHtfDraft, entryDraft, setEntryDraft, addPairedPreset, removePairedPreset, toggle, saving, save, onFile }) {
  const chooseStrategy = (strategy) => setT({ ...t, strategy });
  return (
    <div className="add-trade-page p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto space-y-5" data-testid="add-trade-page">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="font-display text-3xl font-bold">Add New Trade</h1><p className="text-sm text-[#6D6D82] mt-1">Document your trade and build your edge.</p></div>
        <button onClick={save} disabled={saving} className="h-11 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-60">{saving ? "Saving..." : "Save Trade"}</button>
      </header>

      <React.Fragment>
          <section className="tjfx-card p-5 sm:p-6">
            <SectionHeading number="1" title="Trade Details" subtitle="Execution, risk and account information" />
            {accounts.length > 0 && <Field label="Trading Account"><select value={t.account_id||""} onChange={e=>setT({...t,account_id:e.target.value})} className={inp}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.broker} · ${Number(a.balance||0).toFixed(2)}</option>)}</select></Field>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <Field label="Symbol"><select value={t.symbol} onChange={e=>setT({...t,symbol:e.target.value})} className={inp}>{(presets.symbol.length?presets.symbol:["XAUUSD"]).map(x=><option key={x}>{x}</option>)}</select></Field>
              <Field label="Direction"><div className="grid grid-cols-2 gap-1"><button type="button" onClick={()=>setT({...t,direction:"long"})} className={`h-10 rounded-xl text-sm border ${t.direction==="long"?"bg-emerald-600 text-white border-emerald-600":"border-[#E8E8F1]"}`}>Long</button><button type="button" onClick={()=>setT({...t,direction:"short"})} className={`h-10 rounded-xl text-sm border ${t.direction==="short"?"bg-red-600 text-white border-red-600":"border-[#E8E8F1]"}`}>Short</button></div></Field>
              <Field label="Order Type"><select value={t.order_type} onChange={e=>setT({...t,order_type:e.target.value})} className={inp}>{["Market","Limit","Stop"].map(x=><option key={x}>{x}</option>)}</select></Field>
              <Field label="Status"><select value={t.status} onChange={e=>setT({...t,status:e.target.value})} className={inp}>{["closed","open","cancelled"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></Field>
              <Field label="Entry Price"><input value={t.entry_price} onChange={e=>setT({...t,entry_price:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Exit Price"><input value={t.exit_price} onChange={e=>setT({...t,exit_price:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="SL Price"><input value={t.stop_loss} onChange={e=>setT({...t,stop_loss:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="TP Price"><input value={t.take_profit} onChange={e=>setT({...t,take_profit:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Risk %"><input value={t.risk_percent} onChange={e=>setT({...t,risk_percent:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Lot Size"><input value={t.lot_size} onChange={e=>setT({...t,lot_size:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Session"><select value={t.session} onChange={e=>setT({...t,session:e.target.value})} className={inp}>{(presets.session.length?presets.session:["London"]).map(x=><option key={x}>{x}</option>)}</select></Field>
              <Field label="Date & Time"><input value={t.date} onChange={e=>setT({...t,date:e.target.value})} type="date" className={inp}/></Field>
              <Field label="Commission"><input value={t.commission} onChange={e=>setT({...t,commission:e.target.value})} type="number" step="any" className={inp}/></Field>
              <Field label="Swap"><input value={t.swap} onChange={e=>setT({...t,swap:e.target.value})} type="number" step="any" className={inp}/></Field>
            </div>
            <div className="mt-5"><LotCalculator recommendedLot={recommendedLot} computed={computed} onUse={()=>recommendedLot.lot!==null&&setT({...t,lot_size:recommendedLot.lot})}/></div>
          </section>
          <section className="tjfx-card p-5"><SectionHeading number="2" title="Strategy" subtitle="Choose or add your trading model" /><select value={t.strategy} onChange={e=>chooseStrategy(e.target.value)} className={inp}><option value="">Select strategy...</option>{presets.strategy.map(x=><option key={x}>{x}</option>)}</select><div className="flex flex-wrap gap-2 mt-4">{presets.strategy.slice(0,6).map(x=><Chip key={x} label={x} active={t.strategy===x} onClick={()=>chooseStrategy(x)}/>)}</div></section>
          <PairedPresetBuilder number="3" title="HTF Points of Interest" description="Select a timeframe and POI type, then add it to this trade." timeframeLabel="HTF Timeframe" typeLabel="POI Type" timeframes={presets.htf_timeframe} types={presets.htf_poi_type} draft={htfDraft} onDraftChange={setHtfDraft} items={t.htf_poi} onAdd={()=>addPairedPreset("htf_poi",htfDraft,setHtfDraft,"HTF POI")} onRemove={value=>removePairedPreset("htf_poi",value)} testid="htf-poi"/>
          <LinkedBiasCard />
          <PairedPresetBuilder number="5" title="Entry Confirmations" description="Log the confirmation that triggered the entry." timeframeLabel="Entry Timeframe" typeLabel="Confirmation Type" timeframes={presets.entry_timeframe} types={presets.entry_confirmation_type} draft={entryDraft} onDraftChange={setEntryDraft} items={t.entry_tags} onAdd={()=>addPairedPreset("entry_tags",entryDraft,setEntryDraft,"entry confirmation")} onRemove={value=>removePairedPreset("entry_tags",value)} testid="entry-confirmation"/>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5"><div className="tjfx-card p-6"><SectionHeading number="6" title="Psychology & Mood" subtitle="Record your state before and after the trade" /><ChipRow label="Mood Before" items={presets.mood} selected={t.mood_before} onToggle={x=>toggle("mood_before",x)}/><div className="mt-4"><ChipRow label="Setup Tags" items={presets.setup_tag} selected={t.setup_tags} onToggle={x=>toggle("setup_tags",x)}/></div><textarea value={t.notes} onChange={e=>setT({...t,notes:e.target.value})} rows={5} className="w-full mt-5 p-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" placeholder="Notes (pre-trade mindset, execution and lessons)"/></div><AttachmentPanel images={t.screenshots} onFile={onFile}/></section>
          <section className="tjfx-card p-5"><SectionHeading number="7" title="Review & Save" subtitle="Check your execution details before saving." /><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3 text-sm"><Review label="Symbol" value={t.symbol}/><Review label="Direction" value={t.direction}/><Review label="Entry" value={t.entry_price||"--"}/><Review label="Exit" value={t.exit_price||"--"}/><Review label="SL" value={t.stop_loss||"--"}/><Review label="TP" value={t.take_profit||"--"}/><Review label="Risk" value={`${t.risk_percent}%`}/><Review label="Lot" value={t.lot_size}/><Review label="R:R" value={`${computed.r}R`}/></div><button onClick={save} disabled={saving} className="mt-5 h-11 min-w-[220px] rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-60">{saving?"Saving trade...":"Save Trade"}</button></section>
      </React.Fragment>
    </div>
  );
}

function LotCalculator({ recommendedLot, computed, onUse }) { return <div className="rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] p-5" data-testid="lot-size-calculator"><h3 className="font-display text-lg font-bold text-[#7C3AED]">Lot Size Calculator (LSC)</h3><p className="text-xs text-[#6D6D82] mt-1">Auto-calculated from this account's balance, risk and stop loss.</p><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4"><Review label="Risk Amount" value={`$${recommendedLot.riskAmount.toFixed(2)}`} green/><Review label="Recommended Lot" value={recommendedLot.lot===null?"--":recommendedLot.lot.toFixed(2)} green/><Review label="TP Estimate" value={recommendedLot.lot===null?"--":`$${recommendedLot.target.toFixed(2)}`}/><Review label="R:R" value={`${computed.r}R`}/></div>{recommendedLot.lot!==null&&<button type="button" onClick={onUse} className="mt-4 text-sm font-semibold text-[#7C3AED]">Use recommended lot size</button>}</div>; }
function Review({ label, value, green }) { return <div><div className="text-[11px] text-[#6D6D82]">{label}</div><div className={`tjfx-mono font-semibold mt-1 ${green?"text-emerald-500":""}`}>{value}</div></div>; }
function BiasCard() { return <div className="tjfx-card p-6 min-h-[300px]"><div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Daily / Weekly Bias</h3><span className="text-xs text-[#7C3AED]">AI Summary</span></div><div className="inline-flex mt-4 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 text-sm font-bold">BULLISH</div><div className="mt-5 grid grid-cols-2 gap-4"><div className="h-36 rounded-xl bg-gradient-to-br from-emerald-500/20 via-[#122033] to-[#7C3AED]/20 border border-[#E8E8F1] flex items-end gap-1 p-3">{[35,68,42,85,52,72,46,90,60,78,55,95].map((h,i)=><span key={i} className="flex-1 bg-emerald-500/80 rounded-t" style={{height:`${h}%`}}/>)}</div><div className="text-xs leading-relaxed text-[#6D6D82]"><b className="text-[#7C3AED]">AI Summary</b><br/>Price is holding above the daily demand zone. Wait for confirmation at a key level before entering.<br/><br/><b className="text-emerald-500">Key bullish levels</b><br/>• 2360.00<br/>• 2348.00<br/>• 2400.00</div></div></div>; }
