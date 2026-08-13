import React, { useEffect, useMemo, useRef, useState } from "react";
import { tradesApi } from "@/lib/api";
import { useAccount } from "@/context/AccountContext";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis,
  CartesianGrid, BarChart, Bar, ReferenceLine,
} from "recharts";
import {
  ChevronDown, Smile, LineChart as LineChartIcon, CalendarDays, Clock,
  Trophy, TrendingDown, Target as TargetIcon, Sparkles, Sun, Moon, Globe,
  Download, Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

const VIEWS = [
  { id: "mood", label: "Mood Tracker", icon: Smile },
  { id: "strategy", label: "Strategy Tracker", icon: LineChartIcon },
  { id: "day", label: "Best Day of Week", icon: CalendarDays },
  { id: "time", label: "Best Time", icon: Clock },
];

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MOOD_EMOJI = {
  Calm: "😌", Focused: "🎯", Confident: "😎", Neutral: "😐", FOMO: "😰",
  Anxious: "😟", Revenge: "😡", Patient: "🧘", Greedy: "🤑", Frustrated: "😤",
  Fearful: "😨", Tired: "🥱",
};

const PALETTE = ["#22C55E", "#3B82F6", "#EAB308", "#94A3B8", "#8B5CF6", "#F97316", "#EF4444", "#06B6D4", "#EC4899"];

function sessionOfHour(hr) {
  // Rough global session bands in a 24h clock (broad/illustrative bands).
  if (hr >= 0 && hr < 7) return "Asian";
  if (hr >= 7 && hr < 12) return "London";
  if (hr >= 12 && hr < 16) return "Overlap";
  if (hr >= 16 && hr < 21) return "New York";
  return "Asian";
}

function dowOf(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    return DAY_ORDER[(d.getDay() + 6) % 7]; // Mon..Sun
  } catch { return null; }
}

function fmtMoney(n) {
  const v = n || 0;
  return `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`;
}

export default function Tracker() {
  const { activeId } = useAccount();
  const navigate = useNavigate();
  const [view, setView] = useState("mood");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState(null); // { title, trades: [] }

  useEffect(() => {
    setLoading(true);
    tradesApi.list(activeId).then(setTrades).catch(() => setTrades([])).finally(() => setLoading(false));
  }, [activeId]);

  const closed = useMemo(() => trades.filter(t => t.status === "closed"), [trades]);
  const totalPnl = useMemo(() => closed.reduce((s, t) => s + (t.net_pnl || 0), 0), [closed]);

  const activeView = VIEWS.find(v => v.id === view) || VIEWS[0];

  return (
    <div className="p-5 max-w-[1300px] mx-auto space-y-4" data-testid="tracker-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Tracker</h1>
          <p className="text-[#6D6D82] mt-1">Slice your trades by mood, strategy, day and time — click anything to see the trades behind it.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="tracker-view-select"
              className="h-11 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] bg-white text-sm font-semibold flex items-center gap-2 shadow-sm"
            >
              <activeView.icon className="w-4 h-4 text-[#7C3AED]" />
              {activeView.label}
              <ChevronDown className="w-4 h-4 text-[#6D6D82]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {VIEWS.map(v => (
              <DropdownMenuItem key={v.id} onClick={() => setView(v.id)} data-testid={`tracker-view-${v.id}`}>
                <v.icon className="w-4 h-4 mr-2 text-[#7C3AED]" /> {v.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="tjfx-card p-10 text-center text-sm text-[#6D6D82]">Loading your trades...</div>
      ) : closed.length === 0 ? (
        <div className="tjfx-card p-10 text-center text-sm text-[#6D6D82]">No closed trades yet — log some trades to see your tracker.</div>
      ) : (
        <>
          {view === "mood" && <MoodTracker trades={closed} onDrill={setDrill} />}
          {view === "strategy" && <StrategyTracker trades={closed} onDrill={setDrill} />}
          {view === "day" && <DayTracker trades={closed} onDrill={setDrill} />}
          {view === "time" && <TimeTracker trades={closed} onDrill={setDrill} />}
        </>
      )}

      <DrillDialog drill={drill} onClose={() => setDrill(null)} navigate={navigate} />
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function KPI({ label, value, icon: Icon, color = "text-[#16151F]" }) {
  return (
    <div className="tjfx-card p-6 tjfx-card-hover">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[13px] text-[#6D6D82] font-medium">{label}</div>
        {Icon && <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] flex items-center justify-center"><Icon className="w-4 h-4 text-[#7C3AED]" /></div>}
      </div>
      <div className={`tjfx-mono text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function ClickableRow({ onClick, color, label, emoji, right }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 px-2 -mx-2 rounded-xl hover:bg-[#F3E8FF]/50 transition-colors text-left"
      data-testid="tracker-row"
    >
      <div className="flex items-center gap-2 min-w-0">
        {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
        {emoji && <span className="text-base leading-none">{emoji}</span>}
        <span className="font-medium text-sm truncate">{label}</span>
      </div>
      <div className="tjfx-mono text-xs text-[#6D6D82] shrink-0">{right}</div>
    </button>
  );
}

function DrillDialog({ drill, onClose, navigate }) {
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

  // Exports a detailed PDF for just this mood/strategy/day/time slice — every
  // trade in the drill (Date, Pair, Dir, P&L, R) plus each trade's screenshot,
  // rendered off-screen and captured with html2canvas → jsPDF.
  const exportPdf = async () => {
    const node = printRef.current;
    if (!node || !drill) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
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
      const safeTitle = (drill.title || "tracker-report").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      pdf.save(`TheJournalFX_${safeTitle}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={!!drill} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white" data-testid="tracker-drill-dialog">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>{drill?.title}</DialogTitle>
            {(drill?.trades || []).length > 0 && (
              <button
                onClick={exportPdf}
                disabled={exporting}
                data-testid="tracker-drill-export-pdf"
                className="h-8 px-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 shrink-0"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export PDF
              </button>
            )}
          </div>
        </DialogHeader>
        {(drill?.trades || []).length > 0 ? (
          <div className="overflow-x-auto scroll-thin max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="text-[#6D6D82] border-b border-[#E8E8F1]">
                <tr className="text-left">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Pair</th>
                  <th className="py-2 font-medium">Dir</th>
                  <th className="py-2 font-medium">P&L</th>
                  <th className="py-2 font-medium">R</th>
                </tr>
              </thead>
              <tbody>
                {drill.trades.map(trade => (
                  <tr
                    key={trade.id}
                    onClick={() => navigate("/trades")}
                    className="border-t border-[#E8E8F1] hover:bg-[#F3E8FF]/40 cursor-pointer"
                  >
                    <td className="py-3 tjfx-mono text-xs text-[#6D6D82]">{trade.date}{trade.entry_time ? ` · ${trade.entry_time}` : ""}</td>
                    <td className="py-3 font-semibold tjfx-mono">{trade.symbol}</td>
                    <td className={trade.direction === "long" ? "text-emerald-600" : "text-red-500"}>
                      {trade.direction === "long" ? "↑ Long" : "↓ Short"}
                    </td>
                    <td className={`py-3 tjfx-mono font-medium ${(trade.net_pnl || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {fmtMoney(trade.net_pnl)}
                    </td>
                    <td className="py-3 tjfx-mono">{trade.r_multiple != null ? `${trade.r_multiple.toFixed(2)}R` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-[#6D6D82]">No trades found.</div>
        )}
      </DialogContent>

      {/* Off-screen printable version used only for the PDF export (detailed rows + screenshots) */}
      {drill && (
        <div style={{ position: "fixed", left: -9999, top: 0, width: 800 }}>
          <div ref={printRef} className="bg-white p-6" style={{ width: 800 }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white font-bold">↗</div>
              <div>
                <div className="font-bold text-[15px]">TheJournalFX</div>
                <div className="text-[10px] text-[#6D6D82]">Journal • Analyze • Improve</div>
              </div>
            </div>
            <div className="text-[18px] font-bold mt-4 mb-1">{drill.title}</div>
            <div className="text-[11px] text-[#6D6D82] mb-4">Generated {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
            <div className="space-y-4">
              {drill.trades.map((trade) => (
                <div key={trade.id} className="border border-[#E8E8F1] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold text-[13px]">
                        {trade.symbol} · {trade.direction === "long" ? "Long" : "Short"}
                      </div>
                      <div className="text-[11px] text-[#6D6D82]">
                        {trade.date}{trade.entry_time ? ` · ${trade.entry_time}` : ""}
                        {trade.r_multiple != null ? ` · ${trade.r_multiple.toFixed(2)}R` : ""}
                      </div>
                    </div>
                    <div className={`text-[13px] font-semibold ${(trade.net_pnl || 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                      {fmtMoney(trade.net_pnl)}
                    </div>
                  </div>
                  {trade.screenshots?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {trade.screenshots.map((s, i) => (
                        <img key={i} src={s} alt="" crossOrigin="anonymous" className="w-full h-24 object-cover rounded-md border border-[#E8E8F1]" />
                      ))}
                    </div>
                  )}
                  {trade.notes && (
                    <div className="text-[11px] text-[#6D6D82] whitespace-pre-wrap border-t border-[#E8E8F1] pt-2 mt-2">
                      {trade.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function statsFor(list) {
  const wins = list.filter(t => (t.net_pnl || 0) > 0);
  const total = list.length;
  const pnl = list.reduce((s, t) => s + (t.net_pnl || 0), 0);
  const wr = total ? Math.round((wins.length / total) * 1000) / 10 : 0;
  const rr = list.filter(t => t.r_multiple != null);
  const avgRR = rr.length ? Math.round((rr.reduce((s, t) => s + t.r_multiple, 0) / rr.length) * 100) / 100 : 0;
  return { total, pnl, wr, avgRR };
}

/* ---------------- Mood Tracker ---------------- */

const POSITIVE_MOODS = new Set(["Calm", "Focused", "Confident", "Patient"]);
const NEGATIVE_MOODS = new Set(["FOMO", "Anxious", "Revenge", "Greedy", "Frustrated", "Fearful", "Tired"]);

function MoodTracker({ trades, onDrill }) {
  const byMood = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const moods = new Set([...(t.mood_before || []), ...(t.mood_during || []), ...(t.mood_after || [])]);
      moods.forEach(m => {
        if (!map[m]) map[m] = [];
        map[m].push(t);
      });
    });
    return Object.entries(map)
      .map(([mood, list]) => ({ mood, ...statsFor(list), list }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const best = byMood.slice().sort((a, b) => b.wr - a.wr)[0];
  const worst = byMood.slice().sort((a, b) => a.wr - b.wr)[0];
  const mostFrequent = byMood.slice().sort((a, b) => b.total - a.total)[0];

  const totalTagged = byMood.reduce((s, m) => s + m.total, 0) || 1;
  const donutData = byMood.map((m, i) => ({ name: m.mood, value: m.total, color: PALETTE[i % PALETTE.length] }));

  // Impact score: weighted win-rate deviation from 50, scaled -100..100
  const impactScore = Math.max(-100, Math.min(100, Math.round(
    byMood.reduce((s, m) => s + (m.wr - 50) * (m.total / totalTagged), 0) * 2
  )));

  // Trend by day: how many trades that day were tagged with a "positive"
  // vs "negative" mood — shown as counts (not %) so the chart is readable
  // even on days with just 1-2 trades.
  const trendByDate = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const d = t.date;
      if (!d) return;
      const moods = new Set([...(t.mood_before || []), ...(t.mood_during || []), ...(t.mood_after || [])]);
      const pos = [...moods].some(m => POSITIVE_MOODS.has(m));
      const neg = [...moods].some(m => NEGATIVE_MOODS.has(m));
      if (!map[d]) map[d] = { pos: 0, neg: 0, total: 0 };
      map[d].total++;
      if (pos) map[d].pos++;
      if (neg) map[d].neg++;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => {
      const parsed = new Date(`${date}T00:00:00`);
      const label = isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      return { date, label, positive: v.pos, negative: v.neg, neutral: Math.max(0, v.total - v.pos - v.neg) };
    });
  }, [trades]);

  const positiveDays = trendByDate.filter(d => d.positive > d.negative).length;
  const negativeDays = trendByDate.filter(d => d.negative > d.positive).length;
  const neutralDays = trendByDate.length - positiveDays - negativeDays;

  const openMood = (m) => onDrill({ title: `${MOOD_EMOJI[m.mood] || ""} ${m.mood} — ${m.total} trades`, trades: m.list });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="tjfx-card p-5 bg-emerald-50/40 tjfx-card-hover cursor-pointer" onClick={() => best && openMood(best)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Best Mood</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{best ? (MOOD_EMOJI[best.mood] || "🙂") : "—"}</span>
            <div className="font-display text-lg font-bold">{best?.mood || "—"}</div>
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-1">{best?.wr || 0}% Win Rate</div>
        </div>
        <div className="tjfx-card p-5 bg-red-50/40 tjfx-card-hover cursor-pointer" onClick={() => worst && openMood(worst)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Worst Mood</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{worst ? (MOOD_EMOJI[worst.mood] || "😕") : "—"}</span>
            <div className="font-display text-lg font-bold">{worst?.mood || "—"}</div>
          </div>
          <div className="text-xs text-red-600 font-semibold mt-1">{worst?.wr || 0}% Win Rate</div>
        </div>
        <div className="tjfx-card p-5 bg-[#F3E8FF]/40 tjfx-card-hover cursor-pointer" onClick={() => mostFrequent && openMood(mostFrequent)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Most Frequent</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{mostFrequent ? (MOOD_EMOJI[mostFrequent.mood] || "🎯") : "—"}</span>
            <div className="font-display text-lg font-bold">{mostFrequent?.mood || "—"}</div>
          </div>
          <div className="text-xs text-[#7C3AED] font-semibold mt-1">{mostFrequent?.total || 0} Trades</div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1.4fr_1fr] gap-5">
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3">Mood Performance Overview</h3>
          {byMood.length === 0 ? <div className="text-sm text-[#6D6D82]">No mood data tagged yet.</div> : (
            <div className="divide-y divide-[#F0F0F5]">
              {byMood.map((m, i) => (
                <ClickableRow
                  key={m.mood}
                  onClick={() => openMood(m)}
                  color={PALETTE[i % PALETTE.length]}
                  emoji={MOOD_EMOJI[m.mood]}
                  label={m.mood}
                  right={<>{m.total}t · {m.wr}%WR · <span className={m.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>{fmtMoney(m.pnl)}</span></>}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="tjfx-card p-6">
            <h3 className="font-display text-lg font-bold mb-2">Mood Impact Score</h3>
            <div className="text-center py-2">
              <div className={`tjfx-mono text-4xl font-bold ${impactScore >= 0 ? "text-[#7C3AED]" : "text-red-500"}`}>{impactScore >= 0 ? "+" : ""}{impactScore}</div>
              <div className="text-xs text-[#6D6D82] mt-1">{impactScore >= 20 ? "Good" : impactScore >= 0 ? "Fair" : "Needs Work"}</div>
            </div>
          </div>
          <div className="tjfx-card p-6">
            <h3 className="font-display text-lg font-bold mb-3">Mood Distribution</h3>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} onClick={(d) => openMood(byMood.find(m => m.mood === d.name))} cursor="pointer">
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1.4fr_1fr] gap-5">
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-1">Mood Trends</h3>
          <div className="text-xs text-[#6D6D82] mb-3">Number of trades per day tagged with a positive or negative mood</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={trendByDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label || ""} formatter={(v, n) => [v, n === "positive" ? "Positive trades" : "Negative trades"]} />
                <ReferenceLine y={0} stroke="#16151F" strokeWidth={1.5} />
                <Bar dataKey="positive" name="positive" fill="#22C55E" radius={[4, 4, 0, 0]} barSize={14} maxBarSize={14} />
                <Bar dataKey="negative" name="negative" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={14} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[#6D6D82]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:"#22C55E"}}/> Positive trades</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:"#EF4444"}}/> Negative trades</span>
          </div>
          <div className="flex gap-2 mt-3 text-xs">
            <div className="flex-1 rounded-lg bg-emerald-50 text-emerald-700 py-2 text-center font-semibold">Positive Days {positiveDays}</div>
            <div className="flex-1 rounded-lg bg-[#F6F6FB] text-[#6D6D82] py-2 text-center font-semibold">Neutral Days {neutralDays}</div>
            <div className="flex-1 rounded-lg bg-red-50 text-red-600 py-2 text-center font-semibold">Negative Days {negativeDays}</div>
          </div>
        </div>

        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#7C3AED]" /> Insights</h3>
          <div className="space-y-2">
            {best && <InsightRow ok label={`You perform best when you're ${best.mood.toLowerCase()}.`} sub={`${best.wr}% win rate`} />}
            {worst && <InsightRow label={`${worst.mood} is hurting your account.`} sub={`${fmtMoney(worst.pnl)} impact`} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightRow({ label, sub, ok }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${ok ? "bg-emerald-50/50" : "bg-red-50/50"}`}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[#6D6D82]">{sub}</div>
      </div>
    </div>
  );
}

/* ---------------- Strategy Tracker ---------------- */

function StrategyTracker({ trades, onDrill }) {
  const byStrategy = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const s = t.strategy || "Unspecified";
      if (!map[s]) map[s] = [];
      map[s].push(t);
    });
    return Object.entries(map)
      .map(([strategy, list]) => ({ strategy, ...statsFor(list), list }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const best = byStrategy[0];
  const worst = byStrategy[byStrategy.length - 1];
  const mostUsed = byStrategy.slice().sort((a, b) => b.total - a.total)[0];
  const avgWinRate = byStrategy.length ? Math.round((byStrategy.reduce((s, x) => s + x.wr, 0) / byStrategy.length) * 10) / 10 : 0;

  const donutData = byStrategy.map((s, i) => ({ name: s.strategy, value: s.total, color: PALETTE[i % PALETTE.length] }));
  const openStrategy = (s) => onDrill({ title: `${s.strategy} — ${s.total} trades`, trades: s.list });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI label="Total Strategies" value={byStrategy.length} icon={LineChartIcon} />
        <KPI label="Best Performing" value={best?.strategy || "—"} icon={Trophy} color="text-emerald-600" />
        <KPI label="Worst Performing" value={worst?.strategy || "—"} icon={TrendingDown} color="text-red-500" />
        <KPI label="Most Used" value={mostUsed?.strategy || "—"} icon={TargetIcon} />
        <KPI label="Avg Win Rate" value={`${avgWinRate}%`} icon={Sparkles} />
      </div>

      <div className="grid md:grid-cols-[1.4fr_1fr] gap-5">
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3">Strategy Performance Overview</h3>
          {byStrategy.length === 0 ? <div className="text-sm text-[#6D6D82]">No strategies tagged yet.</div> : (
            <div className="divide-y divide-[#F0F0F5]">
              {byStrategy.map((s, i) => (
                <ClickableRow
                  key={s.strategy}
                  onClick={() => openStrategy(s)}
                  color={PALETTE[i % PALETTE.length]}
                  label={s.strategy}
                  right={<>{s.total}t · {s.wr}%WR · {s.avgRR}R · <span className={s.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>{fmtMoney(s.pnl)}</span></>}
                />
              ))}
            </div>
          )}
        </div>
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3">Strategy Usage</h3>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2} onClick={(d) => openStrategy(byStrategy.find(s => s.strategy === d.name))} cursor="pointer">
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3">Net P&L by Strategy</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={byStrategy} onClick={(e) => e?.activePayload?.[0] && openStrategy(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" />
                <XAxis dataKey="strategy" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} cursor="pointer" barSize={28} maxBarSize={28}>
                  {byStrategy.map((s, i) => <Cell key={i} fill={s.pnl >= 0 ? "#22C55E" : "#EF4444"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-1">Win Rate vs Avg RR</h3>
          <div className="text-xs text-[#6D6D82] mb-2">Win rate (%) and average R per strategy</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={byStrategy} onClick={(e) => e?.activePayload?.[0] && openStrategy(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" />
                <XAxis dataKey="strategy" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v, n) => [n === "wr" ? `${v}%` : `${v}R`, n === "wr" ? "Win Rate" : "Avg RR"]} labelFormatter={() => ""} />
                <Bar yAxisId="left" dataKey="wr" name="wr" fill="#7C3AED" radius={[4, 4, 0, 0]} cursor="pointer" barSize={14} maxBarSize={14} />
                <Bar yAxisId="right" dataKey="avgRR" name="avgRR" fill="#F59E0B" radius={[4, 4, 0, 0]} cursor="pointer" barSize={14} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[#6D6D82]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:"#7C3AED"}}/> Win Rate %</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:"#F59E0B"}}/> Avg RR</span>
          </div>
        </div>
      </div>

      <div className="tjfx-card p-6">
        <h3 className="font-display text-lg font-bold mb-3">Strategy by Session</h3>
        <StrategyBySession trades={trades} strategies={byStrategy} onDrill={onDrill} />
      </div>
    </div>
  );
}

function StrategyBySession({ trades, strategies, onDrill }) {
  const sessions = useMemo(() => {
    const set = new Set(trades.map(t => t.session).filter(Boolean));
    return Array.from(set);
  }, [trades]);

  if (strategies.length === 0 || sessions.length === 0) return <div className="text-sm text-[#6D6D82]">No session data yet.</div>;

  const cellFor = (strategy, session) => {
    const list = strategy.list.filter(t => t.session === session);
    const s = statsFor(list);
    return { ...s, list };
  };

  const colorFor = (wr) => wr >= 60 ? "bg-emerald-50 text-emerald-700" : wr >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#6D6D82]">
            <th className="py-2 font-medium">Strategy</th>
            {sessions.map(s => <th key={s} className="py-2 font-medium text-center">{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {strategies.map(strat => (
            <tr key={strat.strategy} className="border-t border-[#E8E8F1]">
              <td className="py-2.5 font-medium">{strat.strategy}</td>
              {sessions.map(session => {
                const c = cellFor(strat, session);
                return (
                  <td key={session} className="py-2 text-center">
                    <button
                      onClick={() => c.total > 0 && onDrill({ title: `${strat.strategy} · ${session} — ${c.total} trades`, trades: c.list })}
                      disabled={c.total === 0}
                      className={`tjfx-mono text-xs font-semibold px-2 py-1 rounded-lg ${c.total ? colorFor(c.wr) : "text-[#A1A1AA]"}`}
                    >
                      {c.total ? `${c.wr}%` : "—"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Best Day of Week ---------------- */

function DayTracker({ trades, onDrill }) {
  const byDay = useMemo(() => {
    const map = {};
    DAY_ORDER.forEach(d => map[d] = []);
    trades.forEach(t => {
      const d = dowOf(t.date);
      if (!d) return;
      map[d].push(t);
    });
    return DAY_ORDER.map(day => ({ day, ...statsFor(map[day]), list: map[day] }));
  }, [trades]);

  const withTrades = byDay.filter(d => d.total > 0);
  const best = withTrades.slice().sort((a, b) => b.pnl - a.pnl)[0];
  const worst = withTrades.slice().sort((a, b) => a.pnl - b.pnl)[0];
  const busiest = withTrades.slice().sort((a, b) => b.total - a.total)[0];

  const openDay = (d) => onDrill({ title: `${d.day} — ${d.total} trades`, trades: d.list });
  const maxAbsPnl = Math.max(1, ...byDay.map(d => Math.abs(d.pnl)));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="tjfx-card p-5 bg-emerald-50/40 tjfx-card-hover cursor-pointer" onClick={() => best && openDay(best)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Best Day</div>
          <div className="font-display text-lg font-bold">{best?.day || "—"}</div>
          <div className="text-xs text-emerald-700 font-semibold mt-1">{best ? fmtMoney(best.pnl) : "—"} · {best?.wr || 0}% WR</div>
        </div>
        <div className="tjfx-card p-5 bg-red-50/40 tjfx-card-hover cursor-pointer" onClick={() => worst && openDay(worst)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Worst Day</div>
          <div className="font-display text-lg font-bold">{worst?.day || "—"}</div>
          <div className="text-xs text-red-600 font-semibold mt-1">{worst ? fmtMoney(worst.pnl) : "—"} · {worst?.wr || 0}% WR</div>
        </div>
        <div className="tjfx-card p-5 bg-[#F3E8FF]/40 tjfx-card-hover cursor-pointer" onClick={() => busiest && openDay(busiest)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Busiest Day</div>
          <div className="font-display text-lg font-bold">{busiest?.day || "—"}</div>
          <div className="text-xs text-[#7C3AED] font-semibold mt-1">{busiest?.total || 0} Trades</div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1.3fr_1fr] gap-5">
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3">Performance by Day of Week</h3>
          <div className="divide-y divide-[#F0F0F5]">
            {byDay.map((d, i) => (
              <ClickableRow
                key={d.day}
                onClick={() => d.total > 0 && openDay(d)}
                color={PALETTE[i % PALETTE.length]}
                label={d.day}
                right={d.total ? <>{d.total}t · {d.wr}%WR · <span className={d.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>{fmtMoney(d.pnl)}</span></> : "No trades"}
              />
            ))}
          </div>
        </div>
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3">Net P&L by Day</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={byDay} layout="vertical" margin={{ left: 10 }} onClick={(e) => e?.activePayload?.[0]?.payload?.total > 0 && openDay(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="day" width={70} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="pnl" radius={[0, 6, 6, 0]} cursor="pointer">
                  {byDay.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#22C55E" : "#EF4444"} fillOpacity={maxAbsPnl ? 0.4 + 0.6 * (Math.abs(d.pnl) / maxAbsPnl) : 1} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function hour12Label(h) {
  const period = h < 12 ? "am" : "pm";
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr}${period}`;
}

/* ---------------- Best Time (24h + sessions) ---------------- */

function TimeTracker({ trades, onDrill }) {
  const byHour = useMemo(() => {
    const map = {};
    for (let h = 0; h < 24; h++) map[h] = [];
    trades.forEach(t => {
      const et = t.entry_time;
      if (!et || typeof et !== "string" || !et.includes(":")) return;
      const hr = parseInt(et.split(":")[0], 10) % 24;
      if (isNaN(hr)) return;
      map[hr].push(t);
    });
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, "0")}:00`, label12: hour12Label(h), ...statsFor(map[h]), list: map[h] }));
  }, [trades]);

  const withTrades = byHour.filter(h => h.total > 0);
  const best = withTrades.slice().sort((a, b) => b.pnl - a.pnl)[0];
  const worst = withTrades.slice().sort((a, b) => a.pnl - b.pnl)[0];
  const busiest = withTrades.slice().sort((a, b) => b.total - a.total)[0];

  const bySession = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      let session = t.session;
      if (!session && t.entry_time && t.entry_time.includes(":")) {
        session = sessionOfHour(parseInt(t.entry_time.split(":")[0], 10) % 24);
      }
      session = session || "Unspecified";
      if (!map[session]) map[session] = [];
      map[session].push(t);
    });
    return Object.entries(map).map(([session, list]) => ({ session, ...statsFor(list), list })).sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const openHour = (h) => onDrill({ title: `${h.label} — ${h.total} trades`, trades: h.list });
  const openSession = (s) => onDrill({ title: `${s.session} Session — ${s.total} trades`, trades: s.list });

  const maxAbs = Math.max(1, ...byHour.map(h => Math.abs(h.pnl)));
  const sessionIcon = (s) => s === "Asian" ? Moon : s === "London" ? Globe : s === "New York" ? Sun : Clock;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="tjfx-card p-5 bg-emerald-50/40 tjfx-card-hover cursor-pointer" onClick={() => best && openHour(best)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Best Hour</div>
          <div className="font-display text-lg font-bold tjfx-mono">{best?.label || "—"}</div>
          <div className="text-xs text-emerald-700 font-semibold mt-1">{best ? fmtMoney(best.pnl) : "—"} · {best?.wr || 0}% WR</div>
        </div>
        <div className="tjfx-card p-5 bg-red-50/40 tjfx-card-hover cursor-pointer" onClick={() => worst && openHour(worst)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Worst Hour</div>
          <div className="font-display text-lg font-bold tjfx-mono">{worst?.label || "—"}</div>
          <div className="text-xs text-red-600 font-semibold mt-1">{worst ? fmtMoney(worst.pnl) : "—"} · {worst?.wr || 0}% WR</div>
        </div>
        <div className="tjfx-card p-5 bg-[#F3E8FF]/40 tjfx-card-hover cursor-pointer" onClick={() => busiest && openHour(busiest)}>
          <div className="text-[12px] text-[#6D6D82] font-medium mb-2">Busiest Hour</div>
          <div className="font-display text-lg font-bold tjfx-mono">{busiest?.label || "—"}</div>
          <div className="text-xs text-[#7C3AED] font-semibold mt-1">{busiest?.total || 0} Trades</div>
        </div>
      </div>

      <div className="tjfx-card p-6">
        <h3 className="font-display text-lg font-bold mb-1">24-Hour Performance</h3>
        <div className="text-xs text-[#6D6D82] mb-3">Click a bar to see its trades</div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={byHour} onClick={(e) => e?.activePayload?.[0]?.payload?.total > 0 && openHour(e.activePayload[0].payload)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" />
              <XAxis dataKey="label12" tick={{ fontSize: 9 }} interval={1} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label12 || ""} />
              <ReferenceLine y={0} stroke="#16151F" strokeWidth={1.5} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} cursor="pointer" barSize={16} maxBarSize={16}>
                {byHour.map((h, i) => <Cell key={i} fill={h.total === 0 ? "#E8E8F1" : h.pnl >= 0 ? "#22C55E" : "#EF4444"} fillOpacity={h.total ? 0.4 + 0.6 * (Math.abs(h.pnl) / maxAbs) : 1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tjfx-card p-6">
        <h3 className="font-display text-lg font-bold mb-3">By Session</h3>
        {bySession.length === 0 ? <div className="text-sm text-[#6D6D82]">No session data yet.</div> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {bySession.map((s, i) => {
              const Icon = sessionIcon(s.session);
              return (
                <button key={s.session} onClick={() => openSession(s)} className="text-left rounded-2xl border border-[#E8E8F1] p-4 hover:border-[#7C3AED] transition-colors" data-testid="tracker-session-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] flex items-center justify-center"><Icon className="w-4 h-4 text-[#7C3AED]" /></div>
                      <div className="font-semibold text-sm">{s.session}</div>
                    </div>
                    <span className={`tjfx-mono text-xs font-semibold ${s.pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtMoney(s.pnl)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#6D6D82] tjfx-mono">
                    <span>{s.total} trades</span>
                    <span>{s.wr}% WR</span>
                    <span>{s.avgRR}R avg</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
