import React, { useEffect, useMemo, useRef, useState } from "react";
import { statsApi, biasApi, settingsApi, tradesApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, Target, Activity, Wallet, Sparkles, Settings2, Eye, EyeOff, ArrowUp, ArrowDown, Trophy, Calendar, Flame, PiggyBank, GripVertical } from "lucide-react";
import { Link } from "react-router-dom";
import DisciplineStreak from "@/components/DisciplineStreak";
import { PerformanceOverview, TradingStats, PnlByPeriod, SessionBreakdown, MonthlyCalendar, ActiveTimes, TradesBreakdown, TopPairs, OpenPositions } from "@/components/DashboardProWidgets";

const WIDGETS = [
  { id: "kpis",       label: "Quick Stats", size: "auto" },
  { id: "equity",     label: "Equity Curve", size: "auto" },
  { id: "plan",       label: "Today's Plan", size: "auto" },
  { id: "extras",     label: "More Stats", size: "auto" },
  { id: "sessions",   label: "Sessions Performance", size: "auto" },
  { id: "recent",     label: "Recent Trades", size: "auto" },
  { id: "ai",         label: "AI Insight", size: "auto" },
  { id: "discipline", label: "Discipline Streak", size: "auto" },
  { id: "performance", label: "Performance Overview", size: "auto" },
  { id: "tradingStats", label: "Trading Stats", size: "auto" },
  { id: "dailyPnl", label: "P&L by Day", size: "auto" },
  { id: "weeklyPnl", label: "P&L by Week", size: "auto" },
  { id: "sessionBreakdown", label: "P&L by Session", size: "auto" },
  { id: "calendar", label: "Monthly Calendar", size: "auto" },
  { id: "activeTimes", label: "Most Active Times", size: "auto" },
  { id: "breakdown", label: "Trades Breakdown", size: "auto" },
  { id: "pairs", label: "Top Performing Pairs", size: "auto" },
  { id: "positions", label: "Open Positions", size: "auto" },
];
const DEFAULT_LAYOUT = WIDGETS.map(w => ({ id: w.id, visible: true, size: w.size }));
const KEY = "tjfx.dashboard.layout.v2";

function loadLayout(savedLayout) {
  try {
    const raw = Array.isArray(savedLayout) ? savedLayout : JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(raw) && raw.every(x => x && x.id)) {
      const known = new Set(raw.map(x => x.id));
      return [...raw, ...DEFAULT_LAYOUT.filter(x => !known.has(x.id))];
    }
  } catch {}
  return DEFAULT_LAYOUT;
}
function saveLayout(l) { localStorage.setItem(KEY, JSON.stringify(l)); }

const AUTO_SIZE_CLASS = { kpis: "col-span-12", equity: "col-span-12 md:col-span-8", plan: "col-span-12 md:col-span-4", extras: "col-span-12", sessions: "col-span-12 md:col-span-6", recent: "col-span-12 md:col-span-6", ai: "col-span-12 md:col-span-6", discipline: "col-span-12 md:col-span-6", performance: "col-span-12 md:col-span-6", tradingStats: "col-span-12 md:col-span-6", dailyPnl: "col-span-12 md:col-span-4", weeklyPnl: "col-span-12 md:col-span-4", sessionBreakdown: "col-span-12 md:col-span-4", calendar: "col-span-12 md:col-span-6", activeTimes: "col-span-12 md:col-span-6", breakdown: "col-span-12 md:col-span-4", pairs: "col-span-12 md:col-span-4", positions: "col-span-12 md:col-span-4" };
const SIZE_CLASS = { sm: "col-span-12 md:col-span-4", md: "col-span-12 md:col-span-6", lg: "col-span-12 md:col-span-8", full: "col-span-12" };
const NEXT_SIZE = { auto: "sm", sm: "md", md: "lg", lg: "full", full: "auto" };
const SIZE_LABEL = { auto: "Auto", sm: "S", md: "M", lg: "L", full: "XL" };

function SortableCard({ id, size, customize, onCycleSize, onDragStart, onDragOver, onDrop, onDragEnd, draggingId, children, testid }) {
  const isDragging = draggingId === id;
  return (
    <div
      className={`${size === "auto" ? AUTO_SIZE_CLASS[id] : SIZE_CLASS[size||"lg"]} relative min-w-0 transition-opacity ${isDragging ? "opacity-40" : ""}`}
      data-testid={testid}
      onDragOver={(event) => onDragOver(event, id)}
      onDrop={(event) => onDrop(event, id)}
    >
      {customize && (
        <div className="absolute -top-2 -left-2 z-30 flex items-center gap-1">
          <button draggable onDragStart={(event) => onDragStart(event, id)} onDragEnd={onDragEnd} className="cursor-grab active:cursor-grabbing h-8 w-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center shadow-lg" title="Drag to move"><GripVertical className="w-4 h-4"/></button>
          <button onClick={()=>onCycleSize(id)} className="h-8 px-2 rounded-full bg-white border border-[#E8E8F1] text-xs font-bold text-[#7C3AED] shadow" title="Change size">{SIZE_LABEL[size||"lg"]}</button>
        </div>
      )}
      <div className={customize ? "ring-2 ring-[#7C3AED]/40 rounded-2xl transition-all" : ""}>{children}</div>
    </div>
  );
}

const Card = ({ children, className = "", ...p }) => (
  <div className={`tjfx-card p-6 tjfx-card-hover h-full ${className}`} {...p}>{children}</div>
);

function StatCard({ label, value, icon: Icon, color = "text-[#16151F]", testid }) {
  return (
    <div className="tjfx-card p-5 tjfx-card-hover" data-testid={testid}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-[13px] text-[#6D6D82] font-medium">{label}</div>
        <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] flex items-center justify-center"><Icon className="w-4 h-4 text-[#7C3AED]"/></div>
      </div>
      <div className={`tjfx-mono text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { activeId, active, accounts } = useAccount();
  const [stats, setStats] = useState(null);
  const [dailyBias, setDailyBias] = useState(null);
  const [weeklyBias, setWeeklyBias] = useState(null);
  const [trades, setTrades] = useState([]);
  const [layout, setLayout] = useState(() => loadLayout(user?.settings?.dashboard_layout));
  const [customize, setCustomize] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const firstSave = useRef(true);

  useEffect(() => {
    statsApi.dashboard(activeId).then(setStats).catch(() => setStats(null));
    biasApi.latest("daily").then(setDailyBias).catch(() => {});
    biasApi.latest("weekly").then(setWeeklyBias).catch(() => {});
    tradesApi.list(activeId).then(setTrades).catch(() => setTrades([]));
  }, [activeId]);

  const tradeAnalytics = useMemo(() => makeTradeAnalytics(trades), [trades]);

  useEffect(() => { saveLayout(layout); }, [layout]);

  useEffect(() => {
    // Browser storage is only an offline fallback. The profile copy follows the user to every device.
    if (firstSave.current) { firstSave.current = false; return; }
    settingsApi.update({ dashboard_layout: layout }).catch(() => {});
  }, [layout]);

  // Native HTML drag-and-drop keeps this dashboard dependency-free. The saved array
  // is also the rendered order, so a dropped card cannot be re-packed somewhere else.
  const onDragStart = (event, id) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
  };
  const onDragOver = (event, id) => {
    if (draggingId && draggingId !== id) event.preventDefault();
  };
  const onDrop = (event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggingId;
    if (!sourceId || sourceId === targetId) { setDraggingId(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    setLayout(current => {
      const sourceIndex = current.findIndex(item => item.id === sourceId);
      const targetIndex = current.findIndex(item => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const adjustedTarget = next.findIndex(item => item.id === targetId);
      next.splice(adjustedTarget + (insertAfter ? 1 : 0), 0, moved);
      return next;
    });
    setDraggingId(null);
  };
  const cycleSize = (id) => setLayout(l => l.map(x => x.id===id? {...x, size: NEXT_SIZE[x.size||"auto"]}: x));
  const toggleVisible = (id) => setLayout(l => l.map(x => x.id===id? {...x, visible: !x.visible}: x));
  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  const now = new Date();
  const greet = now.getHours() < 12 ? "Good Morning" : now.getHours() < 17 ? "Good Afternoon" : "Good Evening";

  const R = {
    kpis: (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full">
        <StatCard testid="stat-pnl" label="Today's P&L" value={`${(stats?.todays_pnl ?? 0) >= 0 ? "+" : ""}$${(stats?.todays_pnl ?? 0).toFixed(2)}`}
          icon={TrendingUp} color={(stats?.todays_pnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} />
        <StatCard testid="stat-winrate" label="Win Rate" value={`${stats?.win_rate ?? 0}%`} icon={Target} />
        <StatCard testid="stat-pf" label="Profit Factor" value={stats?.profit_factor ?? 0} icon={Activity} />
        <StatCard testid="stat-open" label="Open" value={stats?.open_positions ?? 0} icon={Wallet} />
      </div>
    ),
    equity: (
      <Card data-testid="equity-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Equity Curve</h3>
          <div className="text-[12px] text-[#6D6D82] tjfx-mono">Net: <span className={(stats?.total_pnl??0)>=0?"text-emerald-600":"text-red-500"}>${(stats?.total_pnl??0).toFixed(2)}</span></div>
        </div>
        <div className="h-[240px]">
          {stats?.equity_curve && stats.equity_curve.length>0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equity_curve} margin={{top:10,right:10,left:0,bottom:0}}>
                <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35}/><stop offset="100%" stopColor="#7C3AED" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="date" tick={{fontSize:11, fill:"#A1A1AA"}} />
                <YAxis tick={{fontSize:11, fill:"#A1A1AA"}} />
                <Tooltip contentStyle={{borderRadius:12, border:"1px solid #E8E8F1"}}/>
                <Area type="monotone" dataKey="equity" stroke="#7C3AED" strokeWidth={2} fill="url(#eq)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="No closed trades yet. Add a trade to plot your curve."/>}
        </div>
      </Card>
    ),
    plan: (
      <Card data-testid="plan-card">
        <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#7C3AED]"/> Today's Plan</h3>
        <div className="space-y-3 text-sm">
          <Row label="HTF Bias" val={weeklyBias?.direction?.toUpperCase() || "—"} accent={weeklyBias?.direction==="bullish"?"text-emerald-600":weeklyBias?.direction==="bearish"?"text-red-500":""}/>
          <Row label="Daily Bias" val={dailyBias?.direction?.toUpperCase() || "—"} accent={dailyBias?.direction==="bullish"?"text-emerald-600":dailyBias?.direction==="bearish"?"text-red-500":""}/>
          <Row label="Session" val={dailyBias?.session || "—"} />
          <Row label="Confidence" val={dailyBias?.confidence ? `${dailyBias.confidence}%` : "—"} />
        </div>
        <Link to="/bias" className="mt-5 inline-flex items-center justify-center w-full h-10 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold" data-testid="view-plan-btn">Open Bias Center</Link>
      </Card>
    ),
    extras: (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="extras-card">
        <StatCard label="Avg Win" value={`$${(stats?.avg_win||0).toFixed(2)}`} icon={ArrowUp} color="text-emerald-600"/>
        <StatCard label="Avg Loss" value={`$${(stats?.avg_loss||0).toFixed(2)}`} icon={ArrowDown} color="text-red-500"/>
        <StatCard label="Max Drawdown" value={`$${(stats?.max_drawdown||0).toFixed(2)}`} icon={Flame} color="text-orange-500"/>
        <StatCard label="Best Day" value={stats?.best_day?.pnl!=null?`$${stats.best_day.pnl.toFixed(2)}`:"—"} icon={Trophy} color="text-emerald-600"/>
      </div>
    ),
    sessions: (
      <Card data-testid="sessions-card">
        <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#7C3AED]"/> Sessions Performance</h3>
        {(!stats?.sessions || stats.sessions.length===0) ? <EmptyChart msg="Session stats will appear once you log trades." /> :
          <div className="space-y-3">
            {stats.sessions.map(s => (
              <div key={s.session}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{s.session}</span>
                  <span className="tjfx-mono text-[#6D6D82]">{s.trades}t · {s.win_rate}%WR · <span className={s.pnl>=0?"text-emerald-600":"text-red-500"}>${s.pnl.toFixed(2)}</span></span>
                </div>
                <div className="h-2 bg-[#F6F6FB] rounded-full overflow-hidden"><div className={`h-full ${s.pnl>=0?"bg-emerald-500":"bg-red-500"}`} style={{width: `${Math.min(100, Math.abs(s.win_rate))}%`}}/></div>
              </div>
            ))}
          </div>
        }
      </Card>
    ),
    recent: (
      <Card data-testid="recent-card">
        <div className="flex items-center justify-between mb-4"><h3 className="font-display text-lg font-bold">Recent Trades</h3><Link to="/trades" className="text-sm text-[#7C3AED] hover:underline">View all</Link></div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead className="text-[#6D6D82]"><tr className="text-left"><th className="py-2 font-medium">Symbol</th><th className="py-2 font-medium">Dir</th><th className="py-2 font-medium">Result</th><th className="py-2 font-medium">R:R</th><th className="py-2 font-medium">Date</th></tr></thead>
            <tbody>
              {(stats?.recent_trades||[]).length===0 && <tr><td colSpan={5} className="py-10 text-center text-[#6D6D82]">No trades yet. <Link className="text-[#7C3AED] font-medium" to="/add-trade">Add trade →</Link></td></tr>}
              {(stats?.recent_trades||[]).map(t => (
                <tr key={t.id} className="border-t border-[#E8E8F1]">
                  <td className="py-3 font-semibold tjfx-mono">{t.symbol}</td>
                  <td className={t.direction==="long"?"text-emerald-600":"text-red-500"}>{t.direction==="long"?"↑ Long":"↓ Short"}</td>
                  <td className={`tjfx-mono ${(t.net_pnl||0)>=0?"text-emerald-600":"text-red-500"}`}>{(t.net_pnl||0)>=0?"+":""}${(t.net_pnl||0).toFixed(2)}</td>
                  <td className="tjfx-mono">{t.r_multiple?`1:${t.r_multiple}`:"—"}</td>
                  <td className="text-[#6D6D82] tjfx-mono">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    ),
    ai: (
      <Card className="bg-gradient-to-br from-[#F3E8FF] to-white" data-testid="ai-insight-card">
        <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#7C3AED]"/> AI Insight</h3>
        <p className="text-sm leading-relaxed">{dailyBias?.ai_summary || "Log your daily bias and add a few trades to unlock personalised AI coaching insights."}</p>
        <Link to="/psychology" className="mt-4 inline-flex items-center gap-1 text-sm text-[#7C3AED] font-semibold">Open Psychology →</Link>
      </Card>
    ),
    discipline: <DisciplineStreak/>,
    performance: <PerformanceOverview analytics={tradeAnalytics}/>,
    tradingStats: <TradingStats analytics={tradeAnalytics}/>,
    dailyPnl: <PnlByPeriod title="P&L by Day" data={tradeAnalytics.daily}/>,
    weeklyPnl: <PnlByPeriod title="P&L by Week" data={tradeAnalytics.weekly}/>,
    sessionBreakdown: <SessionBreakdown data={tradeAnalytics.sessions}/>,
    calendar: <MonthlyCalendar data={tradeAnalytics.daily}/>,
    activeTimes: <ActiveTimes data={tradeAnalytics.hours}/>,
    breakdown: <TradesBreakdown data={tradeAnalytics.strategies}/>,
    pairs: <TopPairs data={tradeAnalytics.pairs}/>,
    positions: <OpenPositions data={tradeAnalytics.open}/>,
  };

  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-6" data-testid="dashboard-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="tjfx-card px-5 py-4 bg-gradient-to-r from-[#F3E8FF] to-white" data-testid="motivation-card">
            <div className="text-[11px] text-[#7C3AED] font-semibold uppercase tracking-wide mb-1">Today's Motivation</div>
            <div className="font-display text-base md:text-lg font-bold leading-snug text-[#16151F] line-clamp-2">{user?.settings?.motivation || "Stay disciplined. Follow the plan."}</div>
          </div>
          <p className="text-[#6D6D82] mt-3 text-sm">
            {activeId==="all" ? `Viewing all ${accounts.length} account${accounts.length!==1?"s":""}` : `Viewing ${active?.name} · $${(active?.balance||0).toFixed(2)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customize && <button onClick={resetLayout} className="h-10 px-3 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm">Reset</button>}
          <button onClick={()=>setCustomize(!customize)} data-testid="customize-btn" className={`h-10 px-4 rounded-xl text-sm font-medium flex items-center gap-2 ${customize? "bg-[#7C3AED] text-white":"border border-[#E8E8F1] hover:border-[#7C3AED]"}`}>
            <Settings2 className="w-4 h-4"/> {customize? "Done":"Customize"}
          </button>
        </div>
      </div>

      {customize && (
        <div className="tjfx-card p-4" data-testid="customize-panel">
          <div className="text-sm text-[#6D6D82] mb-3"><strong className="text-[#16151F]">Drag any card</strong> using the purple handle to reorder. Tap the <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border border-[#E8E8F1] text-[10px] font-bold text-[#7C3AED] mx-0.5">L</span> badge to resize. Toggle visibility below.</div>
          <div className="flex flex-wrap gap-2">
            {layout.map(it => {
              const meta = WIDGETS.find(w => w.id===it.id);
              if (!meta) return null;
              return (
                <button key={it.id} onClick={()=>toggleVisible(it.id)} data-testid={`toggle-${it.id}`} className={`chip ${it.visible?"active":""}`}>
                  {it.visible? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>} {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No dense packing: the DOM order is the exact order that gets saved on drop. */}
      <div className="grid grid-cols-12 gap-5">
        {layout.filter(x => x.visible).map(it => (
          <SortableCard key={it.id} id={it.id} size={it.size||"auto"} customize={customize} onCycleSize={cycleSize}
            onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={() => setDraggingId(null)} draggingId={draggingId} testid={`widget-${it.id}`}>
            {R[it.id]}
          </SortableCard>
        ))}
      </div>
    </div>
  );
}

const Row = ({ label, val, accent="" }) => (
  <div className="flex items-center justify-between">
    <span className="text-[#6D6D82]">{label}</span>
    <span className={`font-semibold ${accent}`}>{val}</span>
  </div>
);

const EmptyChart = ({ msg }) => (
  <div className="h-full flex items-center justify-center text-center px-6">
    <div>
      <PiggyBank className="w-8 h-8 text-[#7C3AED] mx-auto mb-2 opacity-50"/>
      <div className="text-sm text-[#6D6D82]">{msg}</div>
      <Link to="/add-trade" className="mt-3 inline-block text-sm text-[#7C3AED] font-semibold">+ Add trade</Link>
    </div>
  </div>
);

function makeTradeAnalytics(trades) {
  const closed = trades.filter(t => t.status === "closed").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const group = (key) => {
    const map = new Map();
    closed.forEach(t => { const name = key(t) || "Other"; map.set(name, (map.get(name) || 0) + Number(t.net_pnl || 0)); });
    return [...map].map(([name, pnl]) => ({ name, pnl: Number(pnl.toFixed(2)) }));
  };
  const daily = group(t => t.date).slice(-31);
  const weekly = group(t => {
    const d = new Date(`${t.date}T00:00:00`); const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10);
  }).slice(-8);
  const sessions = group(t => t.session || "Other").sort((a, b) => b.pnl - a.pnl);
  const strategies = group(t => t.strategy || "Uncategorised").sort((a, b) => b.pnl - a.pnl);
  const pairs = group(t => t.symbol || "Unknown").sort((a, b) => b.pnl - a.pnl).slice(0, 6);
  const hours = Array.from({ length: 6 }, (_, i) => ({ label: `${i * 4}:00`, count: 0 }));
  closed.forEach(t => { const hour = Number(String(t.entry_time || "").slice(0, 2)); if (Number.isFinite(hour)) hours[Math.min(5, Math.floor(hour / 4))].count += 1; });
  let wins = 0, losses = 0, maxWins = 0, maxLosses = 0;
  closed.forEach(t => { if (Number(t.net_pnl || 0) > 0) { wins += 1; losses = 0; maxWins = Math.max(maxWins, wins); } else if (Number(t.net_pnl || 0) < 0) { losses += 1; wins = 0; maxLosses = Math.max(maxLosses, losses); } });
  const pnl = closed.reduce((sum, t) => sum + Number(t.net_pnl || 0), 0);
  return { daily, weekly, sessions, strategies, pairs, hours, open: trades.filter(t => t.status === "open"), total: closed.length, pnl, expectancy: closed.length ? pnl / closed.length : 0, maxWins, maxLosses };
}
