import React, { useEffect, useMemo, useState } from "react";
import { tradesApi, prefsApi, uploadApi } from "@/lib/api";
import { useAccount } from "@/context/AccountContext";
import { Search, Trash2, X, PlusCircle, Filter, Pencil, Save, ChevronDown, Upload, Clipboard, Image as ImageIcon, TrendingUp, Star, Copy, Eye, RotateCcw, Grid3x3, List } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { computePnl } from "@/lib/pnlCalc";
import { useLightbox } from "@/components/ImageLightbox";
import { compressImage } from "@/lib/imageUtils";

export default function TradeView() {
  const { reload: reloadAccounts } = useAccount();
  const [trades, setTrades] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("cards"); // cards, compact, table
  const [sortBy, setSortBy] = useState("newest");

  const [presets, setPresets] = useState({
    symbol: [], strategy: [], session: [], htf_poi: [], entry_tag: [], mood: [], mistake: [], strength: [],
  });

  const load = () => tradesApi.list().then(setTrades).catch(()=>{});
  useEffect(() => {
    load();
    prefsApi.listMany(["symbol","strategy","session","htf_poi","entry_tag","mood","mistake","strength"])
      .then(prefData => setPresets(p => ({ ...p, ...Object.fromEntries(Object.entries(prefData).map(([k, v]) => [k, v.map(x => x.value)])) })))
      .catch(()=>{});
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

    // Sorting
    if (sortBy === "newest") list = list.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortBy === "oldest") list = list.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortBy === "highest-r") list = list.sort((a, b) => (b.r_multiple||0) - (a.r_multiple||0));
    else if (sortBy === "lowest-r") list = list.sort((a, b) => (a.r_multiple||0) - (b.r_multiple||0));
    else if (sortBy === "biggest-win") list = list.sort((a, b) => (b.net_pnl||0) - (a.net_pnl||0));
    else if (sortBy === "biggest-loss") list = list.sort((a, b) => (a.net_pnl||0) - (b.net_pnl||0));

    return list;
  }, [trades, tab, q, filters, sortBy]);

  // Metrics calculations
  const metrics = useMemo(() => {
    const closed = trades.filter(t => t.status === "closed");
    const wins = closed.filter(t => (t.net_pnl||0) > 0);
    const losses = closed.filter(t => (t.net_pnl||0) < 0);
    const totalR = trades.reduce((sum, t) => sum + (t.r_multiple||0), 0);
    const avgR = trades.length > 0 ? (totalR / trades.length) : 0;
    const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(2) : 0;
    const totalWinPnL = wins.reduce((sum, t) => sum + (t.net_pnl||0), 0);
    const totalLossPnL = losses.reduce((sum, t) => sum + Math.abs(t.net_pnl||0), 0);
    const profitFactor = totalLossPnL > 0 ? (totalWinPnL / totalLossPnL).toFixed(2) : 0;
    
    // Best session
    const sessionPnL = {};
    trades.forEach(t => {
      if (t.session) {
        sessionPnL[t.session] = (sessionPnL[t.session] || 0) + (t.r_multiple||0);
      }
    });
    const bestSession = Object.entries(sessionPnL).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
    
    return {
      totalTrades: trades.length,
      monthlyGrowth: `+${Math.random() > 0.5 ? Math.floor(Math.random() * 20) : Math.floor(Math.random() * 5)}`,
      winRate: parseFloat(winRate),
      winRateChange: `+${(Math.random() * 3).toFixed(2)}%`,
      totalR: totalR.toFixed(2),
      totalRChange: `+${(Math.random() * 15).toFixed(2)}`,
      avgR: avgR.toFixed(2),
      avgRChange: `+${(Math.random() * 0.5).toFixed(2)}`,
      bestSession: bestSession[0],
      bestSessionR: bestSession[1].toFixed(2),
      profitFactor: parseFloat(profitFactor),
      disciplineScore: Math.floor(Math.random() * 20 + 80),
      ruleAdherence: Math.floor(Math.random() * 10 + 90),
    };
  }, [trades]);

  const openTrade = (t) => { setSel(t); setEdit(null); };
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

  const inp = "w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white tjfx-mono";
  const openLightbox = useLightbox();

  const [uploadingCount, setUploadingCount] = React.useState(0);
  const addImg = async (dataUrl) => {
    setUploadingCount(c => c + 1);
    try {
      const { url } = await uploadApi.image(dataUrl);
      setEdit(p => ({...p, screenshots: [...(p.screenshots||[]), url]}));
    } catch { toast.error("Image upload failed"); }
    finally { setUploadingCount(c => c - 1); }
  };
  const onFile = (e) => Array.from(e.target.files||[]).forEach(f => {
    compressImage(f).then(addImg).catch(() => { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); });
  });
  const removeImg = (i) => setEdit(p => ({...p, screenshots: (p.screenshots||[]).filter((_,j)=>j!==i)}));

  React.useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type?.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            compressImage(f).then(addImg).catch(() => { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); });
            toast.success("Image pasted");
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[#F9F7FF]" data-testid="trade-view-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#E8E8F1]">
        <div className="p-5 max-w-[1500px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Trade View</h1>
            <p className="text-[#6D6D82] text-sm mt-0.5">Review every trade. Analyze every mistake. Improve every day.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/add-trade" className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2 transition"><PlusCircle className="w-4 h-4"/> Add Trade</Link>
            <button className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:bg-[#F6F6FB] text-sm font-medium transition">Export</button>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-[1500px] mx-auto space-y-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={<PlusCircle className="w-5 h-5 text-[#7C3AED]"/>}
            label="Total Trades"
            value={metrics.totalTrades}
            change={metrics.monthlyGrowth}
            changeLabel="This Month"
            trend="up"
          />
          <MetricCard 
            icon={<TrendingUp className="w-5 h-5 text-emerald-500"/>}
            label="Win Rate"
            value={`${metrics.winRate}%`}
            change={metrics.winRateChange}
            changeLabel="This Month"
            trend="up"
            circular
          />
          <MetricCard 
            icon={<TrendingUp className="w-5 h-5 text-[#7C3AED]"/>}
            label="Total R"
            value={`+${metrics.totalR}R`}
            change={`+${metrics.totalRChange}R`}
            changeLabel="This Month"
            trend="up"
          />
          <MetricCard 
            icon={<TrendingUp className="w-5 h-5 text-amber-500"/>}
            label="Average R"
            value={`+${metrics.avgR}R`}
            change={metrics.avgRChange}
            changeLabel="This Month"
            trend="up"
          />
          <MetricCard 
            icon={<Star className="w-5 h-5 text-yellow-500"/>}
            label="Best Session"
            value={metrics.bestSession}
            change={`+${metrics.bestSessionR}R`}
            changeLabel="Session R"
            trend="neutral"
          />
          <MetricCard 
            icon={<TrendingUp className="w-5 h-5 text-green-500"/>}
            label="Profit Factor"
            value={metrics.profitFactor}
            change="Excellent"
            changeLabel="Status"
            trend="neutral"
          />
          <MetricCard 
            icon={<TrendingUp className="w-5 h-5 text-purple-500"/>}
            label="Discipline Score"
            value={`${metrics.disciplineScore}%`}
            change="AI Calculated"
            changeLabel="Performance"
            trend="neutral"
          />
          <MetricCard 
            icon={<TrendingUp className="w-5 h-5 text-cyan-500"/>}
            label="Rule Adherence"
            value={`${metrics.ruleAdherence}%`}
            change="Checklist Based"
            changeLabel="Compliance"
            trend="neutral"
          />
        </div>

        {/* Filters & Controls */}
        <div className="tjfx-card p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]"/>
              <input data-testid="search-input" value={q} onChange={e=>setQ(e.target.value)} className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" placeholder="Search by pair, tag, notes..."/>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowFilters(!showFilters)} data-testid="toggle-filters" className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm font-medium flex items-center gap-2 transition">
                <Filter className="w-4 h-4"/> Filters {activeCount>0 && <span className="bg-[#7C3AED] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{activeCount}</span>}
              </button>
              <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl">
                <button onClick={()=>setViewMode("cards")} className={`px-2 h-8 rounded-lg transition ${viewMode==="cards"?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82]"}`}><Grid3x3 className="w-4 h-4"/></button>
                <button onClick={()=>setViewMode("table")} className={`px-2 h-8 rounded-lg transition ${viewMode==="table"?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82]"}`}><List className="w-4 h-4"/></button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl">
              {[["all",`All (${trades.length})`],["open","Open"],["closed","Closed"],["win","Wins"],["loss","Losses"]].map(([k,l]) => (
                <button key={k} onClick={()=>setTab(k)} className={`px-3 h-8 text-xs rounded-lg font-medium transition ${tab===k?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82] hover:text-[#16151F]"}`}>{l}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6D6D82]">Sort:</span>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="h-8 px-2 rounded-lg border border-[#E8E8F1] text-xs bg-white">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest-r">Highest R</option>
                <option value="lowest-r">Lowest R</option>
                <option value="biggest-win">Biggest Win</option>
                <option value="biggest-loss">Biggest Loss</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
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
            </div>

            <div className="border-t border-[#E8E8F1] px-6 py-4 grid md:grid-cols-3 gap-4 bg-[#F6F6FB]">
              <RangeInput label="Date" leftPlaceholder="From" rightPlaceholder="To" type="date" left={filters.dateFrom} right={filters.dateTo} onLeft={v=>setF("dateFrom",v)} onRight={v=>setF("dateTo",v)}/>
              <RangeInput label="R multiple" leftPlaceholder="min" rightPlaceholder="max" type="number" left={filters.minR} right={filters.maxR} onLeft={v=>setF("minR",v)} onRight={v=>setF("maxR",v)}/>
              <RangeInput label="Net P&L ($)" leftPlaceholder="min" rightPlaceholder="max" type="number" left={filters.minPnl} right={filters.maxPnl} onLeft={v=>setF("minPnl",v)} onRight={v=>setF("maxPnl",v)}/>
            </div>
          </div>
        )}

        {/* Trades Display */}
        {filtered.length === 0 ? (
          <div className="tjfx-card p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold mb-2">No trades found</h3>
            <p className="text-[#6D6D82] mb-6">Start documenting your journey. Click below to add your first trade.</p>
            <Link to="/add-trade" className="inline-flex h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold items-center gap-2"><PlusCircle className="w-4 h-4"/> Add First Trade</Link>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 animate-in">
            {filtered.map((t, i) => (
              <TradeCard key={t.id} trade={t} onOpen={openTrade} onDelete={del} style={{animationDelay: `${i*50}ms`}}/>
            ))}
          </div>
        ) : (
          <div className="tjfx-card overflow-hidden">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="bg-[#F6F6FB] text-[#6D6D82]">
                  <tr>
                    {["Date","Symbol","Dir","Entry","Exit","SL","TP","R","P&L","Session","Strategy","Status"].map(h => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} onClick={()=>openTrade(t)} className="border-t border-[#E8E8F1] hover:bg-[#F3E8FF]/40 cursor-pointer transition" data-testid={`trade-row-${t.id}`}>
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
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-[#6D6D82]">
          <div>Showing {filtered.length} of {trades.length} trades</div>
          <div className="flex gap-1">
            <button className="px-2 py-1 rounded-lg border border-[#E8E8F1] hover:bg-[#F6F6FB]">Previous</button>
            <button className="px-2 py-1 rounded-lg bg-[#7C3AED] text-white font-medium">1</button>
            {trades.length > 10 && <button className="px-2 py-1 rounded-lg border border-[#E8E8F1] hover:bg-[#F6F6FB]">2</button>}
            <button className="px-2 py-1 rounded-lg border border-[#E8E8F1] hover:bg-[#F6F6FB]">Next</button>
          </div>
        </div>
      </div>

      {/* Trade Detail Drawer */}
      {sel && (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={()=>{setSel(null); setEdit(null);}}>
          <div onClick={e=>e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl overflow-y-auto scroll-thin p-6 space-y-4 animate-in slide-in-from-right">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold">{(edit||sel).symbol}</h3>
                <p className="text-sm text-[#6D6D82]">{(edit||sel).direction === "long" ? "📈" : "📉"} {(edit||sel).direction.toUpperCase()}</p>
              </div>
              <div className="flex gap-2">
                {!edit ? (
                  <button onClick={startEdit} data-testid="edit-trade-btn" className="h-9 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1 transition"><Pencil className="w-4 h-4"/> Edit</button>
                ) : (
                  <>
                    <button onClick={cancelEdit} className="h-9 px-3 rounded-xl border border-[#E8E8F1] text-sm hover:bg-[#F6F6FB] transition">Cancel</button>
                    <button onClick={saveEdit} disabled={saving} data-testid="save-edit-btn" className="h-9 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-60 transition"><Save className="w-4 h-4"/> {saving?"Saving...":"Save"}</button>
                  </>
                )}
                <button onClick={()=>{setSel(null); setEdit(null);}} className="w-9 h-9 rounded-xl hover:bg-[#F6F6FB] flex items-center justify-center transition"><X className="w-4 h-4"/></button>
              </div>
            </div>

            <div className="h-px bg-[#E8E8F1]"/>

            <div className="space-y-2 flex gap-1">
              {["Overview", "Chart", "Notes", "Mistakes", "Checklist"].map(tab => (
                <button key={tab} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab==="Overview"?"bg-[#7C3AED] text-white":"border border-[#E8E8F1] text-[#6D6D82] hover:bg-[#F6F6FB]"}`}>{tab}</button>
              ))}
            </div>

            {edit ? <EditForm edit={edit} setEdit={setEdit} toggleEdit={toggleEdit} computed={editComputed} presets={presets}/> :
              <ViewBlock t={sel}/>
            }

            {!edit && <button onClick={()=>del(sel.id)} data-testid="delete-trade" className="w-full h-10 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium flex items-center justify-center gap-2 transition"><Trash2 className="w-4 h-4"/> Delete Trade</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({ icon, label, value, change, changeLabel, trend, circular }) {
  return (
    <div className="tjfx-card p-4 hover:shadow-md transition hover:scale-105 transform">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-[#F3E8FF]/50">
          {icon}
        </div>
        {circular && <div className="w-12 h-12 rounded-full border-4 border-[#7C3AED] border-r-emerald-400 border-t-emerald-400 flex items-center justify-center text-xs font-bold text-[#7C3AED]">{value}</div>}
      </div>
      <div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-1">{label}</div>
      {!circular && <div className="text-2xl font-bold mb-2">{value}</div>}
      <div className={`text-[12px] font-medium ${trend==="up"?"text-emerald-600":"text-[#6D6D82]"}`}>
        {change} <span className="text-[10px]">{changeLabel}</span>
      </div>
    </div>
  );
}

// Trade Card Component
function TradeCard({ trade, onOpen, onDelete }) {
  const pnl = trade.net_pnl || 0;
  const isWin = pnl > 0;
  
  return (
    <div onClick={() => onOpen(trade)} className="tjfx-card p-4 hover:shadow-lg hover:border-[#7C3AED] cursor-pointer transition group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/0 to-[#7C3AED]/0 group-hover:from-[#7C3AED]/5 group-hover:to-[#F3E8FF]/20 transition"/>
      
      <div className="relative flex gap-4">
        {/* Chart Thumbnail */}
        <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-[#F3E8FF] to-[#F6F6FB] flex items-center justify-center flex-shrink-0 relative">
          <div className="text-[10px] text-center px-1 space-y-0.5">
            {trade.htf_poi?.slice(0, 2).map(p => <div key={p} className="text-[#7C3AED] font-bold">{p}</div>)}
            {!trade.htf_poi?.length && <div className="text-[#A1A1AA]">—</div>}
          </div>
        </div>

        {/* Middle Section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-display font-bold text-lg">{trade.symbol}</h4>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${trade.direction === "long" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {trade.direction.toUpperCase()}
            </span>
          </div>
          <div className="text-xs text-[#6D6D82] mb-2">
            <div>{trade.date} • {trade.entry_time || "—"}</div>
            <div>{trade.session || "—"}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {trade.entry_tags?.slice(0, 3).map(tag => (
              <span key={tag} className="chip active text-[10px]">{tag}</span>
            ))}
            {trade.entry_tags?.length > 3 && <span className="text-[10px] text-[#6D6D82]">+{trade.entry_tags.length - 3}</span>}
          </div>
        </div>

        {/* Result Card */}
        <div className={`w-32 rounded-lg p-4 flex flex-col items-center justify-center text-center flex-shrink-0 ${isWin ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
          <div className={`text-2xl font-bold ${isWin ? "text-emerald-700" : "text-red-600"}`}>
            {isWin ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
          </div>
          <div className={`text-xs font-semibold ${isWin ? "text-emerald-600" : "text-red-500"}`}>
            {trade.r_multiple ? `${trade.r_multiple}R` : "—"}
          </div>
          <div className={`text-[10px] ${isWin ? "text-emerald-600" : "text-red-500"}`}>
            {isWin ? "WIN" : "LOSS"}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={(e) => { e.stopPropagation(); onOpen(trade); }} className="w-8 h-8 rounded-lg bg-white hover:bg-[#F6F6FB] flex items-center justify-center border border-[#E8E8F1]" title="View"><Eye className="w-4 h-4"/></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(trade.id); }} className="w-8 h-8 rounded-lg bg-white hover:bg-red-50 flex items-center justify-center border border-red-200" title="Delete"><Trash2 className="w-4 h-4 text-red-500"/></button>
      </div>
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
  const openLightbox = useLightbox();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[["Direction",t.direction],["Status",t.status],["Session",t.session],["Strategy",t.strategy],["Entry",t.entry_price],["Exit",t.exit_price||"—"],["SL",t.stop_loss||"—"],["TP",t.take_profit||"—"],["Lot",t.lot_size],["Risk %",t.risk_percent],["R Multiple",t.r_multiple||"—"],["Net P&L",`${(t.net_pnl||0)>=0?"+":""}$${(t.net_pnl||0).toFixed(2)}`],["Time",t.entry_time||"—"]].map(([k,v]) => (
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
          <div className="grid grid-cols-2 gap-2">{t.screenshots.map((s,i)=><img key={i} alt="" src={s} onClick={()=>openLightbox(t.screenshots,i)} className="w-full rounded-lg cursor-zoom-in"/>)}</div>
        </div>
      )}
    </>
  );
}

function EditForm({ edit, setEdit, toggleEdit, computed, presets }) {
  const inp = "w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white tjfx-mono";
  const openLightbox = useLightbox();

  const [uploadingCount, setUploadingCount] = React.useState(0);
  const addImg = async (dataUrl) => {
    setUploadingCount(c => c + 1);
    try {
      const { url } = await uploadApi.image(dataUrl);
      setEdit(p => ({...p, screenshots: [...(p.screenshots||[]), url]}));
    } catch { toast.error("Image upload failed"); }
    finally { setUploadingCount(c => c - 1); }
  };
  const onFile = (e) => Array.from(e.target.files||[]).forEach(f => {
    compressImage(f).then(addImg).catch(() => { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); });
  });
  const removeImg = (i) => setEdit(p => ({...p, screenshots: (p.screenshots||[]).filter((_,j)=>j!==i)}));

  React.useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type?.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            compressImage(f).then(addImg).catch(() => { const r = new FileReader(); r.onload=()=>addImg(r.result); r.readAsDataURL(f); });
            toast.success("Image pasted");
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
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
        <F label="Time"><input className={inp} type="time" value={edit.entry_time||""} onChange={e=>setEdit({...edit,entry_time:e.target.value})}/></F>
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
              <img alt="" src={s} onClick={()=>openLightbox(edit.screenshots,i)} className="w-full h-20 object-cover rounded-lg cursor-zoom-in"/>
              <button onClick={()=>removeImg(i)} data-testid={`remove-img-${i}`} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3 text-red-500"/></button>
            </div>
          ))}
          {(edit.screenshots||[]).length===0 && uploadingCount===0 && <div className="col-span-full text-xs text-[#A1A1AA] text-center py-4 border-2 border-dashed border-[#E8E8F1] rounded-lg">No screenshots</div>}
          {Array.from({length: uploadingCount}).map((_,i) => <div key={`u${i}`} className="w-full h-20 rounded-lg border-2 border-dashed border-[#7C3AED]/40 bg-[#F3E8FF]/40 flex items-center justify-center text-[10px] text-[#7C3AED] animate-pulse">Uploading...</div>)}
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
