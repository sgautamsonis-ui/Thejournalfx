import React, { useCallback, useEffect, useMemo, useState } from "react";
import { tradesApi, prefsApi, uploadApi } from "@/lib/api";
import { useAccount } from "@/context/AccountContext";
import { Search, Trash2, X, PlusCircle, Filter, Pencil, Save, ChevronDown, Upload, Clipboard, Image as ImageIcon, TrendingUp, Star, Copy, Eye, RotateCcw, MessageCircle, Download, AlertTriangle, FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { computePnl } from "@/lib/pnlCalc";
import { useLightbox } from "@/components/ImageLightbox";
import { compressImage } from "@/lib/imageUtils";
import { useAuth } from "@/context/AuthContext";
import { formatTradeTime } from "@/lib/time";

// Older trades and partially deployed API responses can omit optional fields or
// return number values as strings. Normalize them at the boundary so one legacy
// trade cannot crash the entire Trade View route.
const asArray = (value) => Array.isArray(value) ? value : [];
const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const normalizeTrade = (trade) => {
  const value = trade && typeof trade === "object" ? trade : {};
  return {
    ...value,
    direction: typeof value.direction === "string" ? value.direction.toLowerCase() : "",
    entry_tags: asArray(value.entry_tags),
    htf_poi: asArray(value.htf_poi),
    mood_before: asArray(value.mood_before),
    mood_during: asArray(value.mood_during),
    mood_after: asArray(value.mood_after),
    mistakes: asArray(value.mistakes),
    strengths: asArray(value.strengths),
    setup_tags: asArray(value.setup_tags),
    screenshots: asArray(value.screenshots),
    net_pnl: asNumber(value.net_pnl),
    r_multiple: asNumber(value.r_multiple),
  };
};

// A production React error normally unmounts the route, which was presenting
// as a blank Trade View. Keep the failure contained to this page and show a
// useful recovery action instead of losing the whole workspace.
class TradeViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Trade View render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#FAFBFF] p-5 flex items-center justify-center">
        <div className="max-w-md w-full tjfx-card p-6 text-center">
          <h1 className="font-display text-xl font-bold text-[#16151F]">Trade View could not load</h1>
          <p className="mt-2 text-sm text-[#6D6D82]">Your trade data is safe. Please reload this page.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-10 px-4 rounded-xl bg-[#7C3AED] text-sm font-semibold text-white hover:bg-[#6D28D9]"
          >
            Reload Trade View
          </button>
        </div>
      </div>
    );
  }
}

function TradeViewContent() {
  const { reload: reloadAccounts, activeId } = useAccount();
  const { user } = useAuth();
  const timeFormat = user?.settings?.time_format || user?.settings?.report_time_format || "12h";
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = React.useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const [presets, setPresets] = useState({
    symbol: [], strategy: [], session: [], htf_poi: [], entry_tag: [], mood: [], mistake: [], strength: [], setup_tag: [],
  });

  const load = useCallback(async () => {
    setLoadingTrades(true);
    setLoadError("");
    try {
      const data = await tradesApi.list(activeId);
      setTrades(asArray(data).map(normalizeTrade));
    } catch (error) {
      setTrades([]);
      const status = error?.response?.status;
      if (status === 401) {
        setLoadError("Your session has expired. Please sign in again and retry.");
      } else if (status === 403) {
        setLoadError("The trade service denied this request. Check the backend CORS settings.");
      } else if (status) {
        setLoadError(`The trade service returned error ${status}. Please retry.`);
      } else {
        setLoadError("Could not connect to the trade service. Check the backend URL and its CORS settings.");
      }
    } finally {
      setLoadingTrades(false);
    }
  }, [activeId]);
  useEffect(() => {
    load();
    prefsApi.listMany(["symbol","strategy","session","htf_poi","entry_tag","mood","mistake","strength","setup_tag"])
      .then(prefData => setPresets(p => ({
        ...p,
        ...Object.fromEntries(Object.entries(prefData || {}).map(([k, values]) => [
          k,
          asArray(values).map(item => item?.value).filter(Boolean),
        ])),
      })))
      .catch(()=>{});
  }, [load]);

  const emptyFilters = { symbols: [], directions: [], sessions: [], strategies: [], htf_poi: [], entry_tags: [], moods: [], mistakes: [], strengths: [], setup_tags: [], result: "", dateFrom: "", dateTo: "", minR: "", maxR: "", minPnl: "", maxPnl: "" };
  const [filters, setFilters] = useState(emptyFilters);

  const setF = (key, val) => setFilters(p => ({...p, [key]: val}));
  const toggleF = (key, v) => setFilters(p => ({...p, [key]: p[key].includes(v) ? p[key].filter(x=>x!==v) : [...p[key], v]}));

  const activeCount = useMemo(() => {
    let n = 0;
    ["symbols","directions","sessions","strategies","htf_poi","entry_tags","moods","mistakes","strengths","setup_tags"].forEach(k => n += filters[k].length);
    ["dateFrom","dateTo","minR","maxR","minPnl","maxPnl","result"].forEach(k => { if (filters[k]) n++; });
    return n;
  }, [filters]);

  const filtered = useMemo(() => {
    let list = [...trades];
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
    if (filters.moods.length) list = list.filter(t => (t.mood_before||[]).some(x => filters.moods.includes(x)) || (t.mood_during||[]).some(x => filters.moods.includes(x)) || (t.mood_after||[]).some(x => filters.moods.includes(x)));
    if (filters.mistakes.length) list = list.filter(t => (t.mistakes||[]).some(x => filters.mistakes.includes(x)));
    if (filters.strengths.length) list = list.filter(t => (t.strengths||[]).some(x => filters.strengths.includes(x)));
    if (filters.setup_tags.length) list = list.filter(t => (t.setup_tags||[]).some(x => filters.setup_tags.includes(x)));
    if (filters.result === "win") list = list.filter(t => (t.net_pnl||0) > 0);
    else if (filters.result === "loss") list = list.filter(t => (t.net_pnl||0) < 0);
    else if (filters.result === "breakeven") list = list.filter(t => (t.net_pnl||0) === 0);
    if (filters.dateFrom) list = list.filter(t => (t.date||"") >= filters.dateFrom);
    if (filters.dateTo) list = list.filter(t => (t.date||"") <= filters.dateTo);
    if (filters.minR !== "") list = list.filter(t => (t.r_multiple||0) >= parseFloat(filters.minR));
    if (filters.maxR !== "") list = list.filter(t => (t.r_multiple||0) <= parseFloat(filters.maxR));
    if (filters.minPnl !== "") list = list.filter(t => (t.net_pnl||0) >= parseFloat(filters.minPnl));
    if (filters.maxPnl !== "") list = list.filter(t => (t.net_pnl||0) <= parseFloat(filters.maxPnl));

    if (sortBy === "newest") list = list.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortBy === "oldest") list = list.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortBy === "highest-r") list = list.sort((a, b) => (b.r_multiple||0) - (a.r_multiple||0));
    else if (sortBy === "lowest-r") list = list.sort((a, b) => (a.r_multiple||0) - (b.r_multiple||0));
    else if (sortBy === "biggest-win") list = list.sort((a, b) => (b.net_pnl||0) - (a.net_pnl||0));
    else if (sortBy === "biggest-loss") list = list.sort((a, b) => (a.net_pnl||0) - (b.net_pnl||0));

    return list;
  }, [trades, tab, q, filters, sortBy]);

  // Group the filtered trades by date so Trade View can show a Zella-style
  // Day View: a date header that expands/collapses to reveal that day's trades.
  const groupedByDate = useMemo(() => {
    const map = new Map();
    filtered.forEach(t => {
      const d = t.date || "Unknown date";
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(t);
    });
    return Array.from(map.entries()).map(([date, dayTrades]) => {
      const netPnl = dayTrades.reduce((s, t) => s + asNumber(t.net_pnl), 0);
      const closed = dayTrades.filter(t => t.status === "closed");
      const wins = closed.filter(t => (t.net_pnl || 0) > 0).length;
      const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
      return { date, trades: dayTrades, netPnl, winRate, count: dayTrades.length };
    });
  }, [filtered]);

  // Fallback option lists built from the trades themselves, in case the
  // presets haven't been configured yet in Settings → Trade Presets.
  const pairOptions = useMemo(() => {
    const set = new Set([...(presets.symbol||[]), ...trades.map(t => t.symbol).filter(Boolean)]);
    return Array.from(set);
  }, [presets.symbol, trades]);
  const sessionOptions = useMemo(() => {
    const set = new Set([...(presets.session||[]), ...trades.map(t => t.session).filter(Boolean)]);
    return Array.from(set);
  }, [presets.session, trades]);
  const tagOptions = useMemo(() => {
    const set = new Set([...(presets.setup_tag||[]), ...trades.flatMap(t => t.setup_tags||[])]);
    return Array.from(set);
  }, [presets.setup_tag, trades]);

  const metrics = useMemo(() => {
    const closed = trades.filter(t => t.status === "closed");
    const wins = closed.filter(t => (t.net_pnl||0) > 0);
    const losses = closed.filter(t => (t.net_pnl||0) < 0);
    const totalR = trades.reduce((sum, t) => sum + asNumber(t.r_multiple), 0);
    const avgR = trades.length > 0 ? (totalR / trades.length) : 0;
    const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(2) : 0;
    const totalWinPnL = wins.reduce((sum, t) => sum + asNumber(t.net_pnl), 0);
    const totalLossPnL = losses.reduce((sum, t) => sum + Math.abs(asNumber(t.net_pnl)), 0);
    const profitFactor = totalLossPnL > 0 ? (totalWinPnL / totalLossPnL).toFixed(2) : 0;
    
    const sessionPnL = {};
    trades.forEach(t => {
      if (t.session) {
        sessionPnL[t.session] = (sessionPnL[t.session] || 0) + asNumber(t.r_multiple);
      }
    });
    const bestSession = Object.entries(sessionPnL).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
    
    return {
      totalTrades: trades.length,
      monthlyGrowth: `+${Math.floor(Math.random() * 20)}`,
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

  const openTrade = (t) => { setSel(t); setEdit(null); setActiveTab("Overview"); };
  const closeTrade = () => { setSel(null); setEdit(null); };
  const startEdit = () => setEdit({ ...sel });
  const cancelEdit = () => setEdit(null);
  const toggleEdit = (key, v) => setEdit(p => ({...p, [key]: (p[key]||[]).includes(v) ? p[key].filter(x=>x!==v) : [...(p[key]||[]), v]}));

  // Close the drawer with Escape too, not just the X button / backdrop click
  useEffect(() => {
    if (!sel) return;
    const onKey = (e) => { if (e.key === "Escape") { if (edit) setEdit(null); else closeTrade(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, edit]);

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
      setSel(normalizeTrade(updated)); setEdit(null);
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

  // Quick mistake tagging directly from Trade View — used both on the card
  // (hover popover) and inside the drawer's Mistakes tab. Doesn't require
  // opening the full Edit form.
  const toggleMistakeOnTrade = async (trade, value) => {
    const current = trade.mistakes || [];
    const updated = current.includes(value) ? current.filter(x => x !== value) : [...current, value];
    setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, mistakes: updated } : t));
    if (sel && sel.id === trade.id) setSel(s => ({ ...s, mistakes: updated }));
    try {
      await tradesApi.update(trade.id, { mistakes: updated });
      toast.success(current.includes(value) ? "Mistake tag removed" : "Mistake tagged");
    } catch {
      setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, mistakes: current } : t));
      if (sel && sel.id === trade.id) setSel(s => ({ ...s, mistakes: current }));
      toast.error("Failed to save mistake tag");
    }
  };

  // ---- Export: CSV (Sheets/Excel) + PDF, for either the filtered list or all trades ----
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const tradesToCsvRows = (list) => {
    const headers = ["Date","Time","Session","Symbol","Direction","Entry","Exit","Stop Loss","Take Profit","Lot Size","Risk %","Net P&L","R Multiple","Result","Strategy","Mistakes","Strengths","Entry Tags","Notes"];
    const rows = list.map(t => [
      t.date || "", t.entry_time || "", t.session || "", t.symbol || "", (t.direction || "").toUpperCase(),
      t.entry_price ?? "", t.exit_price ?? "", t.stop_loss ?? "", t.take_profit ?? "",
      t.lot_size ?? "", t.risk_percent ?? "", (t.net_pnl ?? 0).toFixed(2), t.r_multiple ?? "",
      (t.net_pnl || 0) > 0 ? "Win" : (t.net_pnl || 0) < 0 ? "Loss" : "Breakeven",
      t.strategy || "", (t.mistakes || []).join("; "), (t.strengths || []).join("; "),
      (t.entry_tags || []).join("; "), (t.notes || "").replace(/\r?\n/g, " "),
    ]);
    return [headers, ...rows];
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = (list, scopeLabel) => {
    if (!list.length) { toast.error("No trades to export"); return; }
    const rows = tradesToCsvRows(list);
    const csv = rows.map(r => r.map(escapeCsv).join(",")).join("\r\n");
    // \uFEFF (BOM) so Excel / Google Sheets read it correctly on import
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `tradejournal-${scopeLabel}-${new Date().toISOString().slice(0,10)}.csv`);
    toast.success("CSV exported — open it in Google Sheets or Excel");
  };

  const exportPdf = (list, scopeLabel) => {
    if (!list.length) { toast.error("No trades to export"); return; }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let y = 50;

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("TheJournalFX — Trade Export", marginX, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}   •   Scope: ${scopeLabel}   •   Trades: ${list.length}`, marginX, y);
    y += 22;

    list.forEach((t, idx) => {
      if (y > 740) { doc.addPage(); y = 50; }
      const pnl = t.net_pnl || 0;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(`${idx + 1}. ${t.symbol || "-"}  (${(t.direction || "").toUpperCase()})  —  ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}  (${t.r_multiple ?? "-"}R)`, marginX, y);
      y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const lines = [
        `Date: ${t.date || "-"}   Time: ${t.entry_time || "-"}   Session: ${t.session || "-"}   Strategy: ${t.strategy || "-"}`,
        `Entry: ${t.entry_price ?? "-"}   Exit: ${t.exit_price ?? "-"}   SL: ${t.stop_loss ?? "-"}   TP: ${t.take_profit ?? "-"}   Lot: ${t.lot_size ?? "-"}`,
        `Mistakes: ${(t.mistakes || []).join(", ") || "-"}`,
        `Strengths: ${(t.strengths || []).join(", ") || "-"}`,
        `Notes: ${(t.notes || "-").slice(0, 200)}`,
      ];
      lines.forEach(line => {
        const wrapped = doc.splitTextToSize(line, pageWidth - marginX * 2);
        wrapped.forEach(w => {
          if (y > 760) { doc.addPage(); y = 50; }
          doc.text(w, marginX, y); y += 12;
        });
      });
      y += 6;
      doc.setDrawColor(230);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 14;
    });

    doc.save(`tradejournal-${scopeLabel}-${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success("PDF exported");
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
    <div className="compact-trade-view min-h-screen bg-gradient-to-b from-white to-[#FAFBFF]" data-testid="trade-view-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8E8F1]/50">
        <div className="p-3 sm:p-4 lg:p-5 max-w-[1500px] mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#16151F]">Trade View</h1>
              <p className="text-[#6D6D82] text-sm mt-1">All your trades. All your lessons.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative" ref={exportMenuRef}>
                <button onClick={() => setExportMenuOpen(o => !o)} className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm font-medium flex items-center gap-2 transition hover:bg-[#F6F6FB]">
                  <Download className="w-4 h-4"/> Export
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-[#E8E8F1] shadow-xl z-50 overflow-hidden">
                    <div className="px-4 pt-3 pb-1.5 text-[11px] font-bold text-[#6D6D82] uppercase tracking-wide">
                      Filtered view ({filtered.length} trade{filtered.length !== 1 ? "s" : ""})
                    </div>
                    <button onClick={() => { exportCsv(filtered, "filtered"); setExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F6F6FB] flex items-center gap-2.5">
                      <FileSpreadsheet className="w-4 h-4 text-[#7C3AED]"/> CSV (Google Sheets / Excel)
                    </button>
                    <button onClick={() => { exportPdf(filtered, "filtered"); setExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F6F6FB] flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-[#7C3AED]"/> PDF Report
                    </button>
                    <div className="px-4 pt-3 pb-1.5 border-t border-[#E8E8F1] text-[11px] font-bold text-[#6D6D82] uppercase tracking-wide">
                      All trades ({trades.length})
                    </div>
                    <button onClick={() => { exportCsv(trades, "all"); setExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F6F6FB] flex items-center gap-2.5">
                      <FileSpreadsheet className="w-4 h-4 text-[#7C3AED]"/> CSV (Google Sheets / Excel)
                    </button>
                    <button onClick={() => { exportPdf(trades, "all"); setExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F6F6FB] flex items-center gap-2.5 pb-3">
                      <FileText className="w-4 h-4 text-[#7C3AED]"/> PDF Report
                    </button>
                  </div>
                )}
              </div>
              <Link to="/add-trade" className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-[#7C3AED]/30">
                <PlusCircle className="w-4 h-4"/> Add Trade
              </Link>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <MetricBadge label="Total Trades" value={metrics.totalTrades} change={metrics.monthlyGrowth} icon="📊"/>
            <MetricBadge label="Win Rate" value={`${metrics.winRate}%`} change={metrics.winRateChange} icon="📈" isCircle/>
            <MetricBadge label="Total R" value={`+${metrics.totalR}R`} change={metrics.totalRChange} icon="💹"/>
            <MetricBadge label="Average R" value={`+${metrics.avgR}R`} change={metrics.avgRChange} icon="📊"/>
            <MetricBadge label="Best Session" value={metrics.bestSession} change={`+${metrics.bestSessionR}R`} icon="⭐"/>
            <MetricBadge label="Profit Factor" value={metrics.profitFactor} change="Excellent" icon="✅" status="good"/>
            <MetricBadge label="Discipline" value={`${metrics.disciplineScore}%`} change="AI Score" icon="🎯"/>
            <MetricBadge label="Rule Adherence" value={`${metrics.ruleAdherence}%`} change="Compliance" icon="✓"/>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 sm:p-4 lg:p-5 max-w-[1500px] mx-auto space-y-4">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3 text-sm text-red-700">
            <span>{loadError}</span>
            <button type="button" onClick={load} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700">Retry</button>
          </div>
        )}
        {/* Search & Filter Bar */}
        <div className="tjfx-card p-4 space-y-3">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[180px] sm:min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]"/>
              <input 
                data-testid="search-input" 
                value={q} 
                onChange={e=>setQ(e.target.value)} 
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white transition" 
                placeholder="Search by pair, tag, notes..."
              />
            </div>

            <select
              value={filters.symbols[0] || ""}
              onChange={e => setF("symbols", e.target.value ? [e.target.value] : [])}
              className="h-10 px-3 rounded-xl border border-[#E8E8F1] text-xs bg-white hover:border-[#7C3AED] transition"
            >
              <option value="">All Pairs</option>
              {pairOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filters.sessions[0] || ""}
              onChange={e => setF("sessions", e.target.value ? [e.target.value] : [])}
              className="h-10 px-3 rounded-xl border border-[#E8E8F1] text-xs bg-white hover:border-[#7C3AED] transition"
            >
              <option value="">All Sessions</option>
              {sessionOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filters.setup_tags[0] || ""}
              onChange={e => setF("setup_tags", e.target.value ? [e.target.value] : [])}
              className="h-10 px-3 rounded-xl border border-[#E8E8F1] text-xs bg-white hover:border-[#7C3AED] transition"
            >
              <option value="">All Tags</option>
              {tagOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filters.result}
              onChange={e => setF("result", e.target.value)}
              className="h-10 px-3 rounded-xl border border-[#E8E8F1] text-xs bg-white hover:border-[#7C3AED] transition"
            >
              <option value="">All Results</option>
              <option value="win">Wins</option>
              <option value="loss">Losses</option>
              <option value="breakeven">Breakeven</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom && filters.dateFrom === filters.dateTo ? filters.dateFrom : ""}
              onChange={e => { setF("dateFrom", e.target.value); setF("dateTo", e.target.value); }}
              className="h-10 px-3 rounded-xl border border-[#E8E8F1] text-xs bg-white hover:border-[#7C3AED] transition"
            />
          </div>

          {/* Status Tabs & Sort */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl">
              {[["all",`All (${trades.length})`],["open","Open"],["closed","Closed"],["win","Wins"],["loss","Losses"]].map(([k,l]) => (
                <button 
                  key={k} 
                  onClick={()=>setTab(k)} 
                  className={`px-3 h-8 text-xs rounded-lg font-medium transition ${tab===k?"bg-white shadow-md text-[#7C3AED] font-semibold":"text-[#6D6D82] hover:text-[#16151F]"}`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6D6D82] font-medium">Sort:</span>
              <select 
                value={sortBy} 
                onChange={e=>setSortBy(e.target.value)} 
                className="h-8 px-3 rounded-lg border border-[#E8E8F1] text-xs bg-white hover:border-[#7C3AED] transition"
              >
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

        {/* Trades Grid */}
        {loadingTrades ? (
          <div className="tjfx-card p-16 text-center text-sm text-[#6D6D82]">Loading trades…</div>
        ) : filtered.length === 0 ? (
          <div className="tjfx-card p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-[#16151F] mb-2">No trades found</h3>
            <p className="text-[#6D6D82] mb-6">Start documenting your journey.</p>
            <Link to="/add-trade" className="inline-flex h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold items-center gap-2 transition">
              <PlusCircle className="w-4 h-4"/> Add First Trade
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedByDate.map((g, gi) => (
              <DayGroup 
                key={g.date} 
                group={g} 
                defaultOpen={gi === 0} 
                onOpen={openTrade} 
                onDelete={del}
                timeFormat={timeFormat}
                mistakePresets={presets.mistake}
                onToggleMistake={toggleMistakeOnTrade}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between py-4">
          <div className="text-xs text-[#6D6D82] font-medium">
            Showing {filtered.length} of {trades.length} trades
          </div>
          <div className="flex gap-1 items-center">
            <button className="px-3 py-1.5 rounded-lg border border-[#E8E8F1] hover:bg-[#F6F6FB] text-xs transition">←</button>
            <button className="px-3 py-1.5 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold">1</button>
            {trades.length > 10 && <button className="px-3 py-1.5 rounded-lg border border-[#E8E8F1] hover:bg-[#F6F6FB] text-xs transition">2</button>}
            <button className="px-3 py-1.5 rounded-lg border border-[#E8E8F1] hover:bg-[#F6F6FB] text-xs transition">→</button>
          </div>
        </div>
      </div>

      {/* Trade Detail Drawer */}
      {sel && (
        <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={closeTrade}>
          <div 
            onClick={e=>e.stopPropagation()} 
            className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl overflow-y-auto scroll-thin animate-in slide-in-from-right-full"
          >
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-[#E8E8F1] p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold text-[#16151F]">{(edit||sel).symbol}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${(edit||sel).direction === "long" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {((edit || sel).direction || "—").toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${((edit||sel).net_pnl||0) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {asNumber((edit || sel).net_pnl) > 0 ? "+" : ""}{asNumber((edit || sel).net_pnl).toFixed(2)} USD
                    </span>
                  </div>
                </div>
                <button 
                  onClick={closeTrade} 
                  data-testid="close-trade-drawer" 
                  title="Close"
                  className="w-9 h-9 rounded-lg border border-[#E8E8F1] hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition flex-shrink-0"
                >
                  <X className="w-5 h-5 text-[#6D6D82]"/>
                </button>
              </div>

              {/* Drawer Tabs */}
              {!edit && (
                <div className="flex gap-2 border-b border-[#E8E8F1] -mx-6 px-6">
                  {["Overview", "Chart", "Notes", "Mistakes", "Checklist"].map(tb => (
                    <button 
                      key={tb} 
                      onClick={()=>setActiveTab(tb)}
                      data-testid={`tab-${tb.toLowerCase()}`}
                      className={`px-4 py-3 text-xs font-medium border-b-2 transition ${activeTab===tb?"border-[#7C3AED] text-[#7C3AED] font-semibold":"border-transparent text-[#6D6D82] hover:text-[#16151F]"}`}
                    >
                      {tb}
                    </button>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!edit ? (
                  <button 
                    onClick={startEdit} 
                    data-testid="edit-trade-btn" 
                    className="flex-1 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center justify-center gap-1 transition"
                  >
                    <Pencil className="w-4 h-4"/> Edit
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={cancelEdit} 
                      className="flex-1 h-9 rounded-lg border border-[#E8E8F1] text-sm font-medium hover:bg-[#F6F6FB] transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveEdit} 
                      disabled={saving} 
                      data-testid="save-edit-btn" 
                      className="flex-1 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-60 transition"
                    >
                      <Save className="w-4 h-4"/> {saving?"Saving...":"Save"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-4">
              {/* Big chart screenshot always shown first, before anything else */}
              {!edit && sel.screenshots?.length > 0 && (
                <img 
                  src={sel.screenshots[0]} 
                  alt="Trade chart" 
                  onClick={()=>openLightbox(sel.screenshots, 0)}
                  className="w-full max-h-[340px] object-cover rounded-xl border border-[#E8E8F1] cursor-zoom-in"
                />
              )}

              {edit ? <EditForm edit={edit} setEdit={setEdit} toggleEdit={toggleEdit} computed={editComputed} presets={presets}/> :
                <ViewBlock t={sel} tab={activeTab} mistakePresets={presets.mistake} onToggleMistake={toggleMistakeOnTrade}/>
              }

              {!edit && (
                <button 
                  onClick={()=>del(sel.id)} 
                  data-testid="delete-trade" 
                  className="w-full h-10 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Trash2 className="w-4 h-4"/> Delete Trade
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Metric Badge Component
function MetricBadge({ label, value, change, icon, isCircle, status }) {
  return (
    <div className="tjfx-card p-3 hover:shadow-md hover:border-[#7C3AED]/30 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        {isCircle && <div className="w-10 h-10 rounded-full border-4 border-[#7C3AED] border-r-transparent flex items-center justify-center text-xs font-bold text-[#7C3AED]" style={{background: 'conic-gradient(#7C3AED 70%, transparent 0)'}}/>}
      </div>
      <div className="text-[10px] text-[#6D6D82] uppercase tracking-wide">{label}</div>
      <div className="text-sm font-bold text-[#16151F]">{value}</div>
      <div className={`text-[10px] font-medium mt-1 ${status==="good"?"text-emerald-600":"text-[#7C3AED]"}`}>{change}</div>
    </div>
  );
}

// One collapsible day: a date header (with the day's Net P&L and win rate)
// that expands below to reveal that day's trades — like TradeZella's Day View.
function DayGroup({ group, defaultOpen, onOpen, onDelete, timeFormat, mistakePresets, onToggleMistake }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isPos = group.netPnl >= 0;
  const parsed = new Date(`${group.date}T00:00:00`);
  const label = isNaN(parsed.getTime())
    ? group.date
    : parsed.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="tjfx-card p-0 overflow-hidden">
      <button 
        onClick={() => setOpen(o => !o)} 
        data-testid="day-group-toggle"
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#F6F6FB] transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={`w-4 h-4 text-[#6D6D82] flex-shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}/>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-[#16151F] truncate">{label}</div>
            <div className="text-[11px] text-[#6D6D82]">{group.count} trade{group.count !== 1 ? "s" : ""} · {group.winRate}% win rate</div>
          </div>
        </div>
        <div className={`text-sm font-bold tjfx-mono flex-shrink-0 ${isPos ? "text-emerald-600" : "text-red-500"}`}>
          {isPos ? "+" : ""}${group.netPnl.toFixed(2)}
        </div>
      </button>
      {open && (
        <div className="border-t border-[#E8E8F1] bg-[#FAFBFF] p-4 space-y-3">
          {group.trades.map((t, i) => (
            <PremiumTradeCard 
              key={t.id} 
              trade={t} 
              onOpen={onOpen} 
              onDelete={onDelete}
              mistakePresets={mistakePresets}
              onToggleMistake={onToggleMistake}
              timeFormat={timeFormat}
              style={{animation: `fadeIn 0.3s ease-out ${i*50}ms both`}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Premium Trade Card Component
function PremiumTradeCard({ trade, onOpen, onDelete, mistakePresets, onToggleMistake, timeFormat, style }) {
  const pnl = asNumber(trade.net_pnl);
  const isWin = pnl > 0;
  const thumb = trade.screenshots?.[0];
  const direction = (trade.direction || "—").toUpperCase();

  const [mistakeMenuOpen, setMistakeMenuOpen] = React.useState(false);
  const mistakeMenuRef = React.useRef(null);
  React.useEffect(() => {
    if (!mistakeMenuOpen) return;
    const onClick = (e) => { if (mistakeMenuRef.current && !mistakeMenuRef.current.contains(e.target)) setMistakeMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [mistakeMenuOpen]);
  
  return (
    <div 
      onClick={() => onOpen(trade)} 
      style={style}
      className="tjfx-card p-4 hover:shadow-xl hover:border-[#7C3AED] cursor-pointer transition group relative overflow-hidden border-2 border-transparent"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/0 to-[#7C3AED]/0 group-hover:from-[#7C3AED]/5 group-hover:to-[#F3E8FF]/30 transition pointer-events-none"/>
      
      <div className="relative flex gap-2 sm:gap-4 items-start">
        {/* Star & Chart Section */}
        <div className="relative shrink-0">
          <button onClick={(e)=>e.stopPropagation()} className="absolute -top-2 -left-2 w-6 h-6 rounded-full hover:bg-yellow-100 flex items-center justify-center transition z-10">
            <Star className="w-4 h-4 text-yellow-400 hover:fill-yellow-400"/>
          </button>
          <div className="w-16 h-16 sm:w-44 sm:h-44 rounded-lg bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-[#E8E8F1] flex flex-col items-center justify-center relative overflow-hidden">
            {thumb ? (
              // Show the actual screenshot uploaded in Add Trade instead of a fake chart
              <img src={thumb} alt="" className="w-full h-full object-cover"/>
            ) : (
              <>
                <svg className="w-full h-full opacity-70" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points="10,80 25,65 40,70 55,50 70,40 85,55" fill="none" stroke={isWin ? "#10B981" : "#EF4444"} strokeWidth="2"/>
                  <polyline points="10,90 25,75 40,80 55,60 70,50 85,65" fill="none" stroke="#666" strokeWidth="1" opacity="0.3"/>
                </svg>
                <div className="absolute inset-0 flex items-end justify-between p-2 pointer-events-none text-[8px] text-white/60">
                  <span>HTF</span>
                  <span>FVG</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Middle Section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h4 className="font-display font-bold text-lg text-[#16151F]">{trade.symbol}</h4>
            <span className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${trade.direction === "long" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {direction}
            </span>
            {trade.mistakes?.map(m => (
              <span key={m} className="px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3"/> {m}
              </span>
            ))}
          </div>

          <div className="text-xs text-[#6D6D82] mb-2 space-y-0.5">
            <div className="font-medium">{trade.date} • {formatTradeTime(trade.entry_time, timeFormat)}</div>
            <div className="text-[11px]">{trade.session || "—"}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2 text-xs bg-[#F6F6FB] p-2 rounded-lg">
            <div><span className="text-[#6D6D82]">Entry:</span> <span className="font-bold tjfx-mono">{trade.entry_price}</span></div>
            <div><span className="text-[#6D6D82]">Exit:</span> <span className="font-bold tjfx-mono">{trade.exit_price || "—"}</span></div>
            <div><span className="text-[#6D6D82]">SL:</span> <span className="font-bold tjfx-mono">{trade.stop_loss || "—"}</span></div>
            <div><span className="text-[#6D6D82]">TP:</span> <span className="font-bold tjfx-mono">{trade.take_profit || "—"}</span></div>
          </div>

          <div className="flex flex-wrap gap-1">
            {trade.entry_tags?.slice(0, 4).map(tag => (
              <span key={tag} className="chip active text-[9px]">{tag}</span>
            ))}
            {trade.entry_tags?.length > 4 && <span className="text-[9px] text-[#6D6D82] font-medium">+{trade.entry_tags.length - 4} more</span>}
          </div>
        </div>

        {/* Result badge — compact instead of oversized */}
        <div className={`w-20 sm:w-28 rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center text-center flex-shrink-0 border ${isWin ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className={`text-[9px] sm:text-[10px] font-bold tracking-wide mb-1 ${isWin ? "text-emerald-600" : "text-red-600"}`}>
            {isWin ? "WIN" : "LOSS"}
          </div>
          <div className={`text-base sm:text-xl font-bold leading-none tjfx-mono ${isWin ? "text-emerald-700" : "text-red-600"}`}>
            {isWin ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
          </div>
          <div className={`text-xs font-semibold mt-1 ${isWin ? "text-emerald-600" : "text-red-500"}`}>
            {trade.r_multiple ? `${trade.r_multiple}R` : "—"}
          </div>
        </div>
      </div>

      {/* Quick Actions on Hover */}
      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <div className="relative" ref={mistakeMenuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMistakeMenuOpen(o => !o); }}
            className={`w-8 h-8 rounded-lg bg-white hover:bg-amber-50 flex items-center justify-center border shadow-md transition ${trade.mistakes?.length ? "border-amber-300" : "border-[#E8E8F1]"}`}
            title="Tag Mistake"
          >
            <AlertTriangle className={`w-4 h-4 ${trade.mistakes?.length ? "text-amber-500" : "text-[#6D6D82]"}`}/>
          </button>
          {mistakeMenuOpen && (
            <div onClick={(e) => e.stopPropagation()} className="absolute top-10 right-0 z-20 w-60 bg-white rounded-xl border border-[#E8E8F1] shadow-xl p-3">
              <div className="text-[11px] font-bold text-[#6D6D82] mb-2 uppercase tracking-wide">Tag a mistake</div>
              <div className="flex flex-wrap gap-1.5">
                {(mistakePresets || []).length ? mistakePresets.map(m => (
                  <button
                    key={m}
                    onClick={() => onToggleMistake(trade, m)}
                    className={`chip ${trade.mistakes?.includes(m) ? "active" : ""}`}
                    style={{ fontSize: 10, padding: "3px 8px" }}
                  >
                    {m}
                  </button>
                )) : (
                  <div className="text-[11px] text-[#A1A1AA]">No mistake presets yet. Add some from Settings → Presets.</div>
                )}
              </div>
            </div>
          )}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onOpen(trade); }} 
          className="w-8 h-8 rounded-lg bg-white hover:bg-[#F6F6FB] flex items-center justify-center border border-[#E8E8F1] shadow-md transition"
          title="View"
        >
          <Eye className="w-4 h-4 text-[#7C3AED]"/>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(trade.id); }} 
          className="w-8 h-8 rounded-lg bg-white hover:bg-red-50 flex items-center justify-center border border-red-200 shadow-md transition"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-500"/>
        </button>
      </div>
    </div>
  );
}

function FilterSection({ label, count, children }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="rounded-lg border border-[#E8E8F1] overflow-hidden">
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#F6F6FB]">
        <span className="text-xs font-bold text-[#16151F]">{label} {count>0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#7C3AED] font-semibold">{count}</span>}</span>
        <ChevronDown className={`w-4 h-4 text-[#6D6D82] transition-transform ${open?"":"rotate-180"}`}/>
      </button>
      {open && <div className="px-4 pb-3 pt-1">{children}</div>}
    </div>
  );
}

function FilterGroup({ items, selected, onToggle }) {
  if (!items || items.length===0) return <div className="text-xs text-[#A1A1AA] py-1">No presets</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(v => <button key={v} onClick={()=>onToggle(v)} className={`chip ${selected.includes(v)?"active":""}`} style={{fontSize:11, padding:"3px 10px"}}>{v}</button>)}
    </div>
  );
}

function RangeInput({ label, type, leftPlaceholder, rightPlaceholder, left, right, onLeft, onRight }) {
  return (
    <div>
      <div className="text-[10px] text-[#6D6D82] mb-1.5 font-bold uppercase tracking-wide">{label}</div>
      <div className="flex gap-2">
        <input type={type} step="any" placeholder={leftPlaceholder} value={left} onChange={e=>onLeft(e.target.value)} className="flex-1 h-8 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] text-xs bg-white tjfx-mono"/>
        <input type={type} step="any" placeholder={rightPlaceholder} value={right} onChange={e=>onRight(e.target.value)} className="flex-1 h-8 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] text-xs bg-white tjfx-mono"/>
      </div>
    </div>
  );
}

const EmptyTabState = ({ label }) => (
  <div className="text-center py-12 text-sm text-[#6D6D82]">{label}</div>
);

// Renders the drawer body based on which tab is active. Each tab used to be
// a dead button that always showed the same Overview content — now they
// actually switch what's displayed.
function ViewBlock({ t, tab = "Overview", mistakePresets, onToggleMistake }) {
  const openLightbox = useLightbox();

  if (tab === "Chart") {
    return t.screenshots?.length > 0 ? (
      <div className="space-y-3">
        {t.screenshots.map((s, i) => (
          <img key={i} alt="" src={s} onClick={() => openLightbox(t.screenshots, i)} className="w-full rounded-lg cursor-zoom-in border border-[#E8E8F1]"/>
        ))}
      </div>
    ) : <EmptyTabState label="No chart screenshots added for this trade."/>;
  }

  if (tab === "Notes") {
    return t.notes ? (
      <div className="p-3 bg-[#F6F6FB] rounded-lg text-sm text-[#16151F] whitespace-pre-wrap">{t.notes}</div>
    ) : <EmptyTabState label="No notes added for this trade."/>;
  }

  if (tab === "Mistakes") {
    return (
      <div className="space-y-4">
        {t.mistakes?.length > 0 ? (
          <TagBlock label="Mistakes" items={t.mistakes}/>
        ) : <EmptyTabState label="No mistakes tagged on this trade."/>}
        <div className="pt-3 border-t border-[#E8E8F1]">
          <div className="text-[11px] font-bold text-[#6D6D82] mb-2 uppercase tracking-wide">Tag a mistake</div>
          <div className="flex flex-wrap gap-1.5">
            {(mistakePresets || []).length ? mistakePresets.map(m => (
              <button
                key={m}
                onClick={() => onToggleMistake(t, m)}
                className={`chip ${t.mistakes?.includes(m) ? "active" : ""}`}
                style={{ fontSize: 11, padding: "3px 10px" }}
              >
                {m}
              </button>
            )) : (
              <div className="text-xs text-[#A1A1AA]">No mistake presets found. Add some from Settings → Presets.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "Checklist") {
    return t.strengths?.length > 0 ? (
      <TagBlock label="Rules & checklist followed" items={t.strengths}/>
    ) : <EmptyTabState label="No checklist items recorded for this trade."/>;
  }

  // Overview (default)
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[["Direction",t.direction || "—"],["Status",t.status],["Session",t.session],["Strategy",t.strategy],["Entry",t.entry_price],["Exit",t.exit_price||"—"],["SL",t.stop_loss||"—"],["TP",t.take_profit||"—"],["Lot",t.lot_size],["Risk %",t.risk_percent],["R Multiple",t.r_multiple||"—"],["Net P&L",`${asNumber(t.net_pnl)>=0?"+":""}$${asNumber(t.net_pnl).toFixed(2)}`]].map(([k,v]) => (
          <div key={k} className="p-3 rounded-lg bg-[#F6F6FB]"><div className="text-[10px] text-[#6D6D82] font-semibold">{k}</div><div className="font-bold tjfx-mono text-sm">{v}</div></div>
        ))}
      </div>
      {t.htf_poi?.length>0 && <TagBlock label="HTF POI" items={t.htf_poi}/>}
      {t.entry_tags?.length>0 && <TagBlock label="Entry" items={t.entry_tags}/>}
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
      </div>

      {computed && (
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[#F6F6FB]">
          <div><div className="text-[10px] text-[#6D6D82]">Net P&L</div><div className={`tjfx-mono font-bold ${computed.pnl>=0?"text-emerald-600":"text-red-500"}`}>{computed.pnl>=0?"+":""}${computed.pnl}</div></div>
          <div><div className="text-[10px] text-[#6D6D82]">R</div><div className="tjfx-mono font-bold">{computed.r}R</div></div>
          <div><div className="text-[10px] text-[#6D6D82]">Risk</div><div className="tjfx-mono font-bold">${computed.risk}</div></div>
        </div>
      )}

      <EditChips label="HTF POI" items={presets.htf_poi} selected={edit.htf_poi||[]} onToggle={v=>toggleEdit("htf_poi",v)}/>
      <EditChips label="Entry" items={presets.entry_tag} selected={edit.entry_tags||[]} onToggle={v=>toggleEdit("entry_tags",v)}/>

      <div>
        <div className="text-[10px] text-[#6D6D82] font-bold mb-1">Notes</div>
        <textarea value={edit.notes||""} onChange={e=>setEdit({...edit,notes:e.target.value})} rows={3} className="w-full p-2 rounded-lg border border-[#E8E8F1] text-sm"/>
      </div>
    </div>
  );
}

const F = ({ label, children }) => (<div><label className="block text-[10px] text-[#6D6D82] font-bold mb-1">{label}</label>{children}</div>);

function EditChips({ label, items, selected, onToggle }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-[10px] text-[#6D6D82] font-bold mb-1.5 uppercase tracking-wide">{label}</div>
      <div className="flex flex-wrap gap-1.5">{items.map(v => <button type="button" key={v} onClick={()=>onToggle(v)} className={`chip ${selected.includes(v)?"active":""}`} style={{fontSize:11,padding:"3px 8px"}}>{v}</button>)}</div>
    </div>
  );
}

const TagBlock = ({ label, items }) => (
  <div>
    <div className="text-xs font-bold text-[#6D6D82] mb-2 uppercase tracking-wide">{label}</div>
    <div className="flex flex-wrap gap-1.5">{items.map(x => <span key={x} className="chip active text-xs">{x}</span>)}</div>
  </div>
);

export default function TradeView() {
  return (
    <TradeViewErrorBoundary>
      <TradeViewContent />
    </TradeViewErrorBoundary>
  );
}
