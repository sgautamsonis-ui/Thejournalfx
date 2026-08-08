import React, { useEffect, useMemo, useState } from "react";
import { tradesApi, prefsApi } from "@/lib/api";
import { useAccount } from "@/context/AccountContext";
import { Search, Trash2, X, PlusCircle, Filter, Pencil, Save, ChevronDown, Upload, Clipboard, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { computePnl } from "@/lib/pnlCalc";
import { getPendingTrade } from "@/lib/pendingTrade";

export default function TradeView() {
  const { reload: reloadAccounts } = useAccount();
  const [trades, setTrades] = useState(() => {
    const pending = getPendingTrade();
    return pending ? [pending] : [];
  });
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null); // editable draft
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const [presets, setPresets] = useState({
    symbol: [], strategy: [], session: [], htf_poi: [], entry_tag: [], mood: [], mistake: [], strength: [],
  });

  const load = () => tradesApi.list().then((serverTrades) => {
    const pending = getPendingTrade();
    setTrades(pending && !serverTrades.some(t => t.id === pending.id) ? [pending, ...serverTrades] : serverTrades);
  }).catch(()=>{});
  useEffect(() => {
    load();
    ["symbol","strategy","session","htf_poi","entry_tag","mood","mistake","strength"].forEach(k =>
      prefsApi.list(k).then(list => setPresets(p => ({...p, [k]: list.map(x=>x.value)}))).catch(()=>{})
    );
  }, []);

  useEffect(() => {
    const onTradeSync = ({ detail }) => {
      if (detail?.error) setTrades(current => current.filter(t => t.id !== detail.id));
      else if (detail?.trade) setTrades(current => [detail.trade, ...current.filter(t => t.id !== detail.trade.id)]);
    };
    window.addEventListener("tjfx:trade-sync", onTradeSync);
    return () => window.removeEventListener("tjfx:trade-sync", onTradeSync);
  }, []);

  // filters
  const emptyFilters = { symbols: [], directions: [], sessions: [], strategies: [], htf_poi: [], entry_tags: [], moods: [], mistakes: [], strengths: [], dateFrom: "", dateTo: "", minR: "", maxR: "", minPnl: "", maxPnl: "" };
  const [filters, setFilters] = useState(emptyFilters);

  const setF = (key, val) => setFilters(p => ({...p, [key]: val}));
  const toggleF = (key, v) => setFilters(p => ({...p, [key]: p[key].includes(v) ? p[key].filter(x=>x!==v) : [...p[key], v]}));

  const activeCount = useMemo(() => {
    let n = 0;
    ["symbols","directions","sessions","strategies","htf_poi","entry_tags","moods","mistakes","strengths"].forEach(k => n += filters[k].length);
    ["dateFrom","dateTo","minR","maxR","minPnl","maxPnl"].forEach(k => { if (filters[k]) n++; });
    return n;
  }, [filters]);

  const filtered = useMemo(() => {
    let list = trades;
    if (tab==="open") list = list.filter(t=>t.status==="open");
    if (tab==="closed") list = list.filter(t=>t.status==="closed");
    if (tab==="win") list = list.filter(t=>(t.net_pnl||0)>0);
    if (tab==="loss") list = list.filter(t=>(t.net_pnl||0)<0);

    if (q) {
      const s = q.toLowerCase();
      list = list.filter(t => (t.symbol||"").toLowerCase().includes(s) || (t.strategy||"").toLowerCase().includes(s) || (t.notes||"").toLowerCase().includes(s));
    }
    if (filters.symbols.length) list = list.filter(t => filters.symbols.includes(t.symbol));
    if (filters.directions.length) list = list.filter(t => filters.directions.includes(t.direction));
    if (filters.sessions.length) list = list.filter(t => filters.sessions.includes(t.session));
    if (filters.strategies.length) list = list.filter(t => filters.strategies.includes(t.strategy));
    if (filters.htf_poi.length) list = list.filter(t => (t.htf_poi||[]).some(x => filters.htf_poi.includes(x)));
    if (filters.entry_tags.length) list = list.filter(t => (t.entry_tags||[]).some(x => filters.entry_tags.includes(x)));
    if (filters.moods.length) list = list.filter(t => (t.mood_before||[]).some(x => filters.moods.includes(x)) || (t.mood_after||[]).some(x => filters.moods.includes(x)));
    if (filters.mistakes.length) list = list.filter(t => (t.mistakes||[]).some(x => filters.mistakes.includes(x)));
    if (filters.strengths.length) list = list.filter(t => (t.strengths||[]).some(x => filters.strengths.includes(x)));
    if (filters.dateFrom) list = list.filter(t => (t.date||"") >= filters.dateFrom);
    if (filters.dateTo) list = list.filter(t => (t.date||"") <= filters.dateTo);
    if (filters.minR !== "") list = list.filter(t => (t.r_multiple||0) >= parseFloat(filters.minR));
    if (filters.maxR !== "") list = list.filter(t => (t.r_multiple||0) <= parseFloat(filters.maxR));
    if (filters.minPnl !== "") list = list.filter(t => (t.net_pnl||0) >= parseFloat(filters.minPnl));
    if (filters.maxPnl !== "") list = list.filter(t => (t.net_pnl||0) <= parseFloat(filters.maxPnl));
    return list;
  }, [trades, tab, q, filters]);

  const openTrade = (t) => {
    setSel(t); setEdit(null);
    // Screenshot data is intentionally fetched only for this opened trade.
    tradesApi.get(t.id).then(setSel).catch(() => {});
  };
  const startEdit = () => setEdit({ ...sel });
  const cancelEdit = () => setEdit(null);
  const toggleEdit = (key, v) => setEdit(p => ({...p, [key]: (p[key]||[]).includes(v) ? p[key].filter(x=>x!==v) : [...(p[key]||[]), v]}));

  const editComputed = useMemo(() => {
    if (!edit) return null;
    const r = computePnl({ symbol: edit.symbol, direction: edit.direction, entry: edit.entry_price, exit: edit.exit_price, lot: edit.lot_size, stop_loss: edit.stop_loss, commission: edit.commission, swap: edit.swap });
    const rM = r.risk ? Math.round((r.pnl/r.risk)*100)/100 : 0;
    return { pnl: r.pnl, r: rM, risk: r.risk };
  }, [edit]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      // Determine whether the user actually edited a compute-affecting numeric field.
      const num = (v) => v === "" || v == null ? null : parseFloat(v);
      const eq = (a, b) => (a == null && b == null) || parseFloat(a || 0) === parseFloat(b || 0);
      const computeDirty =
        !eq(edit.entry_price, sel.entry_price) ||
        !eq(edit.exit_price, sel.exit_price) ||
        !eq(edit.stop_loss, sel.stop_loss) ||
        !eq(edit.lot_size, sel.lot_size) ||
        !eq(edit.commission, sel.commission) ||
        !eq(edit.swap, sel.swap) ||
        edit.direction !== sel.direction ||
        edit.symbol !== sel.symbol;

      const payload = {
        ...edit,
        entry_price: num(edit.entry_price) ?? sel.entry_price,
        exit_price: num(edit.exit_price) ?? sel.exit_price,
        stop_loss: num(edit.stop_loss) ?? sel.stop_loss,
        take_profit: num(edit.take_profit) ?? sel.take_profit,
        lot_size: num(edit.lot_size) ?? sel.lot_size,
        risk_percent: num(edit.risk_percent) ?? sel.risk_percent,
        commission: num(edit.commission) ?? (sel.commission || 0),
        swap: num(edit.swap) ?? (sel.swap || 0),
      };
      if (computeDirty && editComputed) {
        payload.net_pnl = editComputed.pnl;
        // preserve existing r_multiple when we cannot compute R (no stop_loss)
        payload.r_multiple = editComputed.risk > 0 ? editComputed.r : (sel.r_multiple ?? null);
      } else {
        payload.net_pnl = sel.net_pnl;
        payload.r_multiple = sel.r_multiple;
      }
      const updated = await tradesApi.update(edit.id, payload);
      setSel(updated); setEdit(null);
      toast.success("Trade updated");
      reloadAccounts?.();
      load();
    } catch { toast.error("Update failed"); } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("Delete this trade?")) return;
    await tradesApi.delete(id);
    toast.success("Deleted"); setSel(null); reloadAccounts?.(); load();
  };

  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-5" data-testid="trade-view-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Trade View</h1>
          <p className="text-[#6D6D82] mt-1">Slice by every dimension. Click any trade to view or edit.</p>
        </div>
        <Link to="/add-trade" className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2"><PlusCircle className="w-4 h-4"/> Add Trade</Link>
      </div>

      <div className="tjfx-card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]"/>
          <input data-testid="search-input" value={q} onChange={e=>setQ(e.target.value)} className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" placeholder="Search symbol, strategy, notes..."/>
        </div>
        <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl">
          {[["all",`All (${trades.length})`],["open","Open"],["closed","Closed"],["win","Wins"],["loss","Losses"]].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)} className={`px-3 h-8 text-xs rounded-lg font-medium ${tab===k?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82]"}`}>{l}</button>
          ))}
        </div>
        <button onClick={()=>setShowFilters(!showFilters)} data-testid="toggle-filters" className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm font-medium flex items-center gap-2">
          <Filter className="w-4 h-4"/> Filters {activeCount>0 && <span className="bg-[#7C3AED] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{activeCount}</span>}
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters?"rotate-180":""}`}/>
        </button>
      </div>

      {showFilters && (
        <div className="tjfx-card p-0 overflow-hidden" data-testid="filter-panel">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8F1] bg-gradient-to-r from-[#F3E8FF]/50 to-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center"><Filter className="w-4 h-4 text-white"/></div>
              <div>
                <div className="font-display font-bold">Detailed Filters</div>
                <div className="text-[11px] text-[#6D6D82]">{activeCount} active · {filtered.length} of {trades.length} trades</div>
              </div>
            </div>
            <button onClick={()=>setFilters(emptyFilters)} className="text-xs text-[#7C3AED] font-medium hover:underline">Clear all</button>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-x-6 gap-y-4">
            <FilterSection label="Symbols" count={filters.symbols.length}>
              <FilterGroup items={presets.symbol} selected={filters.symbols} onToggle={v=>toggleF("symbols",v)}/>
            </FilterSection>
            <FilterSection label="Direction" count={filters.directions.length}>
              <FilterGroup items={["long","short"]} selected={filters.directions} onToggle={v=>toggleF("directions",v)}/>
            </FilterSection>
            <FilterSection label="Session" count={filters.sessions.length}>
              <FilterGroup items={presets.session} selected={filters.sessions} onToggle={v=>toggleF("sessions",v)}/>
            </FilterSection>
            <FilterSection label="Strategy" count={filters.strategies.length}>
              <FilterGroup items={presets.strategy} selected={filters.strategies} onToggle={v=>toggleF("strategies",v)}/>
            </FilterSection>
            <FilterSection label="HTF POI" count={filters.htf_poi.length}>
              <FilterGroup items={presets.htf_poi} selected={filters.htf_poi} onToggle={v=>toggleF("htf_poi",v)}/>
            </FilterSection>
            <FilterSection label="Entry Confirmation" count={filters.entry_tags.length}>
              <FilterGroup items={presets.entry_tag} selected={filters.entry_tags} onToggle={v=>toggleF("entry_tags",v)}/>
            </FilterSection>
            <FilterSection label="Mood" count={filters.moods.length}>
              <FilterGroup items={presets.mood} selected={filters.moods} onToggle={v=>toggleF("moods",v)}/>
            </FilterSection>
            <FilterSection label="Mistakes" count={filters.mistakes.length}>
              <FilterGroup items={presets.mistake} selected={filters.mistakes} onToggle={v=>toggleF("mistakes",v)}/>
            </FilterSection>
            <FilterSection label="Strengths" count={filters.strengths.length}>
              <FilterGroup items={presets.strength} selected={filters.strengths} onToggle={v=>toggleF("strengths",v)}/>
            </FilterSection>
          </div>

          <div className="border-t border-[#E8E8F1] px-6 py-4 grid md:grid-cols-3 gap-4 bg-[#F6F6FB]">
            <RangeInput label="Date" leftPlaceholder="From" rightPlaceholder="To" type="date" left={filters.dateFrom} right={filters.dateTo} onLeft={v=>setF("dateFrom",v)} onRight={v=>setF("dateTo",v)}/>
            <RangeInput label="R multiple" leftPlaceholder="min" rightPlaceholder="max" type="number" left={filters.minR} right={filters.maxR} onLeft={v=>setF("minR",v)} onRight={v=>setF("maxR",v)}/>
            <RangeInput label="Net P&L ($)" leftPlaceholder="min" rightPlaceholder="max" type="number" left={filters.minPnl} right={filters.maxPnl} onLeft={v=>setF("minPnl",v)} onRight={v=>setF("maxPnl",v)}/>
          </div>
        </div>
      )}

      <div className="text-[12px] text-[#6D6D82] tjfx-mono">Showing {filtered.length} of {trades.length} trades</div>

      <div className="tjfx-card overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead className="bg-[#F6F6FB] text-[#6D6D82]">
              <tr>
                {["Date","Symbol","Dir","Entry","Exit","SL","TP","R","P&L","Session","Strategy","Status"].map(h => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <tr><td colSpan={12} className="text-center py-12 text-[#6D6D82]">No trades match. <Link to="/add-trade" className="text-[#7C3AED] font-medium">Add trade →</Link></td></tr>}
              {filtered.map(t => (
                <tr key={t.id} onClick={()=>openTrade(t)} className="border-t border-[#E8E8F1] hover:bg-[#F3E8FF]/40 cursor-pointer" data-testid={`trade-row-${t.id}`}>
                  <td className="px-4 py-3 tjfx-mono text-[#6D6D82]">{t.date}</td>
                  <td className="px-4 py-3 font-semibold tjfx-mono">{t.symbol}</td>
                  <td className={`px-4 py-3 ${t.direction==="long"?"text-emerald-600":"text-red-500"}`}>{t.direction==="long"?"↑":"↓"}</td>
                  <td className="px-4 py-3 tjfx-mono">{t.entry_price}</td>
                  <td className="px-4 py-3 tjfx-mono">{t.exit_price||"—"}</td>
                  <td className="px-4 py-3 tjfx-mono">{t.stop_loss||"—"}</td>
                  <td className="px-4 py-3 tjfx-mono">{t.take_profit||"—"}</td>
                  <td className="px-4 py-3 tjfx-mono">{t.r_multiple?`${t.r_multiple}R`:"—"}</td>
                  <td className={`px-4 py-3 tjfx-mono ${(t.net_pnl||0)>=0?"text-emerald-600":"text-red-500"}`}>{(t.net_pnl||0)>=0?"+":""}${(t.net_pnl||0).toFixed(2)}</td>
                  <td className="px-4 py-3">{t.session}</td>
                  <td className="px-4 py-3">{t.strategy}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${t.status==="open"?"bg-amber-50 text-amber-700":"bg-gray-50 text-gray-600"}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={()=>{setSel(null); setEdit(null);}}>
          <div onClick={e=>e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl overflow-y-auto scroll-thin p-6 space-y-4 animate-in">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold">{(edit||sel).symbol}</h3>
              <div className="flex gap-2">
                {!edit ? (
                  <button onClick={startEdit} data-testid="edit-trade-btn" className="h-9 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1"><Pencil className="w-4 h-4"/> Edit</button>
                ) : (
                  <>
                    <button onClick={cancelEdit} className="h-9 px-3 rounded-xl border border-[#E8E8F1] text-sm">Cancel</button>
                    <button onClick={saveEdit} disabled={saving} data-testid="save-edit-btn" className="h-9 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-60"><Save className="w-4 h-4"/> {saving?"Saving...":"Save"}</button>
                  </>
                )}
                <button onClick={()=>{setSel(null); setEdit(null);}} className="w-9 h-9 rounded-xl hover:bg-[#F6F6FB] flex items-center justify-center"><X className="w-4 h-4"/></button>
              </div>
            </div>

            {edit ? <EditForm edit={edit} setEdit={setEdit} toggleEdit={toggleEdit} computed={editComputed} presets={presets}/> :
              <ViewBlock t={sel}/>
            }

            {!edit && <button onClick={()=>del(sel.id)} data-testid="delete-trade" className="w-full h-10 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> Delete Trade</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSection({ label, count, children }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="rounded-xl border border-[#E8E8F1] overflow-hidden">
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#F6F6FB]">
        <span className="text-[12px] font-semibold text-[#16151F]">{label} {count>0 && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#7C3AED]">{count}</span>}</span>
        <ChevronDown className={`w-4 h-4 text-[#6D6D82] transition-transform ${open?"":"-rotate-90"}`}/>
      </button>
      {open && <div className="px-4 pb-3 pt-1">{children}</div>}
    </div>
  );
}

function FilterGroup({ items, selected, onToggle }) {
  if (!items || items.length===0) return <div className="text-xs text-[#A1A1AA] py-1">No presets. Add in Settings.</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(v => <button key={v} onClick={()=>onToggle(v)} className={`chip ${selected.includes(v)?"active":""}`} style={{fontSize:11, padding:"3px 10px"}}>{v}</button>)}
    </div>
  );
}

function RangeInput({ label, type, leftPlaceholder, rightPlaceholder, left, right, onLeft, onRight }) {
  return (
    <div>
      <div className="text-[11px] text-[#6D6D82] mb-1.5 font-semibold uppercase tracking-wide">{label}</div>
      <div className="flex gap-2">
        <input type={type} step="any" placeholder={leftPlaceholder} value={left} onChange={e=>onLeft(e.target.value)} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] text-xs bg-white tjfx-mono"/>
        <input type={type} step="any" placeholder={rightPlaceholder} value={right} onChange={e=>onRight(e.target.value)} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] text-xs bg-white tjfx-mono"/>
      </div>
    </div>
  );
}

function ViewBlock({ t }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[["Direction",t.direction],["Status",t.status],["Session",t.session],["Strategy",t.strategy],["Entry",t.entry_price],["Exit",t.exit_price||"—"],["SL",t.stop_loss||"—"],["TP",t.take_profit||"—"],["Lot",t.lot_size],["Risk %",t.risk_percent],["R Multiple",t.r_multiple||"—"],["Net P&L",`${(t.net_pnl||0)>=0?"+":""}$${(t.net_pnl||0).toFixed(2)}`]].map(([k,v]) => (
          <div key={k} className="p-3 rounded-xl bg-[#F6F6FB]"><div className="text-[11px] text-[#6D6D82]">{k}</div><div className="font-semibold tjfx-mono">{v}</div></div>
        ))}
      </div>
      {t.htf_poi?.length>0 && <TagBlock label="HTF POI" items={t.htf_poi}/>}
      {t.entry_tags?.length>0 && <TagBlock label="Entry" items={t.entry_tags}/>}
      {t.mood_before?.length>0 && <TagBlock label="Mood Before" items={t.mood_before}/>}
      {t.mood_after?.length>0 && <TagBlock label="Mood After" items={t.mood_after}/>}
      {t.mistakes?.length>0 && <TagBlock label="Mistakes" items={t.mistakes}/>}
      {t.strengths?.length>0 && <TagBlock label="Strengths" items={t.strengths}/>}
      {t.notes && <div><div className="text-[12px] text-[#6D6D82] mb-1">Notes</div><div className="p-3 bg-[#F6F6FB] rounded-xl text-sm whitespace-pre-wrap">{t.notes}</div></div>}
      {t.screenshots?.length>0 && (
        <div>
          <div className="text-[12px] text-[#6D6D82] mb-2">Screenshots ({t.screenshots.length})</div>
          <div className="grid grid-cols-2 gap-2">{t.screenshots.map((s,i)=><img key={i} alt="" src={s} className="w-full rounded-lg"/>)}</div>
        </div>
      )}
    </>
  );
}

function EditForm({ edit, setEdit, toggleEdit, computed, presets }) {
  const inp = "w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white tjfx-mono";

  const addImg = (dataUrl) => setEdit(p => ({...p, screenshots: [...(p.screenshots||[]), dataUrl]}));
  const onFile = (e) => Array.from(e.target.files||[]).forEach(f => { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); });
  const removeImg = (i) => setEdit(p => ({...p, screenshots: (p.screenshots||[]).filter((_,j)=>j!==i)}));

  React.useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type?.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); toast.success("Image pasted"); }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <F label="Symbol">
          <select value={edit.symbol} onChange={e=>setEdit({...edit,symbol:e.target.value})} className={inp}>{(presets.symbol.length?presets.symbol:[edit.symbol]).map(s => <option key={s}>{s}</option>)}</select>
        </F>
        <F label="Direction">
          <div className="flex gap-2">
            {["long","short"].map(d => <button key={d} type="button" onClick={()=>setEdit({...edit,direction:d})} className={`flex-1 h-9 rounded-lg border text-xs font-medium ${edit.direction===d?(d==="long"?"bg-emerald-50 border-emerald-300 text-emerald-700":"bg-red-50 border-red-300 text-red-700"):"border-[#E8E8F1]"}`}>{d}</button>)}
          </div>
        </F>
        <F label="Entry"><input className={inp} type="number" step="any" value={edit.entry_price||""} onChange={e=>setEdit({...edit,entry_price:e.target.value})}/></F>
        <F label="Exit"><input className={inp} type="number" step="any" value={edit.exit_price||""} onChange={e=>setEdit({...edit,exit_price:e.target.value})}/></F>
        <F label="SL"><input className={inp} type="number" step="any" value={edit.stop_loss||""} onChange={e=>setEdit({...edit,stop_loss:e.target.value})}/></F>
        <F label="TP"><input className={inp} type="number" step="any" value={edit.take_profit||""} onChange={e=>setEdit({...edit,take_profit:e.target.value})}/></F>
        <F label="Lot"><input className={inp} type="number" step="any" value={edit.lot_size||""} onChange={e=>setEdit({...edit,lot_size:e.target.value})}/></F>
        <F label="Risk %"><input className={inp} type="number" step="any" value={edit.risk_percent||""} onChange={e=>setEdit({...edit,risk_percent:e.target.value})}/></F>
        <F label="Commission"><input className={inp} type="number" step="any" value={edit.commission||""} onChange={e=>setEdit({...edit,commission:e.target.value})}/></F>
        <F label="Swap"><input className={inp} type="number" step="any" value={edit.swap||""} onChange={e=>setEdit({...edit,swap:e.target.value})}/></F>
        <F label="Date"><input className={inp} type="date" value={edit.date||""} onChange={e=>setEdit({...edit,date:e.target.value})}/></F>
        <F label="Status">
          <select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})} className={inp}><option value="closed">closed</option><option value="open">open</option><option value="cancelled">cancelled</option></select>
        </F>
        <F label="Session"><select value={edit.session||""} onChange={e=>setEdit({...edit,session:e.target.value})} className={inp}>{presets.session.map(s => <option key={s}>{s}</option>)}</select></F>
        <F label="Strategy"><select value={edit.strategy||""} onChange={e=>setEdit({...edit,strategy:e.target.value})} className={inp.replace("tjfx-mono","")}><option value="">—</option>{presets.strategy.map(s => <option key={s}>{s}</option>)}</select></F>
      </div>

      {computed && (
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#F6F6FB]">
          <div><div className="text-[10px] text-[#6D6D82]">Net P&L</div><div className={`tjfx-mono font-semibold ${computed.pnl>=0?"text-emerald-600":"text-red-500"}`}>{computed.pnl>=0?"+":""}${computed.pnl}</div></div>
          <div><div className="text-[10px] text-[#6D6D82]">R</div><div className="tjfx-mono font-semibold">{computed.r}R</div></div>
          <div><div className="text-[10px] text-[#6D6D82]">Risk</div><div className="tjfx-mono font-semibold">${computed.risk}</div></div>
        </div>
      )}

      <EditChips label="HTF POI" items={presets.htf_poi} selected={edit.htf_poi||[]} onToggle={v=>toggleEdit("htf_poi",v)}/>
      <EditChips label="Entry" items={presets.entry_tag} selected={edit.entry_tags||[]} onToggle={v=>toggleEdit("entry_tags",v)}/>
      <EditChips label="Mood Before" items={presets.mood} selected={edit.mood_before||[]} onToggle={v=>toggleEdit("mood_before",v)}/>
      <EditChips label="Mood After" items={presets.mood} selected={edit.mood_after||[]} onToggle={v=>toggleEdit("mood_after",v)}/>
      <EditChips label="Mistakes" items={presets.mistake} selected={edit.mistakes||[]} onToggle={v=>toggleEdit("mistakes",v)}/>
      <EditChips label="Strengths" items={presets.strength} selected={edit.strengths||[]} onToggle={v=>toggleEdit("strengths",v)}/>

      <div>
        <div className="text-[11px] text-[#6D6D82] mb-1">Notes</div>
        <textarea value={edit.notes||""} onChange={e=>setEdit({...edit,notes:e.target.value})} rows={3} className="w-full p-2 rounded-lg border border-[#E8E8F1] text-sm"/>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] text-[#6D6D82] uppercase tracking-wide flex items-center gap-1"><ImageIcon className="w-3 h-3"/> Screenshots <span className="tjfx-mono normal-case">{(edit.screenshots||[]).length}</span></div>
          <label className="text-[11px] text-[#7C3AED] font-medium cursor-pointer flex items-center gap-1"><Upload className="w-3 h-3"/> Add
            <input type="file" accept="image/*" multiple hidden onChange={onFile} data-testid="edit-upload-input"/>
          </label>
        </div>
        <div className="text-[10px] text-[#A1A1AA] mb-2 flex items-center gap-1"><Clipboard className="w-3 h-3"/> Ctrl+V to paste directly</div>
        <div className="grid grid-cols-3 gap-2">
          {(edit.screenshots||[]).map((s,i) => (
            <div key={i} className="relative group">
              <img alt="" src={s} className="w-full h-20 object-cover rounded-lg"/>
              <button onClick={()=>removeImg(i)} data-testid={`remove-img-${i}`} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3 text-red-500"/></button>
            </div>
          ))}
          {(edit.screenshots||[]).length===0 && <div className="col-span-full text-xs text-[#A1A1AA] text-center py-4 border-2 border-dashed border-[#E8E8F1] rounded-lg">No screenshots</div>}
        </div>
      </div>
    </div>
  );
}

const F = ({ label, children }) => (<div><label className="block text-[10px] text-[#6D6D82] mb-1">{label}</label>{children}</div>);

function EditChips({ label, items, selected, onToggle }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-[11px] text-[#6D6D82] mb-1.5 uppercase tracking-wide">{label}</div>
      <div className="flex flex-wrap gap-1.5">{items.map(v => <button type="button" key={v} onClick={()=>onToggle(v)} className={`chip ${selected.includes(v)?"active":""}`} style={{fontSize:11,padding:"3px 8px"}}>{v}</button>)}</div>
    </div>
  );
}

const TagBlock = ({ label, items }) => (
  <div>
    <div className="text-[12px] text-[#6D6D82] mb-2">{label}</div>
    <div className="flex flex-wrap gap-1.5">{items.map(x => <span key={x} className="chip active">{x}</span>)}</div>
  </div>
);
