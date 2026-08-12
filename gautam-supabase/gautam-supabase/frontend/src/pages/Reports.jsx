import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { tradesApi, biasApi, statsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Download,
  FileText,
  Printer,
  Loader2,
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  Clock,
  Zap,
  Brain,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Utility Functions
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  // Start on Monday (1), not Sunday
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

// India follows an Apr–Mar financial year (e.g. "FY 2026-27" runs 1 Apr 2026 → 31 Mar 2027).
function currentFinancialYear(d = new Date()) {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // month is 0-indexed; April = 3
  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31);
  return { start, end, label: `FY ${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}` };
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Bank-statement-style quick date presets for the report's date range picker.
const DATE_MODE_OPTIONS = () => {
  const now = new Date();
  const fy = currentFinancialYear(now);
  return [
    { value: "current_week", label: "Current Week" },
    { value: "prev_week", label: "Previous Week" },
    { value: "current_month", label: `Current Month (${MONTH_NAMES[now.getMonth()]})` },
    { value: "current_fy", label: `Current Financial Year (${fy.label})` },
    { value: "custom", label: "Custom Date Range" },
  ];
};

function formatTime(date, format24 = false) {
  if (!date) return "—";
  const d = new Date(date);
  if (format24) {
    return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getTimeOfDay(date) {
  if (!date) return "Unknown";
  const d = new Date(date);
  const hour = d.getHours();
  if (hour < 12) return "Morning (9-12)";
  if (hour < 15) return "Afternoon (12-3)";
  if (hour < 18) return "Evening (3-6)";
  return "Late (6+)";
}

export default function Reports() {
  const location = useLocation();
  const previewOnly = location.pathname === "/reports-preview";
  const { user } = useAuth();
  const [type, setType] = useState("daily");
  const [date, setDate] = useState(toDateStr(new Date()));
  // Bank-style reference date picker: a quick preset dropdown, with a manual
  // From/To range that only appears when "Custom Date Range" is chosen.
  const [dateMode, setDateMode] = useState("current_month");
  const [customFrom, setCustomFrom] = useState(toDateStr(new Date()));
  const [customTo, setCustomTo] = useState(toDateStr(new Date()));
  const [style, setStyle] = useState("professional");
  const timeFormat24 = user?.settings?.report_time_format === "24h";
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  
  const [includes, setIncludes] = useState({
    weeklyBias: true,
    dailyBias: true,
    trades: true,
    screenshots: true,
    psychology: true,
    stats: true,
    notes: true,
    performanceBreakdown: true,
    riskMetrics: true,
    aiSummary: true,
    tradeAnalysis: true,
  });

  const [trades, setTrades] = useState([]);
  const [biasList, setBiasList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  // Load data
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, b, s] = await Promise.all([
          tradesApi.list(),
          biasApi.list(),
          statsApi.dashboard(),
        ]);
        setTrades(t);
        setBiasList(b);
        setStats(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Calculate date range from the Reference Date preset dropdown (bank-statement
  // style: Current Week / Previous Week / Current Month / Current Financial Year,
  // or a manual Custom Date Range with From/To fields).
  const range = useMemo(() => {
    const now = new Date();
    if (dateMode === "current_week") {
      const s = startOfWeek(now);
      return { start: toDateStr(s), end: toDateStr(addDays(s, 6)) };
    }
    if (dateMode === "prev_week") {
      const s = addDays(startOfWeek(now), -7);
      return { start: toDateStr(s), end: toDateStr(addDays(s, 6)) };
    }
    if (dateMode === "current_month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: toDateStr(s), end: toDateStr(e) };
    }
    if (dateMode === "current_fy") {
      const fy = currentFinancialYear(now);
      return { start: toDateStr(fy.start), end: toDateStr(fy.end) };
    }
    // custom
    const s = customFrom || toDateStr(now);
    const e = customTo || toDateStr(now);
    return s <= e ? { start: s, end: e } : { start: e, end: s };
  }, [dateMode, customFrom, customTo]);

  // Filter and calculate metrics
  const filtered = useMemo(() => {
    const inRange = (dStr) => dStr && dStr >= range.start && dStr <= range.end;
    const t = trades.filter((x) => inRange(x.date));
    const weekly = biasList
      .filter((x) => x.type === "weekly" && inRange(x.date))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const daily = biasList
      .filter((x) => x.type === "daily" && inRange(x.date))
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    const closed = t.filter((x) => x.status === "closed");
    const wins = closed.filter((x) => (x.net_pnl || 0) > 0);
    const losses = closed.filter((x) => (x.net_pnl || 0) < 0);
    const pnl = closed.reduce((s, x) => s + (x.net_pnl || 0), 0);
    const gw = wins.reduce((s, x) => s + (x.net_pnl || 0), 0);
    const gl = Math.abs(losses.reduce((s, x) => s + (x.net_pnl || 0), 0)) || 1;

    // Strategy breakdown
    const strategyMap = {};
    t.forEach((trade) => {
      const st = trade.strategy || "Unspecified";
      if (!strategyMap[st]) {
        strategyMap[st] = { total: 0, wins: 0, pnl: 0, trades: [] };
      }
      strategyMap[st].total++;
      strategyMap[st].trades.push(trade);
      if ((trade.net_pnl || 0) > 0) strategyMap[st].wins++;
      strategyMap[st].pnl += trade.net_pnl || 0;
    });

    // Symbol breakdown
    const symbolMap = {};
    t.forEach((trade) => {
      const sym = trade.symbol || "Unknown";
      if (!symbolMap[sym]) {
        symbolMap[sym] = { total: 0, wins: 0, pnl: 0 };
      }
      symbolMap[sym].total++;
      if ((trade.net_pnl || 0) > 0) symbolMap[sym].wins++;
      symbolMap[sym].pnl += trade.net_pnl || 0;
    });

    // Time of day breakdown
    const timeMap = {};
    t.forEach((trade) => {
      const tod = getTimeOfDay(trade.entry_time || trade.date);
      if (!timeMap[tod]) {
        timeMap[tod] = { total: 0, wins: 0, pnl: 0 };
      }
      timeMap[tod].total++;
      if ((trade.net_pnl || 0) > 0) timeMap[tod].wins++;
      timeMap[tod].pnl += trade.net_pnl || 0;
    });

    // Best and worst trades
    const sortedByPnl = [...closed].sort((a, b) => (b.net_pnl || 0) - (a.net_pnl || 0));
    const bestTrade = sortedByPnl[0];
    const worstTrade = sortedByPnl[sortedByPnl.length - 1];

    // Win streaks
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;
    closed.forEach((trade) => {
      if ((trade.net_pnl || 0) > 0) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        currentLossStreak = 0;
      } else {
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        currentWinStreak = 0;
      }
    });

    return {
      trades: t,
      weekly,
      daily,
      metrics: {
        total: t.length,
        wins: wins.length,
        losses: losses.length,
        wr: closed.length ? Math.round((wins.length / closed.length) * 100) : 0,
        pf: gl ? (gw / gl).toFixed(2) : "—",
        pnl: pnl.toFixed(2),
        avgWin: wins.length ? (gw / wins.length).toFixed(2) : 0,
        avgLoss: losses.length ? (Math.abs(gl) / losses.length).toFixed(2) : 0,
      },
      strategyMap,
      symbolMap,
      timeMap,
      bestTrade,
      worstTrade,
      maxWinStreak,
      maxLossStreak,
    };
  }, [trades, biasList, range]);

  // Generate AI Summary (mock - can be replaced with actual API call)
  const generateAiSummary = async () => {
    setAiSummaryLoading(true);
    try {
      // Mock AI summary - replace with actual API call
      setTimeout(() => {
        const summary = `
Based on your trading data for ${range.start} to ${range.end}:

Performance Overview:
You took ${filtered.trades.length} trades with a win rate of ${filtered.metrics.wr}%. Your net P&L was $${filtered.metrics.pnl}, which represents a solid ${parseFloat(filtered.metrics.pnl) > 0 ? "profitable" : "challenging"} period.

Key Insights:
• Best performing strategy: ${Object.entries(filtered.strategyMap).sort((a, b) => parseFloat(b[1].pnl) - parseFloat(a[1].pnl))[0]?.[0] || "N/A"}
• Best trading time: ${Object.entries(filtered.timeMap).sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total)[0]?.[0] || "N/A"}
• Average win: $${filtered.metrics.avgWin}, Average loss: $${filtered.metrics.avgLoss}
• Longest winning streak: ${filtered.maxWinStreak} trades
• Longest losing streak: ${filtered.maxLossStreak} trades

Recommendations:
1. Focus on your best performing strategy
2. Trade more during your peak performance hours
3. Work on risk management for losing trades
4. Maintain consistency in your trading process
        `;
        setAiSummary(summary);
        toast.success("AI Summary generated!");
      }, 1500);
    } catch (e) {
      toast.error("Failed to generate AI summary");
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const reportId = `TJFX-${range.start}-${type[0].toUpperCase()}`;

  const downloadPDF = async () => {
    const node = reportRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`TheJournalFX_${type}_${range.start}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`compact-reports ${previewOnly ? "report-preview-only" : "report-config"} min-h-screen bg-[#F6F6FB] p-4 sm:p-6 lg:p-8`} data-testid="reports-page">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#16151F]">
              Reports & Export
            </h1>
            <p className="text-[#6D6D82] mt-1 text-sm sm:text-base">
              Generate comprehensive trading reports with AI insights
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {!previewOnly && <button
              type="button"
              onClick={() => window.open("/reports-preview", "_blank", "noopener,noreferrer")}
              className="h-10 px-4 rounded-xl border border-[#7C3AED] text-[#7C3AED] hover:bg-[#F3E8FF] text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              <FileText className="w-4 h-4" /> Open Preview
            </button>}
            <button
              onClick={() => window.print()}
              className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              data-testid="download-pdf-btn"
              onClick={downloadPDF}
              disabled={exporting}
              className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? "Exporting..." : "Download PDF"}
            </button>
          </div>
        </div>

        {/* CONFIG SECTION - RESPONSIVE GRID */}
        <div className="reports-workspace">
          {/* LEFT PANEL - Controls */}
          <aside className="reports-sidebar">
            {/* Report Type */}
            <div className="tjfx-card p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#6D6D82] uppercase tracking-wide">
                  Report Type
                </label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {["daily", "weekly", "monthly"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      data-testid={`report-type-${t}`}
                      className={`h-10 rounded-xl text-xs sm:text-sm font-medium border capitalize transition-all ${
                        type === t
                          ? "bg-[#F3E8FF] border-[#7C3AED] text-[#7C3AED]"
                          : "border-[#E8E8F1] hover:border-[#7C3AED]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Picker */}
              <div>
                <label className="text-xs font-semibold text-[#6D6D82] uppercase tracking-wide">
                  Reference Date
                </label>
                <select
                  value={dateMode}
                  onChange={(e) => setDateMode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white mt-2"
                  data-testid="report-date-mode"
                >
                  {DATE_MODE_OPTIONS().map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {dateMode === "custom" && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <div className="text-[10px] text-[#6D6D82] font-medium mb-1">From</div>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        max={customTo}
                        className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white"
                        data-testid="report-date-from"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-[#6D6D82] font-medium mb-1">To</div>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        min={customFrom}
                        className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white"
                        data-testid="report-date-to"
                      />
                    </div>
                  </div>
                )}

                <div className="text-xs text-[#A1A1AA] mt-2 tjfx-mono font-medium">
                  {range.start} → {range.end}
                </div>
              </div>

              {/* Report Style */}
              <div>
                <label className="text-xs font-semibold text-[#6D6D82] uppercase tracking-wide">
                  Report Style
                </label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {["compact", "professional", "institutional"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`h-10 rounded-xl text-xs font-medium border capitalize transition-all ${
                        style === s
                          ? "bg-[#F3E8FF] border-[#7C3AED] text-[#7C3AED]"
                          : "border-[#E8E8F1] hover:border-[#7C3AED]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Include Sections */}
            <div className="tjfx-card p-5">
              <label className="text-xs font-semibold text-[#6D6D82] uppercase tracking-wide block mb-3">
                Include Sections
              </label>
              <div className="space-y-2 text-sm">
                {[
                  ["weeklyBias", "Weekly Bias"],
                  ["dailyBias", "Daily Bias"],
                  ["stats", "Performance Stats"],
                  ["performanceBreakdown", "Performance Breakdown"],
                  ["riskMetrics", "Risk Metrics"],
                  ["trades", "Trades Table"],
                  ["tradeAnalysis", "Trade Analysis"],
                  ["screenshots", "Trade Screenshots"],
                  ["psychology", "Psychology Review"],
                  ["aiSummary", "AI Summary"],
                  ["notes", "Notes"],
                ].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includes[k]}
                      onChange={(e) =>
                        setIncludes({ ...includes, [k]: e.target.checked })
                      }
                      className="accent-[#7C3AED] w-4 h-4 rounded"
                    />
                    <span className="text-[#16151F]">{l}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* AI Summary Button */}
            {includes.aiSummary && (
              <button
                onClick={generateAiSummary}
                disabled={aiSummaryLoading || !filtered.trades.length}
                className="w-full h-10 px-4 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5b21b6] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              >
                {aiSummaryLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Generate AI Summary
              </button>
            )}

            {/* Info Box */}
            <div className="tjfx-card p-4 bg-[#F3E8FF] border-[#7C3AED]/20">
              <div className="font-semibold text-[#7C3AED] mb-1 flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4" /> Pro Tip
              </div>
              <p className="text-xs text-[#6D6D82]">
                Fill your bias, log trades, and psychology data for complete
                reports with AI insights.
              </p>
            </div>
          </aside>

          {/* RIGHT PANEL - Preview */}
          <div className="reports-preview">
            <div className="tjfx-card overflow-hidden flex flex-col h-full">
              {/* Preview Header */}
              <div className="bg-[#F6F6FB] px-4 py-3 text-xs text-[#6D6D82] flex items-center justify-between border-b border-[#E8E8F1]">
                <span className="font-medium">PDF Preview · A4</span>
                <span className="tjfx-mono text-[11px]">{reportId}</span>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-auto scroll-thin bg-[#F6F6FB] p-4">
                <div
                  ref={reportRef}
                  className={`mx-auto bg-white shadow-sm ${
                    style === "compact"
                      ? "text-[12px]"
                      : style === "institutional"
                      ? "text-[13px]"
                      : "text-[13.5px]"
                  }`}
                  style={{ width: "100%", maxWidth: "800px", minHeight: "1100px", padding: "40px" }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center py-24 text-[#6D6D82]">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading data...
                    </div>
                  ) : (
                    <ReportBody
                      user={user}
                      type={type}
                      range={range}
                      reportId={reportId}
                      data={filtered}
                      stats={stats}
                      includes={includes}
                      style={style}
                      timeFormat24={timeFormat24}
                      aiSummary={aiSummary}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportBody({
  user,
  type,
  range,
  reportId,
  data,
  stats,
  includes,
  style,
  timeFormat24,
  aiSummary,
}) {
  return (
    <div className="space-y-6" style={{ color: "#16151F", fontFamily: "'Satoshi', sans-serif" }}>
      {/* HEADER */}
      <div className="flex items-center justify-between pb-5 border-b-2 border-[#E8E8F1]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-display text-xl font-bold">TheJournalFX</div>
            <div className="text-[11px] text-[#6D6D82]">Journal • Analyze • Improve</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-lg uppercase tracking-wide">
            {type} Report
          </div>
          <div className="text-[11px] text-[#6D6D82] tjfx-mono">
            {range.start} → {range.end}
          </div>
          <div className="text-[10px] text-[#A1A1AA] tjfx-mono mt-1">{reportId}</div>
        </div>
      </div>

      {/* TRADER INFO */}
      <div className="grid grid-cols-2 gap-4 text-[12px]">
        <div>
          <div className="text-[#6D6D82] font-medium mb-1">Trader</div>
          <div className="text-[#16151F] font-semibold">{user?.name || "Trader"}</div>
        </div>
        <div>
          <div className="text-[#6D6D82] font-medium mb-1">Email</div>
          <div className="text-[#16151F] tjfx-mono">{user?.email || "—"}</div>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY */}
      {includes.stats && (
        <Section title="1. Executive Summary">
          <div className="grid grid-cols-5 gap-3">
            <Metric label="Trades" value={data.metrics.total} />
            <Metric label="Wins" value={data.metrics.wins} color="#10B981" />
            <Metric label="Losses" value={data.metrics.losses} color="#EF4444" />
            <Metric label="Win Rate" value={`${data.metrics.wr}%`} color="#7C3AED" />
            <Metric label="Profit Factor" value={data.metrics.pf} color="#7C3AED" />
          </div>
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[#F3E8FF] to-[#F6F6FB] border border-[#E8E8F1] flex items-center justify-between">
            <div className="text-[12px] text-[#6D6D82] font-medium">Net P&L</div>
            <div
              className={`tjfx-mono text-2xl font-bold ${
                parseFloat(data.metrics.pnl) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
              }`}
            >
              ${data.metrics.pnl}
            </div>
          </div>
        </Section>
      )}

      {/* WEEKLY BIAS */}
      {includes.weeklyBias && data.weekly && (
        <Section title="2. Weekly Bias">
          <BiasBlock b={data.weekly} />
        </Section>
      )}

      {/* DAILY BIAS */}
      {includes.dailyBias && data.daily && (
        <Section title="3. Daily Bias">
          <BiasBlock b={data.daily} />
        </Section>
      )}

      {/* PERFORMANCE BREAKDOWN */}
      {includes.performanceBreakdown && (
        <Section title="4. Performance Breakdown">
          <div className="space-y-4">
            {/* By Strategy */}
            {Object.keys(data.strategyMap).length > 0 && (
              <div>
                <div className="text-[12px] font-semibold text-[#6D6D82] mb-2">By Strategy</div>
                <div className="space-y-2">
                  {Object.entries(data.strategyMap)
                    .sort((a, b) => b[1].pnl - a[1].pnl)
                    .map(([strategy, stats]) => (
                      <div
                        key={strategy}
                        className="p-2 rounded-lg bg-[#F6F6FB] flex items-center justify-between"
                      >
                        <div className="text-[11px]">
                          <span className="font-semibold">{strategy}</span>
                          <span className="text-[#6D6D82] mx-2">•</span>
                          <span className="text-[#6D6D82]">
                            {stats.total} trades, {stats.wins}/{stats.total} wins
                          </span>
                        </div>
                        <div
                          className={`tjfx-mono font-semibold text-[11px] ${
                            stats.pnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                          }`}
                        >
                          ${stats.pnl.toFixed(2)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* By Symbol */}
            {Object.keys(data.symbolMap).length > 0 && (
              <div>
                <div className="text-[12px] font-semibold text-[#6D6D82] mb-2">By Symbol</div>
                <div className="space-y-2">
                  {Object.entries(data.symbolMap)
                    .sort((a, b) => b[1].pnl - a[1].pnl)
                    .slice(0, 5)
                    .map(([symbol, stats]) => (
                      <div
                        key={symbol}
                        className="p-2 rounded-lg bg-[#F6F6FB] flex items-center justify-between"
                      >
                        <div className="text-[11px]">
                          <span className="font-semibold tjfx-mono">{symbol}</span>
                          <span className="text-[#6D6D82] mx-2">•</span>
                          <span className="text-[#6D6D82]">
                            {stats.total} trades, {stats.wins}/{stats.total} wins
                          </span>
                        </div>
                        <div
                          className={`tjfx-mono font-semibold text-[11px] ${
                            stats.pnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                          }`}
                        >
                          ${stats.pnl.toFixed(2)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* By Time of Day */}
            {Object.keys(data.timeMap).length > 0 && (
              <div>
                <div className="text-[12px] font-semibold text-[#6D6D82] mb-2">By Time of Day</div>
                <div className="space-y-2">
                  {Object.entries(data.timeMap)
                    .sort((a, b) => b[1].pnl - a[1].pnl)
                    .map(([timeOfDay, stats]) => (
                      <div
                        key={timeOfDay}
                        className="p-2 rounded-lg bg-[#F6F6FB] flex items-center justify-between"
                      >
                        <div className="text-[11px]">
                          <span className="font-semibold">{timeOfDay}</span>
                          <span className="text-[#6D6D82] mx-2">•</span>
                          <span className="text-[#6D6D82]">
                            {stats.total} trades, {stats.wins}/{stats.total} wins
                          </span>
                        </div>
                        <div
                          className={`tjfx-mono font-semibold text-[11px] ${
                            stats.pnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                          }`}
                        >
                          ${stats.pnl.toFixed(2)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* RISK METRICS */}
      {includes.riskMetrics && (
        <Section title="5. Risk Metrics">
          <div className="grid grid-cols-3 gap-3">
            <Metric
              label="Avg Win"
              value={`$${data.metrics.avgWin}`}
              color="#10B981"
            />
            <Metric
              label="Avg Loss"
              value={`-$${data.metrics.avgLoss}`}
              color="#EF4444"
            />
            <Metric
              label="Max Streak"
              value={`${data.maxWinStreak}W`}
              color="#7C3AED"
            />
          </div>
          {data.bestTrade && (
            <div className="mt-3 p-3 rounded-lg bg-[#ECFDF5] border border-[#10B981]/20">
              <div className="text-[11px] text-[#059669] font-semibold mb-1">Best Trade</div>
              <div className="text-[11px]">
                <span className="tjfx-mono font-semibold">{data.bestTrade.symbol}</span>
                <span className="text-[#6D6D82] mx-1">•</span>
                <span className="text-[#6D6D82]">{data.bestTrade.date}</span>
                <span className="text-[#6D6D82] mx-1">•</span>
                <span className="tjfx-mono font-semibold text-[#10B981]">
                  +${(data.bestTrade.net_pnl || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
          {data.worstTrade && (
            <div className="mt-2 p-3 rounded-lg bg-[#FEF2F2] border border-[#EF4444]/20">
              <div className="text-[11px] text-[#DC2626] font-semibold mb-1">
                Worst Trade
              </div>
              <div className="text-[11px]">
                <span className="tjfx-mono font-semibold">{data.worstTrade.symbol}</span>
                <span className="text-[#6D6D82] mx-1">•</span>
                <span className="text-[#6D6D82]">{data.worstTrade.date}</span>
                <span className="text-[#6D6D82] mx-1">•</span>
                <span className="tjfx-mono font-semibold text-[#EF4444]">
                  ${(data.worstTrade.net_pnl || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* TRADES TABLE */}
      {includes.trades && (
        <Section title="6. Detailed Trades">
          {data.trades.length === 0 ? (
            <div className="text-[#6D6D82] text-[12px] p-3 bg-[#F6F6FB] rounded-lg">
              No trades in this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-[#F6F6FB] text-[#6D6D82]">
                  <tr>
                    {["Date", "Symbol", "Dir", "Entry", "Exit", "SL", "TP", "R", "P&L", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-2 py-2 font-semibold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.trades.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-t border-[#E8E8F1] ${
                        (t.net_pnl || 0) > 0 ? "bg-[#ECFDF5]/30" : (t.net_pnl || 0) < 0 ? "bg-[#FEF2F2]/30" : ""
                      }`}
                    >
                      <td className="px-2 py-2 tjfx-mono text-[#6D6D82]">{t.date}</td>
                      <td className="px-2 py-2 font-semibold tjfx-mono">{t.symbol}</td>
                      <td
                        className={`px-2 py-2 ${
                          t.direction === "long"
                            ? "text-[#10B981] font-semibold"
                            : "text-[#EF4444] font-semibold"
                        }`}
                      >
                        {t.direction === "long" ? "L" : "S"}
                      </td>
                      <td className="px-2 py-2 tjfx-mono">{t.entry_price}</td>
                      <td className="px-2 py-2 tjfx-mono">{t.exit_price || "—"}</td>
                      <td className="px-2 py-2 tjfx-mono text-[#6D6D82]">
                        {t.stop_loss || "—"}
                      </td>
                      <td className="px-2 py-2 tjfx-mono text-[#6D6D82]">
                        {t.take_profit || "—"}
                      </td>
                      <td className="px-2 py-2 tjfx-mono font-medium">
                        {t.r_multiple ? `${t.r_multiple}R` : "—"}
                      </td>
                      <td
                        className={`px-2 py-2 tjfx-mono font-semibold ${
                          (t.net_pnl || 0) >= 0
                            ? "text-[#10B981]"
                            : "text-[#EF4444]"
                        }`}
                      >
                        ${(t.net_pnl || 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-[#6D6D82] capitalize">{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* TRADE ANALYSIS */}
      {includes.tradeAnalysis && data.trades.some((t) => t.screenshots?.length) && (
        <Section title="7. Trade Analysis">
          <div className="space-y-4">
            {data.trades
              .filter((t) => t.screenshots?.length)
              .slice(0, 10)
              .map((t) => (
                <div
                  key={t.id}
                  className="border border-[#E8E8F1] rounded-lg p-3 bg-[#F9F9FC]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold tjfx-mono text-[12px]">
                        {t.symbol} · {t.direction === "long" ? "Long" : "Short"}
                      </div>
                      <div className="text-[11px] text-[#6D6D82]">{t.date}</div>
                    </div>
                    <div
                      className={`text-[12px] tjfx-mono font-semibold ${
                        (t.net_pnl || 0) >= 0
                          ? "text-[#10B981]"
                          : "text-[#EF4444]"
                      }`}
                    >
                      ${(t.net_pnl || 0).toFixed(2)}
                    </div>
                  </div>
                  {includes.screenshots && t.screenshots?.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {t.screenshots.map((s, i) => (
                        <img
                          key={i}
                          src={s}
                          alt={`${t.symbol} screenshot ${i + 1}`}
                          className="w-full h-28 object-cover rounded-lg border border-[#E8E8F1]"
                          crossOrigin="anonymous"
                        />
                      ))}
                    </div>
                  )}
                  {t.notes && (
                    <div className="text-[11px] text-[#6D6D82] whitespace-pre-wrap border-t border-[#E8E8F1] pt-2 mt-2">
                      {t.notes}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </Section>
      )}

      {/* PSYCHOLOGY */}
      {includes.psychology && (
        <Section title="8. Psychology Review">
          {(() => {
            const moods = {};
            const mistakes = {};
            const strengths = {};
            data.trades.forEach((t) => {
              (t.mood_before || []).forEach(
                (m) => (moods[m] = (moods[m] || 0) + 1)
              );
              (t.mistakes || []).forEach(
                (m) => (mistakes[m] = (mistakes[m] || 0) + 1)
              );
              (t.strengths || []).forEach(
                (m) => (strengths[m] = (strengths[m] || 0) + 1)
              );
            });
            const top = (obj) =>
              Object.entries(obj)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            return (
              <div className="grid grid-cols-3 gap-3 text-[12px]">
                <TagsBox label="Moods" items={top(moods)} color="purple" />
                <TagsBox label="Mistakes" items={top(mistakes)} color="red" />
                <TagsBox label="Strengths" items={top(strengths)} color="emerald" />
              </div>
            );
          })()}
        </Section>
      )}

      {/* AI SUMMARY */}
      {includes.aiSummary && aiSummary && (
        <Section title="9. AI Insights & Summary">
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#F3E8FF] to-[#F6F6FB] border border-[#7C3AED]/20">
            <div className="flex gap-2 mb-3">
              <Zap className="w-4 h-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#16151F] whitespace-pre-wrap leading-relaxed">
                {aiSummary}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* NOTES */}
      {includes.notes && data.daily?.notes?.length > 0 && (
        <Section title="10. Notes & Reminders">
          <ul className="list-disc pl-5 space-y-1 text-[12px]">
            {data.daily.notes.map((n, i) => (
              <li key={i} className="text-[#16151F]">
                {n}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* FOOTER */}
      <div className="pt-4 mt-6 border-t border-[#E8E8F1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] text-[#A1A1AA]">
        <span>Generated by TheJournalFX</span>
        <span className="tjfx-mono">{new Date().toISOString().slice(0, 10)}</span>
        <span className="tjfx-mono">{reportId}</span>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div>
    <div className="font-display font-bold text-[15px] text-[#16151F] mb-3 pb-2 border-b-2 border-[#7C3AED]/30">
      {title}
    </div>
    <div>{children}</div>
  </div>
);

const Metric = ({ label, value, color = "#16151F" }) => (
  <div className="p-3 rounded-lg bg-[#F6F6FB] border border-[#E8E8F1]">
    <div className="text-[10px] text-[#6D6D82] font-medium">{label}</div>
    <div className="tjfx-mono font-bold text-[16px] mt-1" style={{ color }}>
      {value}
    </div>
  </div>
);

const BiasBlock = ({ b }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-4 gap-2 text-[12px]">
      <div className="p-2 rounded-lg bg-[#F6F6FB]">
        <div className="text-[10px] text-[#6D6D82] font-medium">Direction</div>
        <div
          className={`font-semibold capitalize mt-1 ${
            b.direction === "bullish"
              ? "text-[#10B981]"
              : b.direction === "bearish"
              ? "text-[#EF4444]"
              : ""
          }`}
        >
          {b.direction}
        </div>
      </div>
      <div className="p-2 rounded-lg bg-[#F6F6FB]">
        <div className="text-[10px] text-[#6D6D82] font-medium">Confidence</div>
        <div className="font-semibold tjfx-mono mt-1">{b.confidence}%</div>
      </div>
      <div className="p-2 rounded-lg bg-[#F6F6FB]">
        <div className="text-[10px] text-[#6D6D82] font-medium">Session</div>
        <div className="font-semibold mt-1">{b.session || "—"}</div>
      </div>
      <div className="p-2 rounded-lg bg-[#F6F6FB]">
        <div className="text-[10px] text-[#6D6D82] font-medium">Date</div>
        <div className="font-semibold tjfx-mono mt-1">{b.date}</div>
      </div>
    </div>
    {b.narrative && (
      <div className="p-3 rounded-lg bg-[#F6F6FB]">
        <div className="text-[11px] text-[#16151F] whitespace-pre-wrap">
          {b.narrative}
        </div>
      </div>
    )}
    {b.ai_summary && (
      <div className="p-3 rounded-lg bg-[#F3E8FF] border border-[#7C3AED]/20">
        <div className="text-[10px] font-semibold text-[#7C3AED] mb-1">
          AI Summary
        </div>
        <div className="text-[11px] whitespace-pre-wrap text-[#16151F]">
          {b.ai_summary}
        </div>
      </div>
    )}
  </div>
);

const TagsBox = ({ label, items, color = "purple" }) => (
  <div className="p-3 rounded-lg bg-[#F6F6FB] border border-[#E8E8F1]">
    <div className="text-[10px] text-[#6D6D82] font-medium mb-2">{label}</div>
    {items.length === 0 ? (
      <div className="text-[10px] text-[#A1A1AA]">—</div>
    ) : (
      <div className="space-y-1.5">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[11px]">
            <span className="text-[#16151F]">{k}</span>
            <span
              className={`tjfx-mono font-semibold ${
                color === "red"
                  ? "text-[#EF4444]"
                  : color === "emerald"
                  ? "text-[#10B981]"
                  : "text-[#7C3AED]"
              }`}
            >
              ×{v}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);
