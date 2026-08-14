import React, { useEffect, useState, useMemo, useRef } from "react";
import { statsApi, biasApi, tradesApi } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  AreaChart, Area, ReferenceLine
} from "recharts";
import { 
  TrendingUp, Target, Activity, Wallet, Sparkles, Settings2, Eye, EyeOff, 
  ArrowUp, ArrowDown, Trophy, Calendar, Flame, PiggyBank, GripVertical,
  ChevronDown, AlertCircle, CheckCircle2
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getThoughtOfTheDay } from "@/lib/thoughtOfDay";
import { useHeaderActions } from "@/context/HeaderActionsContext";
import AccountOverview from "@/components/AccountOverview";

// Fixed (non-customizable) daily section shown above the widget grid — a new
// quote per category is picked automatically based on today's date, no API
// call or backend job needed. See src/lib/thoughtOfDay.js for the rotation
// logic and src/data/thoughtOfDayQuotes.json for the quote pool.
const TOTD_CATEGORIES = [
  { key: "risk", label: "Risk Management" },
  { key: "discipline", label: "Discipline" },
  { key: "psychology", label: "Psychology" },
];

function ThoughtOfTheDay() {
  const totd = useMemo(() => getThoughtOfTheDay(), []);
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    []
  );
  return (
    <div className="mb-4" data-testid="thought-of-the-day">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-[22px] h-[22px] rounded-[7px] bg-[#F3E8FF] flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-[#7C3AED]" />
        </div>
        <div className="font-display text-[13.5px] font-bold">Thought of the Day</div>
        <div className="ml-auto text-[10.5px] text-[#A1A1AA]">{dateLabel}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TOTD_CATEGORIES.map(({ key, label }) => {
          const q = totd[key];
          if (!q) return null;
          return (
            <div
              key={key}
              className="bg-white border border-[#E8E8F1] rounded-2xl p-3.5 border-l-[3px] border-l-[#7C3AED] shadow-[0_3px_14px_rgba(22,21,31,0.025)]"
              data-testid={`totd-${key}`}
            >
              <div className="text-[9.5px] font-bold uppercase tracking-wide text-[#7C3AED] mb-1.5">{label}</div>
              <div className="text-[12px] leading-[1.45] font-semibold text-[#16151F]">"{q.hi}"</div>
              <div className="text-[9.5px] leading-[1.4] text-[#6D6D82] italic mt-1">{q.en}</div>
              <div className="text-[9px] text-[#A1A1AA] mt-1.5">— {q.source}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============== WIDGET REGISTRY ===============
const WIDGETS = [
  { id: "kpis",           label: "KPI Cards",               category: "overview", size: "full" },
  { id: "performance",    label: "Performance Overview",    category: "main", size: "full" },
  { id: "equity-curve",   label: "Live Equity Curve",       category: "main", size: "full" },
  { id: "positions",      label: "Open Positions & Trades", category: "main", size: "full" },
  { id: "calendar",       label: "Trading Calendar",        category: "analytics", size: "lg" },
  { id: "performance-bar",label: "Performance Chart",       category: "analytics", size: "lg" },
  { id: "strategy",       label: "Strategy Performance",    category: "analytics", size: "md" },
  { id: "direction",      label: "Long vs Short",           category: "analytics", size: "md" },
  { id: "winrate-trend",  label: "Win Rate Trend",          category: "analytics", size: "md" },
  { id: "pnl-dist",       label: "P&L Distribution",        category: "analytics", size: "md" },
  { id: "expectancy",     label: "Expectancy Breakdown",    category: "analytics", size: "sm" },
  { id: "streaks",        label: "Streak",                  category: "psychology", size: "sm" },
  { id: "mood-analytics", label: "Mood vs Performance",     category: "psychology", size: "lg" },
  { id: "notes",          label: "Recent Notes",            category: "insights", size: "sm" },
  { id: "events",         label: "Upcoming Events",         category: "insights", size: "sm" },
  { id: "ai-coach",       label: "AI Trading Coach",        category: "ai", size: "full" },
];

// Widgets that always span the full width (KPIs, main charts, AI coach) —
// these aren't horizontally resizable, everything else is.
const FULL_WIDTH_IDS = new Set(WIDGETS.filter(w => w.size === "full").map(w => w.id));
const SIZE_TO_COLS = { sm: 3, md: 4, lg: 6, full: 12 };
const MIN_COLS = 3;
const MAX_COLS = 12;

const DEFAULT_LAYOUT = WIDGETS.map(w => ({ id: w.id, visible: true, cols: SIZE_TO_COLS[w.size] || 6 }));
const LAYOUT_KEY = "tjfx.dashboard.layout.v4";

function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
    if (Array.isArray(raw) && raw.every(x => x && x.id)) {
      const validIds = new Set(WIDGETS.map(w => w.id));
      const cleaned = raw
        .filter(x => validIds.has(x.id))
        .map(x => ({
          id: x.id,
          visible: x.visible !== false,
          cols: FULL_WIDTH_IDS.has(x.id) ? 12 : Math.min(MAX_COLS, Math.max(MIN_COLS, Number(x.cols) || 6)),
        }));
      const known = new Set(cleaned.map(x => x.id));
      return [...cleaned, ...DEFAULT_LAYOUT.filter(x => !known.has(x.id))];
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

function saveLayout(l) { 
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); 
}

// =============== SORTABLE CARD WRAPPER ===============
// Widgets are draggable (reorder) at all times via the grip handle in customize
// mode, and horizontally resizable by dragging the bottom-right corner — like a
// resizable side panel — snapped to the 12-column grid. Height simply grows with
// content (no independent vertical drag), so nothing gets clipped or overflows.
function SortableCard({ id, cols, full, customize, onResizeStart, onToggleVisible, children, testid }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 40 : "auto",
    "--cols": full ? 12 : cols,
  };

  return (
    <div ref={setNodeRef} style={style} className="col-span-12 tjfx-resizable relative min-w-0" data-testid={testid}>
      {customize && (
        <div className="absolute -top-3 -right-3 z-30 flex items-center gap-1">
          <button 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing h-8 w-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center shadow-lg hover:bg-[#6D28D9]" 
            title="Drag to move"
          >
            <GripVertical className="w-4 h-4"/>
          </button>
          <button 
            onClick={() => onToggleVisible(id)}
            className="h-8 w-8 rounded-full bg-white border border-[#E8E8F1] flex items-center justify-center text-[#7C3AED] shadow hover:border-[#7C3AED]"
            title="Hide widget"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className={`relative h-full min-w-0 ${customize ? "ring-2 ring-[#7C3AED]/40 rounded-2xl transition-all" : ""}`}>
        {children}
        {customize && !full && (
          <div
            onMouseDown={onResizeStart}
            title="Drag to resize width"
            className="hidden md:flex absolute bottom-1.5 right-1.5 z-30 h-5 w-5 items-center justify-center rounded-md bg-[#7C3AED] text-white cursor-ew-resize shadow-lg hover:bg-[#6D28D9]"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M9 1L1 9M9 5L5 9" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </div>
        )}
      </div>
    </div>
  );
}

// =============== CARD COMPONENT ===============
// overflow-auto + min-h keeps long content (tables, labels) scrollable inside the
// card instead of breaking the layout or spilling outside its box.
const Card = ({ children, className = "", ...props }) => (
  <div className={`tjfx-card p-4 tjfx-card-hover h-full min-w-0 min-h-[160px] overflow-auto ${className}`} {...props}>
    {children}
  </div>
);

// =============== STAT CARD ===============
function StatCard({ label, value, change, icon: Icon, color = "text-[#16151F]", testid }) {
  return (
    <div className="tjfx-card p-4 tjfx-card-hover" data-testid={testid}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-[12px] text-[#6D6D82] font-medium">{label}</div>
        <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-[#7C3AED]"/>
        </div>
      </div>
      <div className={`tjfx-mono text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {change !== undefined && (
        <div className={`text-xs mt-2 ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(2)}%
        </div>
      )}
    </div>
  );
}

// =============== CUSTOM X-AXIS TICK (date + weekday) ===============
function DateWeekdayTick({ x, y, payload }) {
  const dt = new Date(payload.value);
  if (isNaN(dt)) return <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill="#A1A1AA">{payload.value}</text>;
  const dateStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const dayStr = dt.toLocaleDateString("en-IN", { weekday: "short" });
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#A1A1AA">{dateStr}</text>
      <text x={0} y={0} dy={25} textAnchor="middle" fontSize={9} fill="#C4C4CE">({dayStr})</text>
    </g>
  );
}

// =============== EMPTY STATE ===============
function EmptyState({ message, icon: Icon = PiggyBank }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6 py-6">
      <div>
        <Icon className="w-6 h-6 text-[#7C3AED] mx-auto mb-2 opacity-50"/>
        <div className="text-xs text-[#6D6D82]">{message}</div>
        <Link to="/add-trade" className="mt-2 inline-block text-xs text-[#7C3AED] font-semibold hover:underline">
          + Add trade →
        </Link>
      </div>
    </div>
  );
}

// =============== MAIN DASHBOARD COMPONENT ===============
export default function Dashboard() {
  const { user } = useAuth();
  const { activeId, active, accounts } = useAccount();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [layout, setLayout] = useState(loadLayout);
  const [customize, setCustomize] = useState(false);
  const [timeframe, setTimeframe] = useState("monthly");
  const [positionsTab, setPositionsTab] = useState("open");
  const [allTrades, setAllTrades] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  // Render the Customize button in the shared header (via HeaderActionsContext)
  // instead of inline on the page, and clear it again when leaving Dashboard.
  const { setHeaderAction } = useHeaderActions();
  useEffect(() => {
    setHeaderAction(
      <button
        onClick={() => setCustomize(c => !c)}
        data-testid="customize-btn"
        title={customize ? "Done customizing" : "Customize dashboard"}
        aria-label={customize ? "Done customizing" : "Customize dashboard"}
        className={`h-8 w-8 rounded-lg sm:rounded-xl flex items-center justify-center transition ${
          customize
            ? "bg-[#7C3AED] text-white"
            : "border border-[#E8E8F1] text-[#16151F] hover:border-[#7C3AED] hover:text-[#7C3AED]"
        }`}
      >
        <Settings2 className="w-4 h-4" />
      </button>
    );
    return () => setHeaderAction(null);
  }, [customize, setHeaderAction]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Fetch dashboard data
  useEffect(() => {
    statsApi.dashboard(activeId)
      .then(setStats)
      .catch(() => setStats(null));
    tradesApi.list(activeId)
      .then(setAllTrades)
      .catch(() => setAllTrades([]));
  }, [activeId]);

  const selectedDayTrades = useMemo(
    () => (selectedDay ? allTrades.filter(t => String(t.date || "").slice(0, 10) === selectedDay) : []),
    [selectedDay, allTrades]
  );

  // Live equity curve — running cumulative balance across closed trades, sorted
  // chronologically, starting from the account's starting balance. When "All
  // Accounts" is selected, `active` is null (it only holds a single account),
  // so the current balance must be summed across every account instead —
  // otherwise this silently fell back to 0 and made the whole curve wrong.
  const equityCurveData = useMemo(() => {
    const currentBalance = activeId === "all"
      ? accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)
      : Number(active?.balance ?? 0);
    const closed = allTrades
      .filter(t => t && t.date && (t.net_pnl !== undefined && t.net_pnl !== null))
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    // Account balance is the current balance, not the opening balance. Reverse
    // the recorded P&L first so the last plotted point always matches it.
    const startBalance = currentBalance - closed.reduce((sum, t) => sum + (Number(t.net_pnl) || 0), 0);
    let running = startBalance;
    const points = [{ date: closed[0]?.date || new Date().toISOString(), equity: startBalance, label: "Start" }];
    for (const t of closed) {
      running += Number(t.net_pnl) || 0;
      points.push({ date: t.date, equity: running, pnl: t.net_pnl, symbol: t.symbol });
    }
    return { points, startBalance, current: running, hasTrades: closed.length > 0 };
  }, [allTrades, active, activeId, accounts]);

  // Journaling streak = consecutive days with at least one trade logged.
  const { journalCurrent, journalBest } = useMemo(() => {
    const daySet = new Set(allTrades.map(t => String(t.date || "").slice(0, 10)).filter(Boolean));
    if (daySet.size === 0) return { journalCurrent: 0, journalBest: 0 };
    const toISO = (d) => d.toISOString().slice(0, 10);
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!daySet.has(toISO(cursor))) cursor.setDate(cursor.getDate() - 1);
    let current = 0;
    while (daySet.has(toISO(cursor))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
    const days = Array.from(daySet).sort();
    let best = 0, run = 0, prev = null;
    for (const d of days) {
      if (prev) {
        const diff = Math.round((new Date(d) - new Date(prev)) / 86400000);
        run = diff === 1 ? run + 1 : 1;
      } else run = 1;
      best = Math.max(best, run);
      prev = d;
    }
    return { journalCurrent: current, journalBest: best };
  }, [allTrades]);

  useEffect(() => { 
    saveLayout(layout); 
  }, [layout]);

  const onDragEnd = (event) => {
    const { active: a, over: o } = event;
    if (a && o && a.id !== o.id) {
      const oi = layout.findIndex(x => x.id === a.id);
      const ni = layout.findIndex(x => x.id === o.id);
      setLayout(arrayMove(layout, oi, ni));
    }
  };

  // Drag-to-resize (bottom-right corner), snapped to the 12-column grid —
  // like dragging a resizable panel.
  const gridRef = useRef(null);
  const [resizing, setResizing] = useState(null); // { id, startX, startCols }

  useEffect(() => {
    if (!resizing) return;
    const colWidth = () => (gridRef.current?.offsetWidth || 1200) / 12;
    const onMove = (e) => {
      const deltaCols = Math.round((e.clientX - resizing.startX) / colWidth());
      const newCols = Math.min(MAX_COLS, Math.max(MIN_COLS, resizing.startCols + deltaCols));
      setLayout(l => l.map(x => x.id === resizing.id ? { ...x, cols: newCols } : x));
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const startResize = (id, cols) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id, startX: e.clientX, startCols: cols });
  };

  const toggleVisible = (id) => 
    setLayout(l => l.map(x => x.id === id ? { ...x, visible: !x.visible } : x));
  
  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  // =============== RENDER WIDGETS ===============
  const widgetComponents = {
    // KPI Cards (6 cards)
    kpis: (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5" data-testid="kpi-cards">
        <StatCard 
          testid="stat-pnl"
          label="Net P&L" 
          value={`${(stats?.total_pnl ?? 0) >= 0 ? "+" : ""}$${(stats?.total_pnl ?? 0).toFixed(2)}`}
          change={stats?.pnl_change}
          icon={TrendingUp} 
          color={(stats?.total_pnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} 
        />
        <StatCard 
          testid="stat-winrate"
          label="Win Rate" 
          value={`${stats?.win_rate ?? 0}%`}
          icon={Target} 
        />
        <StatCard 
          testid="stat-trades"
          label="Total Trades" 
          value={stats?.total_trades ?? 0}
          icon={Activity} 
        />
        <StatCard 
          testid="stat-expectancy"
          label="Expectancy" 
          value={`+$${(stats?.expectancy ?? 0).toFixed(2)}`}
          icon={Trophy}
          color={(stats?.expectancy ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}
        />
        <StatCard 
          testid="stat-pf"
          label="Profit Factor" 
          value={stats?.profit_factor ?? 0}
          icon={Sparkles} 
        />
        <StatCard 
          testid="stat-rr"
          label="Avg R:R" 
          value={stats?.avg_rr ?? 0}
          icon={Wallet} 
        />
      </div>
    ),

    // Performance Overview
    performance: (
      <Card data-testid="performance-overview">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold">Performance Overview</h3>
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm font-medium bg-white w-[150px] shrink-0"
          >
            <option value="hourly">Hourly (best hour)</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {timeframe === "hourly" ? (
          <>
            <p className="text-xs text-[#6D6D82] mb-4">
              {stats?.best_hour
                ? <>Your best entry hour is <span className="font-semibold text-[#7C3AED] tjfx-mono">{stats.best_hour.label}</span> with <span className={`tjfx-mono font-semibold ${stats.best_hour.pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>{stats.best_hour.pnl >= 0 ? "+" : ""}${stats.best_hour.pnl.toFixed(2)}</span> total P&amp;L.</>
                : "Log an entry time on your trades to see which hour of the day works best for you."}
            </p>
            <div className="h-[280px]">
              {stats?.hourly_performance && stats.hourly_performance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hourly_performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8F1" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 11, fill: "#A1A1AA" }} 
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} domain={[(min) => (min < 0 ? min * 1.2 : 0), (max) => (max <= 0 ? 1 : max * 1.2)]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: "1px solid #E8E8F1", backgroundColor: "#fff" }}
                      formatter={(value, name, props) => [`$${value.toFixed(2)} · ${props.payload.trades} trade(s) · ${props.payload.win_rate}% WR`, "P&L"]}
                    />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {stats.hourly_performance.map((entry, i) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No entry-time data yet. Add entry time on your trades to find your best trading hour." />
              )}
            </div>
          </>
        ) : (
          <div className="h-[300px] mt-4">
            {stats?.daily_pnl && stats.daily_pnl.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.daily_pnl} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8F1" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={<DateWeekdayTick />}
                    height={40}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} domain={[(min) => (min < 0 ? min * 1.2 : 0), (max) => (max <= 0 ? 1 : max * 1.2)]} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 12, 
                      border: "1px solid #E8E8F1",
                      backgroundColor: "#fff"
                    }}
                    labelFormatter={(d) => {
                      const dt = new Date(d);
                      return isNaN(dt) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                    }}
                    formatter={(value) => [`$${value.toFixed(2)}`, "P&L"]}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={40}>
                    {stats.daily_pnl.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No performance data yet. Add some trades to see your progress." />
            )}
          </div>
        )}
      </Card>
    ),

    // Live Equity Curve — smooth cumulative-balance curve across all trades
    "equity-curve": (
      <Card data-testid="equity-curve-card">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold">Live Equity Curve</h3>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className={`tjfx-mono text-sm font-semibold ${equityCurveData.current >= equityCurveData.startBalance ? "text-emerald-600" : "text-red-500"}`}>
            ${equityCurveData.current.toFixed(2)}
          </div>
        </div>
        <div className="h-[280px] mt-3">
          {equityCurveData.hasTrades ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurveData.points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8F1" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: "#A1A1AA" }} 
                  tickFormatter={(d) => { const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); }}
                  minTickGap={30}
                />
                <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: "1px solid #E8E8F1", backgroundColor: "#fff" }}
                  labelFormatter={(d) => { const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }}
                  formatter={(value, name, props) => [`$${Number(value).toFixed(2)}`, props.payload.symbol ? `Equity (${props.payload.symbol})` : "Equity"]}
                />
                <ReferenceLine y={equityCurveData.startBalance} stroke="#C4C4CE" strokeDasharray="4 4" />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#7C3AED" 
                  strokeWidth={2.5} 
                  fill="url(#equityFill)" 
                  dot={false}
                  activeDot={{ r: 4, fill: "#7C3AED" }}
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No trades yet. Your live equity curve will appear here as you log trades." />
          )}
        </div>
      </Card>
    ),

    // Open Positions + Recent Trades (COMBINED)
    positions: (
      <Card data-testid="positions-trades-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Positions & Recent Trades</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setPositionsTab("open")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                positionsTab === "open"
                  ? "bg-[#7C3AED] text-white"
                  : "bg-[#F6F6FB] text-[#6D6D82] hover:text-[#16151F]"
              }`}
            >
              Open Positions ({stats?.open_positions || 0})
            </button>
            <button
              onClick={() => setPositionsTab("recent")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                positionsTab === "recent"
                  ? "bg-[#7C3AED] text-white"
                  : "bg-[#F6F6FB] text-[#6D6D82] hover:text-[#16151F]"
              }`}
            >
              Recent Trades
            </button>
          </div>
        </div>

        {positionsTab === "open" ? (
          <div className="overflow-x-auto scroll-thin">
            {stats?.open_positions_list && stats.open_positions_list.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-[#6D6D82] border-b border-[#E8E8F1]">
                  <tr className="text-left">
                    <th className="py-2 font-medium">Pair</th>
                    <th className="py-2 font-medium">Dir</th>
                    <th className="py-2 font-medium">Size</th>
                    <th className="py-2 font-medium">Entry</th>
                    <th className="py-2 font-medium">SL</th>
                    <th className="py-2 font-medium">TP</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.open_positions_list.map((pos) => (
                    <tr key={pos.id} onClick={() => navigate("/trades")} className="border-t border-[#E8E8F1] hover:bg-[#F3E8FF]/40 cursor-pointer">
                      <td className="py-3 font-semibold tjfx-mono">{pos.symbol}</td>
                      <td className={pos.direction === "long" ? "text-emerald-600" : "text-red-500"}>
                        {pos.direction === "long" ? "↑ Long" : "↓ Short"}
                      </td>
                      <td className="py-3 tjfx-mono">{pos.lot_size}</td>
                      <td className="py-3 tjfx-mono text-sm">{(pos.entry_price ?? 0).toFixed(2)}</td>
                      <td className="py-3 tjfx-mono text-sm text-red-500">{pos.stop_loss != null ? pos.stop_loss.toFixed(2) : "—"}</td>
                      <td className="py-3 tjfx-mono text-sm text-emerald-600">{pos.take_profit != null ? pos.take_profit.toFixed(2) : "—"}</td>
                      <td className="py-3 text-[#6D6D82] tjfx-mono text-sm">{pos.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-[#6D6D82]">No open positions</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            {stats?.recent_trades && stats.recent_trades.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-[#6D6D82] border-b border-[#E8E8F1]">
                  <tr className="text-left">
                    <th className="py-2 font-medium">Pair</th>
                    <th className="py-2 font-medium">Dir</th>
                    <th className="py-2 font-medium">Entry</th>
                    <th className="py-2 font-medium">Exit</th>
                    <th className="py-2 font-medium">P&L</th>
                    <th className="py-2 font-medium">R</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_trades.map((trade) => (
                    <tr key={trade.id} onClick={() => navigate("/trades")} className="border-t border-[#E8E8F1] hover:bg-[#F3E8FF]/40 cursor-pointer">
                      <td className="py-3 font-semibold tjfx-mono">{trade.symbol}</td>
                      <td className={trade.direction === "long" ? "text-emerald-600" : "text-red-500"}>
                        {trade.direction === "long" ? "↑ Long" : "↓ Short"}
                      </td>
                      <td className="py-3 tjfx-mono text-sm">{(trade.entry_price ?? 0).toFixed(2)}</td>
                      <td className="py-3 tjfx-mono text-sm">{trade.exit_price != null ? trade.exit_price.toFixed(2) : "—"}</td>
                      <td className={`py-3 tjfx-mono font-medium ${(trade.net_pnl||0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {(trade.net_pnl||0) >= 0 ? "+" : ""}{(trade.net_pnl||0).toFixed(2)}
                      </td>
                      <td className="py-3 tjfx-mono">{trade.r_multiple?.toFixed(2) || "—"}R</td>
                      <td className="py-3 text-[#6D6D82] tjfx-mono text-sm">{trade.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-[#6D6D82]">No trades yet</div>
            )}
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-[#E8E8F1]">
          <Link to="/trades" className="text-sm text-[#7C3AED] font-semibold hover:underline">
            View All Trades →
          </Link>
        </div>
      </Card>
    ),

    // Trading Calendar
    calendar: (
      <Card data-testid="calendar-card">
        <h3 className="font-display text-lg font-bold mb-4">Trading Calendar</h3>
        {stats?.calendar && stats.calendar.length > 0 ? (
          <div className="grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-[#6D6D82] py-2">
                {day}
              </div>
            ))}
            {(() => {
              const first = new Date(stats.calendar[0].date);
              const leadBlank = (first.getDay() + 6) % 7; // Mon=0 ... Sun=6
              return Array.from({ length: leadBlank }).map((_, i) => <div key={`blank-${i}`} />);
            })()}
            {stats.calendar.map((day) => (
              <button
                key={day.date}
                onClick={() => day.trades > 0 && setSelectedDay(day.date)}
                disabled={day.trades === 0}
                className={`aspect-square rounded-lg text-xs font-medium transition flex flex-col items-center justify-center ${
                  day.pnl > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                    : day.pnl < 0
                    ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer"
                    : "bg-[#F6F6FB] text-[#6D6D82] border border-[#E8E8F1] hover:bg-white disabled:cursor-default disabled:hover:bg-[#F6F6FB]"
                }`}
                title={`${day.date}: ${day.trades} trade(s)`}
              >
                <div>{day.date.split("-")[2]}</div>
                {day.pnl !== 0 && <div className="text-[10px]">${Math.abs(day.pnl).toFixed(0)}</div>}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState message="Add trades to see your trading calendar." />
        )}
      </Card>
    ),

    // Performance Bar Chart
    "performance-bar": (
      <Card data-testid="performance-chart">
        <h3 className="font-display text-lg font-bold mb-4 flex items-center justify-between">
          <span>Monthly Performance</span>
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="h-8 px-2 rounded-lg border border-[#E8E8F1] text-xs font-medium bg-white w-[110px] shrink-0"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </h3>
        <div className="h-[250px]">
          {stats?.monthly_performance && stats.monthly_performance.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly_performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8F1" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#A1A1AA" }} />
                <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} domain={[(min) => (min < 0 ? min * 1.2 : 0), (max) => (max <= 0 ? 1 : max * 1.2)]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E8F1" }} />
                <Bar dataKey="pnl" radius={[8, 8, 0, 0]} maxBarSize={40}>
                  {stats.monthly_performance.map((entry) => (
                    <Cell key={`cell-${entry.period}`} fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Add trades to see performance." />
          )}
        </div>
      </Card>
    ),

    // Strategy Performance
    strategy: (
      <Card data-testid="strategy-card">
        <h3 className="font-display text-lg font-bold mb-4">Strategy Performance</h3>
        {stats?.strategies && stats.strategies.length > 0 ? (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {stats.strategies.map((strat) => (
              <div key={strat.id} className="p-3 bg-[#F6F6FB] rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm">{strat.name}</div>
                    <div className="text-xs text-[#6D6D82]">{strat.trades} trades</div>
                  </div>
                  <div className={`font-bold text-lg tjfx-mono ${strat.win_rate >= 50 ? "text-emerald-600" : "text-red-500"}`}>
                    {strat.win_rate}% <span className="text-[11px] font-medium text-[#6D6D82]">WR</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={strat.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>
                    {strat.pnl >= 0 ? "+" : ""}{strat.pnl.toFixed(2)} P&amp;L
                  </span>
                  <span className="text-[#6D6D82]">{strat.profit_factor}PF</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Log trades to see strategy stats." />
        )}
      </Card>
    ),

    // Long vs Short
    direction: (
      <Card data-testid="direction-card">
        <h3 className="font-display text-lg font-bold mb-4">Trades Direction</h3>
        {stats?.direction_stats ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Long", value: stats.direction_stats.long_count },
                      { name: "Short", value: stats.direction_stats.short_count },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    dataKey="value"
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="#EF4444" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6D6D82]">Long: {stats.direction_stats.long_wr}% WR</span>
                <span className={stats.direction_stats.long_pnl >= 0 ? "text-emerald-600" : "text-red-500"}>
                  +${stats.direction_stats.long_pnl.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6D6D82]">Short: {stats.direction_stats.short_wr}% WR</span>
                <span className={stats.direction_stats.short_pnl >= 0 ? "text-emerald-600" : "text-red-500"}>
                  +${stats.direction_stats.short_pnl.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState message="Add trades to see direction stats." />
        )}
      </Card>
    ),

    // Win Rate Trend
    "winrate-trend": (
      <Card data-testid="winrate-card">
        <h3 className="font-display text-lg font-bold mb-4">Win Rate Trend</h3>
        <div className="h-[200px]">
          {stats?.winrate_trend && stats.winrate_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.winrate_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8F1" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#A1A1AA" }} />
                <YAxis tick={{ fontSize: 10, fill: "#A1A1AA" }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E8F1" }} />
                <Line type="monotone" dataKey="winrate" stroke="#7C3AED" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Trades needed for trend data." />
          )}
        </div>
      </Card>
    ),

    // P&L Distribution
    "pnl-dist": (
      <Card data-testid="pnl-dist-card">
        <h3 className="font-display text-lg font-bold mb-4">P&L Distribution</h3>
        <div className="h-[200px]">
          {stats?.pnl_distribution && stats.pnl_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.pnl_distribution} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8F1" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#A1A1AA" }} />
                <YAxis tick={{ fontSize: 10, fill: "#A1A1AA" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E8F1" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#7C3AED" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Add trades to see distribution." />
          )}
        </div>
      </Card>
    ),

    // Expectancy Breakdown
    expectancy: (
      <Card data-testid="expectancy-card">
        <h3 className="font-display text-lg font-bold mb-4">Expectancy</h3>
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="text-xs text-emerald-600 mb-1">Avg Win</div>
            <div className="font-semibold text-emerald-700">
              +${(stats?.avg_win || 0).toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-xs text-red-600 mb-1">Avg Loss</div>
            <div className="font-semibold text-red-700">
              ${(stats?.avg_loss || 0).toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-xs text-[#7C3AED] mb-1">Expectancy</div>
            <div className="font-semibold text-[#7C3AED]">
              +${(stats?.expectancy || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </Card>
    ),

    // Streak
    streaks: (
      <Card data-testid="streaks-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500"/> Streak
          </h3>
        </div>
        <div className="flex items-end gap-4 mb-5">
          <div className="relative shrink-0">
            <Flame
              className={`w-14 h-14 ${journalCurrent > 0 ? "text-orange-500" : "text-[#E8E8F1]"} drop-shadow`}
              strokeWidth={1.5}
              fill={journalCurrent > 0 ? "currentColor" : "none"}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="tjfx-mono text-lg font-extrabold text-white mix-blend-difference" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                {journalCurrent}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[13px] text-[#6D6D82]">Journaling streak</div>
            <div className="font-display text-2xl font-extrabold tjfx-mono">
              {journalCurrent} <span className="text-[13px] text-[#6D6D82] font-medium">days</span>
            </div>
            <div className="text-xs text-[#6D6D82]">Best: {journalBest} days</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-start justify-between mb-1">
              <div className="text-xs text-emerald-600 font-medium">Winning Streak</div>
              <div className="text-2xl font-bold text-emerald-700">{stats?.current_winning_streak || 0}</div>
            </div>
            <div className="text-xs text-emerald-600">Best: {stats?.best_winning_streak || 0}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start justify-between mb-1">
              <div className="text-xs text-red-600 font-medium">Losing Streak</div>
              <div className="text-2xl font-bold text-red-700">{stats?.current_losing_streak || 0}</div>
            </div>
            <div className="text-xs text-red-600">Worst: {stats?.worst_losing_streak || 0}</div>
          </div>
        </div>
      </Card>
    ),

    // Mood vs Performance
    "mood-analytics": (
      <Card data-testid="mood-card">
        <h3 className="font-display text-lg font-bold mb-4">Mood vs Performance</h3>
        {stats?.mood_analytics && stats.mood_analytics.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {stats.mood_analytics.map((mood) => (
              <div key={mood.mood} className={`p-3 rounded-lg border ${
                mood.avg_pnl >= 0 
                  ? "bg-emerald-50 border-emerald-200" 
                  : "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-semibold text-sm capitalize">{mood.mood}</div>
                    <div className="text-xs text-[#6D6D82]">{mood.count} trades</div>
                  </div>
                  <div className={`font-semibold text-sm ${mood.avg_pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {mood.avg_pnl >= 0 ? "+" : ""}{mood.avg_pnl.toFixed(2)}
                  </div>
                </div>
                <div className="text-xs text-[#6D6D82]">{mood.wr}% WR • {mood.avg_r}R</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Add trades with mood to see analytics." />
        )}
      </Card>
    ),

    // Recent Notes
    notes: (
      <Card data-testid="notes-card">
        <h3 className="font-display text-lg font-bold mb-4">Recent Notes</h3>
        {stats?.recent_notes && stats.recent_notes.length > 0 ? (
          <div className="space-y-2">
            {stats.recent_notes.slice(0, 3).map((note) => (
              <div key={note.id} className="p-2 bg-[#F6F6FB] rounded text-xs">
                <div className="font-medium text-[#16151F]">{note.title}</div>
                <div className="text-[#6D6D82] mt-1">{note.excerpt}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#6D6D82] text-center py-4">No notes yet</div>
        )}
        <Link to="/notebook" className="mt-3 block text-sm text-[#7C3AED] font-semibold hover:underline">
          View All Notes →
        </Link>
      </Card>
    ),

    // Upcoming Events
    events: (
      <Card data-testid="events-card">
        <h3 className="font-display text-lg font-bold mb-4">Market Events</h3>
        {stats?.upcoming_events && stats.upcoming_events.length > 0 ? (
          <div className="space-y-2">
            {stats.upcoming_events.slice(0, 3).map((event) => (
              <div key={event.id} className="p-2 border-l-2 border-[#7C3AED] pl-3">
                <div className="font-medium text-xs text-[#16151F]">{event.name}</div>
                <div className="text-xs text-[#6D6D82] mt-1">
                  {event.time} {event.impact && <span className="ml-2 text-red-500">🔴 {event.impact}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#6D6D82] text-center py-4">No upcoming events</div>
        )}
        <Link to="/calendar" className="mt-3 block text-sm text-[#7C3AED] font-semibold hover:underline">
          View Calendar →
        </Link>
      </Card>
    ),

    // AI Trading Coach
    "ai-coach": (
      <Card className="bg-gradient-to-br from-[#F3E8FF] to-white" data-testid="ai-coach">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#7C3AED] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">🤖 AI Trading Coach</h3>
              <p className="text-xs text-[#6D6D82]">Your dashboard analyzed in real-time</p>
            </div>
          </div>
        </div>

        {stats?.ai_insights ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* What's Working */}
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <div className="font-semibold text-emerald-700 text-sm">What's Working</div>
              </div>
              <ul className="space-y-1 text-xs text-emerald-700">
                {stats.ai_insights.positives.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What's Hurting */}
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <div className="font-semibold text-red-700 text-sm">What's Hurting You</div>
              </div>
              <ul className="space-y-1 text-xs text-red-700">
                {stats.ai_insights.negatives.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5">⚠</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What To Do Next */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-blue-600" />
                <div className="font-semibold text-blue-700 text-sm">What To Do Next</div>
              </div>
              <ul className="space-y-1 text-xs text-blue-700">
                {stats.ai_insights.recommendations.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Recommendation */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                <div className="font-semibold text-[#7C3AED] text-sm">AI Recommendation</div>
              </div>
              <p className="text-xs text-[#7C3AED] leading-relaxed">
                {stats.ai_insights.recommendation}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState message="Close a few trades to unlock AI-powered coaching insights." />
        )}

        {/* Discipline Score */}
        {stats?.discipline_score && (
          <div className="mt-6 pt-6 border-t border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-[#16151F] mb-2">Discipline Score</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div>Risk: <span className="font-bold text-[#7C3AED]">{stats.discipline_score.risk}/100</span></div>
                  <div>Rules: <span className="font-bold text-[#7C3AED]">{stats.discipline_score.rules}/100</span></div>
                  <div>Psychology: <span className="font-bold text-[#7C3AED]">{stats.discipline_score.psychology}/100</span></div>
                  <div>Execution: <span className="font-bold text-[#7C3AED]">{stats.discipline_score.execution}/100</span></div>
                  <div>Consistency: <span className="font-bold text-[#7C3AED]">{stats.discipline_score.consistency}/100</span></div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#7C3AED]">{stats.discipline_score.overall}</div>
                <div className="text-xs text-[#6D6D82]">/100</div>
              </div>
            </div>
          </div>
        )}
      </Card>
    ),
  };

  // =============== RENDER ===============
  const visibleLayout = layout.filter(x => x.visible);

  return (
    <div className="p-5 max-w-[1800px] mx-auto" data-testid="dashboard-page">
      <ThoughtOfTheDay />
      <AccountOverview />

      {/* Customize Panel */}
      {customize && (
        <div className="tjfx-card p-4 mb-4" data-testid="customize-panel">
          <div className="text-sm text-[#6D6D82] mb-4">
            <strong className="text-[#16151F]">Drag the purple handle</strong> to reorder widgets, and the
            <strong className="text-[#16151F]"> corner handle</strong> to resize their width. Use the chips below to show/hide widgets.
          </div>
          <div className="flex flex-wrap gap-2">
            {WIDGETS.map(widget => {
              const item = layout.find(x => x.id === widget.id);
              if (!item) return null;
              return (
                <button
                  key={widget.id}
                  onClick={() => toggleVisible(widget.id)}
                  data-testid={`toggle-${widget.id}`}
                  className={`chip ${item.visible ? "active" : ""}`}
                >
                  {item.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {widget.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button 
              onClick={resetLayout}
              className="px-4 py-2 rounded-lg border border-[#E8E8F1] text-sm font-medium hover:border-[#7C3AED] text-[#6D6D82] hover:text-[#7C3AED]"
            >
              Reset Layout
            </button>
          </div>
        </div>
      )}

      {/* Customize Button now lives in the shared header — see HeaderActionsContext usage above */}

      {/* Dashboard Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext 
          items={visibleLayout.map(x => x.id)} 
          strategy={rectSortingStrategy}
        >
          <div ref={gridRef} className="grid grid-cols-12 auto-rows-max gap-1.5">
            {visibleLayout.map((item) => (
              <SortableCard
                key={item.id}
                id={item.id}
                cols={item.cols || 6}
                full={FULL_WIDTH_IDS.has(item.id)}
                customize={customize}
                onResizeStart={startResize(item.id, item.cols || 6)}
                onToggleVisible={toggleVisible}
                testid={`widget-${item.id}`}
              >
                {widgetComponents[item.id] || <div>Widget not found</div>}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <style>{`@media (min-width: 768px) { .tjfx-resizable { grid-column: span var(--cols) / span var(--cols) !important; } }`}</style>

      {/* Day Trades Dialog (from Trading Calendar click) */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl bg-white" data-testid="day-trades-dialog">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && new Date(selectedDay).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </DialogTitle>
          </DialogHeader>
          {selectedDayTrades.length > 0 ? (
            <div className="overflow-x-auto scroll-thin max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="text-[#6D6D82] border-b border-[#E8E8F1]">
                  <tr className="text-left">
                    <th className="py-2 font-medium">Pair</th>
                    <th className="py-2 font-medium">Dir</th>
                    <th className="py-2 font-medium">Entry</th>
                    <th className="py-2 font-medium">Exit</th>
                    <th className="py-2 font-medium">P&L</th>
                    <th className="py-2 font-medium">R</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      onClick={() => { setSelectedDay(null); navigate("/trades"); }}
                      className="border-t border-[#E8E8F1] hover:bg-[#F3E8FF]/40 cursor-pointer"
                    >
                      <td className="py-3 font-semibold tjfx-mono">{trade.symbol}</td>
                      <td className={trade.direction === "long" ? "text-emerald-600" : "text-red-500"}>
                        {trade.direction === "long" ? "↑ Long" : "↓ Short"}
                      </td>
                      <td className="py-3 tjfx-mono text-sm">{(trade.entry_price ?? 0).toFixed(2)}</td>
                      <td className="py-3 tjfx-mono text-sm">{trade.exit_price != null ? trade.exit_price.toFixed(2) : "—"}</td>
                      <td className={`py-3 tjfx-mono font-medium ${(trade.net_pnl || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {(trade.net_pnl || 0) >= 0 ? "+" : ""}{(trade.net_pnl || 0).toFixed(2)}
                      </td>
                      <td className="py-3 tjfx-mono">{trade.r_multiple != null ? `${trade.r_multiple.toFixed(2)}R` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[#6D6D82]">No trades on this day.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {visibleLayout.length === 0 && (
        <div className="text-center py-20">
          <PiggyBank className="w-12 h-12 text-[#7C3AED] mx-auto mb-4 opacity-50" />
          <div className="text-lg font-semibold text-[#16151F]">Dashboard is empty</div>
          <div className="text-sm text-[#6D6D82]">Enable widgets to get started</div>
          <button
            onClick={() => setCustomize(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-[#7C3AED] text-white font-medium hover:bg-[#6D28D9]"
          >
            Show Widgets
          </button>
        </div>
      )}
    </div>
  );
}
