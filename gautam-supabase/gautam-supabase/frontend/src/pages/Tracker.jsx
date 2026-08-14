import React, { useEffect, useMemo, useState } from "react";
import { tradesApi } from "@/lib/api";
import { useAccount } from "@/context/AccountContext";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarDays, ChevronDown, Clock3, Crosshair, Filter, Gem, LineChart, Smile, Sparkles, Target, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { formatTradeTime } from "@/lib/time";

const PURPLE = "#7C3AED";
const GREEN = "#16A34A";
const RED = "#DC2626";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TABS = [
  ["overview", "Overview", BarChart3], ["mood", "Mood", Smile], ["strategy", "Strategy", Target],
  ["symbol", "Symbol", Crosshair], ["time", "Best Time", Clock3], ["day", "Best Day", CalendarDays],
];

const money = (value = 0) => `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const pct = (value) => `${Number(value || 0).toFixed(0)}%`;
const safeNumber = (value) => Number(value) || 0;
const dateLabel = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};
const hourFrom = (trade) => Number(String(trade.entry_time || "").split(":")[0]);
const dayFrom = (trade) => {
  const parsed = new Date(`${trade.date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : DAYS[(parsed.getDay() + 6) % 7];
};
const tone = (value) => value >= 0 ? "text-emerald-600" : "text-red-600";

function buildGroup(trades, label) {
  const pnl = trades.reduce((total, trade) => total + safeNumber(trade.net_pnl), 0);
  const wins = trades.filter((trade) => safeNumber(trade.net_pnl) > 0).length;
  const losses = trades.filter((trade) => safeNumber(trade.net_pnl) < 0).length;
  const rr = trades.filter((trade) => trade.r_multiple !== null && trade.r_multiple !== undefined);
  return { label, trades, total: trades.length, pnl, wins, losses, winRate: trades.length ? (wins / trades.length) * 100 : 0, avgRR: rr.length ? rr.reduce((total, trade) => total + safeNumber(trade.r_multiple), 0) / rr.length : 0 };
}

function groupBy(trades, getKey) {
  const groups = new Map();
  trades.forEach((trade) => {
    const key = getKey(trade) || "Not tagged";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  });
  return [...groups.entries()].map(([label, list]) => buildGroup(list, label)).sort((a, b) => b.pnl - a.pnl);
}

export default function Tracker() {
  const { activeId } = useAccount();
  const { user } = useAuth();
  const timeFormat = user?.settings?.time_format || user?.settings?.report_time_format || "12h";
  const navigate = useNavigate();
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("all");
  const [tab, setTab] = useState("overview");
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    setLoading(true);
    tradesApi.list(activeId).then(setAllTrades).catch(() => setAllTrades([])).finally(() => setLoading(false));
  }, [activeId]);

  const trades = useMemo(() => {
    const closed = allTrades.filter((trade) => trade.status === "closed");
    if (range === "all") return closed;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const from = new Date(today); from.setDate(today.getDate() - Number(range) + 1); from.setHours(0, 0, 0, 0);
    return closed.filter((trade) => new Date(`${trade.date}T00:00:00`) >= from);
  }, [allTrades, range]);

  const analytics = useMemo(() => makeAnalytics(trades), [trades]);
  const selectedSection = { overview: <Overview analytics={analytics} onDrill={setDrill} />, mood: <Mood analytics={analytics} onDrill={setDrill} />, strategy: <Strategy analytics={analytics} onDrill={setDrill} />, symbol: <Symbols analytics={analytics} onDrill={setDrill} />, time: <BestTime analytics={analytics} onDrill={setDrill} />, day: <BestDays analytics={analytics} onDrill={setDrill} /> }[tab];

  return <div className="p-4 md:p-6 max-w-[1500px] mx-auto space-y-4" data-testid="tracker-page">
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div><h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Trading Tracker</h1><p className="text-sm text-[#6D6D82] mt-0.5">Track. Analyze. Improve. Repeat.</p></div>
      <div className="flex gap-2">
        <label className="h-10 px-3 rounded-xl border border-[#E8E8F1] bg-white flex items-center gap-2 text-sm font-semibold"><CalendarDays className="w-4 h-4 text-[#7C3AED]" /><select aria-label="Date range" value={range} onChange={(event) => setRange(event.target.value)} className="bg-transparent outline-none pr-1"><option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select><ChevronDown className="w-3.5 h-3.5 text-[#6D6D82]" /></label>
        <button onClick={() => navigate("/trades")} className="h-10 px-3 rounded-xl border border-[#E8E8F1] bg-white hover:border-[#7C3AED] text-sm font-semibold flex items-center gap-2"><Filter className="w-4 h-4 text-[#7C3AED]" />Trades</button>
      </div>
    </header>
    {loading ? <Loading /> : trades.length === 0 ? <Empty navigate={navigate} /> : <>
      <TopDeck analytics={analytics} />
      <nav className="tjfx-card p-1.5 flex overflow-x-auto gap-1" aria-label="Tracker sections">{TABS.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`h-9 px-3 rounded-lg shrink-0 text-sm font-semibold flex items-center gap-1.5 transition-colors ${tab === id ? "bg-[#F3E8FF] text-[#6D28D9]" : "text-[#6D6D82] hover:bg-[#F8F7FB]"}`}><Icon className="w-4 h-4" />{label}</button>)}</nav>
      {selectedSection}
      <DrillDialog drill={drill} onClose={() => setDrill(null)} navigate={navigate} timeFormat={timeFormat} />
    </>}
  </div>;
}

function makeAnalytics(trades) {
  const summary = buildGroup(trades, "All trades");
  const symbols = groupBy(trades, (trade) => trade.symbol || "Unknown symbol");
  const strategies = groupBy(trades, (trade) => trade.strategy || "No strategy");
  const moods = groupBy(trades.flatMap((trade) => [...new Set([...(trade.mood_before || []), ...(trade.mood_during || []), ...(trade.mood_after || [])])].map((mood) => ({ ...trade, _mood: mood }))), (trade) => trade._mood);
  const days = DAYS.map((day) => buildGroup(trades.filter((trade) => dayFrom(trade) === day), day));
  const hours = Array.from({ length: 24 }, (_, hour) => buildGroup(trades.filter((trade) => hourFrom(trade) === hour), `${String(hour).padStart(2, "0")}:00`));
  const dates = [...new Set(trades.map((trade) => trade.date).filter(Boolean))].sort().map((date) => ({ date, label: dateLabel(date), pnl: trades.filter((trade) => trade.date === date).reduce((total, trade) => total + safeNumber(trade.net_pnl), 0) })).map((point, index, array) => ({ ...point, equity: array.slice(0, index + 1).reduce((total, item) => total + item.pnl, 0) }));
  const grossWin = trades.filter((trade) => safeNumber(trade.net_pnl) > 0).reduce((total, trade) => total + safeNumber(trade.net_pnl), 0);
  const grossLoss = Math.abs(trades.filter((trade) => safeNumber(trade.net_pnl) < 0).reduce((total, trade) => total + safeNumber(trade.net_pnl), 0));
  const bestDay = [...days].sort((a, b) => b.pnl - a.pnl)[0];
  const bestMonth = groupBy(trades, (trade) => String(trade.date || "").slice(0, 7)).map((item) => ({ ...item, display: item.label ? new Date(`${item.label}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Unknown" }))[0];
  return { summary, symbols, strategies, moods, days, hours, dates, bestDay, bestMonth, profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0 };
}

function TopDeck({ analytics }) {
  const { summary, strategies, moods, bestDay, bestMonth } = analytics;
  const bestStrategy = strategies[0]; const bestMood = moods[0];
  return <section className="grid xl:grid-cols-[1.05fr_1.95fr] gap-4">
    <Card className="p-4 border-[#D8B4FE] bg-gradient-to-br from-[#FCF9FF] to-[#F5EDFF]"><div className="flex gap-2 items-center text-[#6D28D9] font-bold text-sm"><Gem className="w-4 h-4" />TRADER DNA</div><div className="mt-2 divide-y divide-[#E9D5FF] text-sm">{[["Best Strategy", bestStrategy?.label || "—"], ["Best Mood", bestMood?.label || "—"], ["Best Symbol", analytics.symbols[0]?.label || "—"], ["Best Day", bestDay?.label || "—"], ["Best Month", bestMonth?.display || "—"], ["Avg RR", `${summary.avgRR.toFixed(2)}R`]].map(([label, value]) => <div className="py-2 flex justify-between gap-3" key={label}><span className="text-[#6D6D82]">{label}</span><b className="text-right">{value}</b></div>)}</div></Card>
    <div className="grid sm:grid-cols-2 gap-4"><Metric label="Net P&L" value={money(summary.pnl)} good={summary.pnl >= 0} icon={TrendingUp} spark={analytics.dates.map((d) => d.equity)} /><Metric label="Win Rate" value={pct(summary.winRate)} good={summary.winRate >= 50} icon={Trophy} ring={summary.winRate} /><Metric label="Avg RR" value={`${summary.avgRR.toFixed(2)}R`} good={summary.avgRR >= 0} icon={Target} spark={analytics.hours.map((h) => h.avgRR)} /><Metric label="Total Trades" value={summary.total} good icon={BarChart3} spark={analytics.dates.map((d) => d.pnl)} /></div>
  </section>;
}

function Overview({ analytics, onDrill }) { const { summary } = analytics; return <section className="grid lg:grid-cols-2 gap-4"><Card title="Equity Curve" subtitle={money(summary.pnl)} subtitleTone={summary.pnl >= 0}><Chart data={analytics.dates} dataKey="equity" /></Card><Card title="Performance Summary"><div className="grid sm:grid-cols-[170px_1fr] gap-3 items-center"><button className="h-44" onClick={() => onDrill({ title: "All closed trades", trades: summary.trades })}><ResponsiveContainer><PieChart><Pie data={[{ name: "Win", value: summary.wins }, { name: "Loss", value: summary.losses }, { name: "Breakeven", value: Math.max(0, summary.total - summary.wins - summary.losses) }]} dataKey="value" innerRadius={45} outerRadius={68} paddingAngle={3}>{[GREEN, RED, "#C4C4D0"].map((fill) => <Cell key={fill} fill={fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></button><div className="space-y-2 text-sm"><StatLine label="Win" value={`${summary.wins} (${pct(summary.winRate)})`} dot={GREEN} onClick={() => onDrill({ title: "Winning trades", trades: summary.trades.filter(t => safeNumber(t.net_pnl) > 0) })} /><StatLine label="Loss" value={`${summary.losses}`} dot={RED} onClick={() => onDrill({ title: "Losing trades", trades: summary.trades.filter(t => safeNumber(t.net_pnl) < 0) })} /><StatLine label="Profit factor" value={Number.isFinite(analytics.profitFactor) ? analytics.profitFactor.toFixed(2) : "∞"} /><StatLine label="Expectancy" value={money(summary.total ? summary.pnl / summary.total : 0)} /><StatLine label="Average R" value={`${summary.avgRR.toFixed(2)}R`} /></div></div></Card><Mood analytics={analytics} compact onDrill={onDrill} /><Strategy analytics={analytics} compact onDrill={onDrill} /><Symbols analytics={analytics} compact onDrill={onDrill} /><BestTime analytics={analytics} compact onDrill={onDrill} /><BestDays analytics={analytics} compact onDrill={onDrill} /><Insights analytics={analytics} /></section>; }
function Mood({ analytics, compact = false, onDrill }) { const rows = analytics.moods.slice(0, compact ? 4 : 8); return <Card title="Mood Analytics"><RankRows rows={rows} empty="No mood tags added yet." onDrill={onDrill} /><div className="grid grid-cols-2 gap-2 mt-3"><MiniResult label="Best Mood" item={analytics.moods[0]} onDrill={onDrill} /><MiniResult label="Needs care" item={[...analytics.moods].sort((a,b)=>a.pnl-b.pnl)[0]} bad onDrill={onDrill} /></div></Card>; }
function Strategy({ analytics, compact = false, onDrill }) { return <Card title="Strategy Performance"><RankRows rows={analytics.strategies.slice(0, compact ? 4 : 8)} empty="No strategy data added yet." onDrill={onDrill} /><div className="mt-3"><MiniResult label="Best Strategy" item={analytics.strategies[0]} onDrill={onDrill} /></div></Card>; }
function Symbols({ analytics, compact = false, onDrill }) { return <Card title="Best Symbols"><div className="space-y-1">{analytics.symbols.slice(0, compact ? 4 : 10).map((item, index) => <button key={item.label} className="w-full rounded-lg px-2 py-2 hover:bg-[#F8F7FB] flex items-center justify-between text-left" onClick={() => onDrill({ title: `${item.label} trades`, trades: item.trades })}><span className="flex gap-2 items-center"><span className="w-5 text-xs text-[#7C3AED] font-bold">#{index + 1}</span><b className="text-sm">{item.label}</b><small className="text-[#6D6D82]">{item.total} trades</small></span><b className={`tjfx-mono text-sm ${tone(item.pnl)}`}>{money(item.pnl)}</b></button>)}</div><div className="mt-3"><MiniResult label="Most Profitable" item={analytics.symbols[0]} onDrill={onDrill} /></div></Card>; }
function BestTime({ analytics, compact = false, onDrill }) { const hours = analytics.hours; const best = [...hours].sort((a,b)=>b.pnl-a.pnl)[0]; return <Card title="Best Trading Time"><div className="grid grid-cols-12 gap-1 mt-1">{hours.map((hour) => <button key={hour.label} title={`${hour.label}: ${money(hour.pnl)}`} onClick={() => hour.total && onDrill({ title: `${hour.label} trades`, trades: hour.trades })} className="aspect-square rounded-sm hover:ring-2 hover:ring-[#7C3AED]" style={{ background: hour.total ? hour.pnl >= 0 ? `rgba(22,163,74,${Math.min(.88,.18 + Math.abs(hour.pnl)/(Math.max(...hours.map(h=>Math.abs(h.pnl)),1))*.7)})` : `rgba(220,38,38,${Math.min(.88,.18 + Math.abs(hour.pnl)/(Math.max(...hours.map(h=>Math.abs(h.pnl)),1))*.7)})` : "#F1F1F5" }} />)}</div><div className="flex justify-between text-[10px] text-[#6D6D82] mt-1"><span>00:00</span><span>12:00</span><span>23:00</span></div><div className="grid grid-cols-2 gap-2 mt-3"><MiniResult label="Best Time" item={best} onDrill={onDrill} /><MiniResult label="Most Active" item={[...hours].sort((a,b)=>b.total-a.total)[0]} onDrill={onDrill} /></div></Card>; }
function BestDays({ analytics, compact = false, onDrill }) { const days = analytics.days; return <Card title="Best Days"><div className="h-32"><ResponsiveContainer><BarChart data={days} onClick={(event) => { const item = event?.activePayload?.[0]?.payload; if (item?.total) onDrill({ title: `${item.label} trades`, trades: item.trades }); }}><XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(value) => money(value)} /><Bar dataKey="pnl" radius={[5,5,0,0]}>{days.map((day) => <Cell key={day.label} fill={day.pnl >= 0 ? GREEN : RED} />)}</Bar></BarChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2 mt-2"><MiniResult label="Best Day" item={analytics.bestDay} onDrill={onDrill} /><MiniResult label="Worst Day" item={[...days].sort((a,b)=>a.pnl-b.pnl)[0]} bad onDrill={onDrill} /></div></Card>; }
function Insights({ analytics }) { const bestSymbol = analytics.symbols[0]; const bestStrategy = analytics.strategies[0]; return <Card className="lg:col-span-2 bg-gradient-to-r from-[#FBF8FF] to-white" title="AI Insights"><div className="grid md:grid-cols-[auto_1fr_1fr] gap-3 items-start"><div className="w-11 h-11 rounded-2xl bg-[#7C3AED] text-white grid place-items-center"><Sparkles className="w-5 h-5" /></div><div><b className="text-sm">You perform best when:</b><ul className="mt-1 text-sm text-[#535368] space-y-1"><li>✓ Trading {bestStrategy?.label || "your tagged strategy"}</li><li>✓ Focusing on {bestSymbol?.label || "your strongest symbols"}</li><li>✓ Keeping risk-reward above {analytics.summary.avgRR.toFixed(2)}R</li></ul></div><div><b className="text-sm">Next focus:</b><p className="mt-1 text-sm text-[#535368]">Review losing trades and tag mood, strategy and session consistently. Your Tracker becomes sharper after every closed trade.</p></div></div></Card>; }

function Card({ title, subtitle, subtitleTone, children, className = "" }) { return <section className={`tjfx-card p-4 ${className}`}><div className="flex items-start justify-between gap-2 mb-3">{title && <div><h2 className="font-display font-bold text-sm uppercase tracking-wide">{title}</h2>{subtitle && <b className={`tjfx-mono text-xl ${subtitleTone ? "text-emerald-600" : "text-red-600"}`}>{subtitle}</b>}</div>}</div>{children}</section>; }
function Metric({ label, value, good, icon: Icon, spark, ring }) { return <Card className="min-h-[132px]"><div className="flex justify-between"><span className="text-sm text-[#6D6D82]">{label}</span><Icon className="w-4 h-4 text-[#7C3AED]" /></div><div className={`tjfx-mono text-2xl font-bold mt-1 ${good ? "text-emerald-600" : "text-red-600"}`}>{value}</div>{ring !== undefined ? <div className="w-12 h-12 mt-1 rounded-full grid place-items-center text-[10px] font-bold" style={{ background: `conic-gradient(${GREEN} ${ring}%, #ECECF2 0)`, boxShadow:"inset 0 0 0 7px white" }}>{pct(ring)}</div> : <div className="h-9 mt-2"><ResponsiveContainer><AreaChart data={spark.map((value,index)=>({index,value}))}><Area type="monotone" dataKey="value" stroke={good ? GREEN : RED} fill={good ? "#DCFCE7" : "#FEE2E2"} strokeWidth={2}/></AreaChart></ResponsiveContainer></div>}</Card>; }
function Chart({ data, dataKey }) { return <div className="h-52"><ResponsiveContainer><AreaChart data={data}><defs><linearGradient id="eq" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={PURPLE} stopOpacity=".28"/><stop offset="100%" stopColor={PURPLE} stopOpacity="0"/></linearGradient></defs><XAxis dataKey="label" tick={{fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10}} width={40} axisLine={false} tickLine={false}/><Tooltip formatter={(value)=>money(value)} /><Area type="monotone" dataKey={dataKey} stroke={PURPLE} fill="url(#eq)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div>; }
function RankRows({ rows, empty, onDrill }) { const max = Math.max(...rows.map((row)=>Math.abs(row.pnl)), 1); return rows.length ? <div className="space-y-2">{rows.map((row) => <button type="button" onClick={() => onDrill?.({ title: `${row.label} trades`, trades: row.trades })} key={row.label} className="w-full text-left rounded-lg p-1 hover:bg-[#F8F7FB]"><div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{row.label}</span><span className={`tjfx-mono ${tone(row.pnl)}`}>{money(row.pnl)}</span></div><div className="mt-1 h-1.5 bg-[#F0F0F5] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#7C3AED]" style={{width:`${Math.max(8,Math.abs(row.pnl)/max*100)}%`}} /></div><small className="text-[#8B8B9A]">{row.total} trades · {pct(row.winRate)} WR · {row.avgRR.toFixed(2)}R</small></button>)}</div> : <p className="text-sm text-[#8B8B9A]">{empty}</p>; }
function MiniResult({ label, item, bad, onDrill }) { return <button type="button" onClick={() => item && onDrill?.({ title: `${item.label} trades`, trades: item.trades })} className={`rounded-xl border p-2.5 text-left hover:ring-1 hover:ring-[#7C3AED] ${bad ? "border-red-100 bg-red-50/30" : "border-emerald-100 bg-emerald-50/30"}`}><small className="text-[#6D6D82] block">{label}</small><b className="text-sm block truncate">{item?.label || "—"}</b><span className={`tjfx-mono text-xs ${item ? tone(item.pnl) : "text-[#6D6D82]"}`}>{item ? money(item.pnl) : "No data"}</span></button>; }
function StatLine({ label, value, dot, onClick }) { const content = <><span className="text-[#6D6D82] flex items-center gap-2">{dot && <i className="w-2 h-2 rounded-full" style={{background:dot}} />}{label}</span><b className="tjfx-mono">{value}</b></>; return onClick ? <button onClick={onClick} className="w-full flex justify-between items-center border-b border-[#F0F0F5] pb-1.5 last:border-0 hover:text-[#7C3AED]">{content}</button> : <div className="flex justify-between items-center border-b border-[#F0F0F5] pb-1.5 last:border-0">{content}</div>; }
function DrillDialog({ drill, onClose, navigate, timeFormat }) { return <Dialog open={!!drill} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-4xl bg-white"><DialogHeader><DialogTitle>{drill?.title}</DialogTitle></DialogHeader><div className="flex justify-between items-center text-xs text-[#6D6D82]"><span>{drill?.trades?.length || 0} matching closed trades</span><button onClick={() => { onClose(); navigate("/trades"); }} className="font-semibold text-[#7C3AED] hover:underline">Open Trade View</button></div><div className="max-h-[58vh] overflow-auto rounded-xl border border-[#E8E8F1]"><table className="w-full min-w-[650px] text-sm"><thead className="sticky top-0 bg-[#FAFAFD] text-left text-[#6D6D82]"><tr><th className="p-3 font-medium">Date</th><th className="p-3 font-medium">Symbol</th><th className="p-3 font-medium">Direction</th><th className="p-3 font-medium">Strategy</th><th className="p-3 font-medium">R</th><th className="p-3 font-medium text-right">P&L</th></tr></thead><tbody>{(drill?.trades || []).map((trade) => <tr key={trade.id} className="border-t border-[#F0F0F5] hover:bg-[#FBF8FF]"><td className="p-3 tjfx-mono text-xs">{trade.date || "—"}<br/><span className="text-[#8B8B9A]">{trade.entry_time ? formatTradeTime(trade.entry_time, timeFormat) : ""}</span></td><td className="p-3 font-bold">{trade.symbol || "—"}</td><td className="p-3 capitalize">{trade.direction || "—"}</td><td className="p-3 max-w-[180px] truncate">{trade.strategy || "—"}</td><td className="p-3 tjfx-mono">{trade.r_multiple !== null && trade.r_multiple !== undefined ? `${safeNumber(trade.r_multiple).toFixed(2)}R` : "—"}</td><td className={`p-3 text-right tjfx-mono font-bold ${tone(safeNumber(trade.net_pnl))}`}>{money(safeNumber(trade.net_pnl))}</td></tr>)}</tbody></table></div></DialogContent></Dialog>; }
function Loading() { return <div className="tjfx-card p-12 text-center text-sm text-[#6D6D82]">Loading your trading performance…</div>; }
function Empty({ navigate }) { return <div className="tjfx-card p-12 text-center"><LineChart className="w-8 h-8 text-[#7C3AED] mx-auto mb-3"/><h2 className="font-display font-bold text-xl">Your tracker is ready</h2><p className="text-sm text-[#6D6D82] mt-1">Add closed trades with symbol, strategy and mood to unlock the complete analysis.</p><button onClick={() => navigate("/add-trade")} className="mt-4 h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-bold">Add your first trade</button></div>; }
