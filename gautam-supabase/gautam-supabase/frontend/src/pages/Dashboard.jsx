import React, { useEffect, useState, useMemo } from "react";
import { statsApi, biasApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid 
} from "recharts";
import { 
  TrendingUp, Target, Activity, Wallet, Sparkles, Settings2, Eye, EyeOff, 
  ArrowUp, ArrowDown, Trophy, Calendar, Flame, PiggyBank, GripVertical,
  ChevronDown, AlertCircle, CheckCircle2
} from "lucide-react";
import { Link } from "react-router-dom";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// =============== WIDGET REGISTRY ===============
const WIDGETS = [
  { id: "header",         label: "Welcome Header",          category: "header", size: "full" },
  { id: "kpis",           label: "KPI Cards",               category: "overview", size: "full" },
  { id: "performance",    label: "Performance Overview",    category: "main", size: "full" },
  { id: "positions",      label: "Open Positions & Trades", category: "main", size: "full" },
  { id: "calendar",       label: "Trading Calendar",        category: "analytics", size: "lg" },
  { id: "performance-bar",label: "Performance Chart",       category: "analytics", size: "lg" },
  { id: "strategy",       label: "Strategy Performance",    category: "analytics", size: "md" },
  { id: "direction",      label: "Long vs Short",           category: "analytics", size: "md" },
  { id: "winrate-trend",  label: "Win Rate Trend",          category: "analytics", size: "md" },
  { id: "pnl-dist",       label: "P&L Distribution",        category: "analytics", size: "md" },
  { id: "expectancy",     label: "Expectancy Breakdown",    category: "analytics", size: "sm" },
  { id: "streaks",        label: "Streaks",                 category: "psychology", size: "sm" },
  { id: "mood-analytics", label: "Mood vs Performance",     category: "psychology", size: "lg" },
  { id: "notes",          label: "Recent Notes",            category: "insights", size: "sm" },
  { id: "events",         label: "Upcoming Events",         category: "insights", size: "sm" },
  { id: "ai-coach",       label: "AI Trading Coach",        category: "ai", size: "full" },
];

const DEFAULT_LAYOUT = WIDGETS.map(w => ({ id: w.id, visible: true, size: w.size }));
const LAYOUT_KEY = "tjfx.dashboard.layout.v3";

function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
    if (Array.isArray(raw) && raw.every(x => x && x.id)) {
      const known = new Set(raw.map(x => x.id));
      return [...raw, ...DEFAULT_LAYOUT.filter(x => !known.has(x.id))];
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

function saveLayout(l) { 
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); 
}

// =============== SIZING & STYLING ===============
const SIZE_CLASS = {
  sm: "col-span-12 md:col-span-4 lg:col-span-3",
  md: "col-span-12 md:col-span-6 lg:col-span-4",
  lg: "col-span-12 md:col-span-8 lg:col-span-6",
  full: "col-span-12"
};

const NEXT_SIZE = { sm: "md", md: "lg", lg: "full", full: "sm" };
const SIZE_LABEL = { sm: "S", md: "M", lg: "L", full: "XL" };

// =============== SORTABLE CARD WRAPPER ===============
function SortableCard({ id, size, customize, onCycleSize, onToggleVisible, children, testid }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 40 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className={`${SIZE_CLASS[size||"lg"]} relative`} data-testid={testid}>
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
            onClick={() => onCycleSize(id)} 
            className="h-8 px-2 rounded-full bg-white border border-[#E8E8F1] text-xs font-bold text-[#7C3AED] shadow hover:border-[#7C3AED]" 
            title="Change size"
          >
            {SIZE_LABEL[size||"lg"]}
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
      <div className={customize ? "ring-2 ring-[#7C3AED]/40 rounded-2xl transition-all" : ""}>
        {children}
      </div>
    </div>
  );
}

// =============== CARD COMPONENT ===============
const Card = ({ children, className = "", ...props }) => (
  <div className={`tjfx-card p-6 tjfx-card-hover h-full ${className}`} {...props}>
    {children}
  </div>
);

// =============== STAT CARD ===============
function StatCard({ label, value, change, icon: Icon, color = "text-[#16151F]", testid }) {
  return (
    <div className="tjfx-card p-5 tjfx-card-hover" data-testid={testid}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-[13px] text-[#6D6D82] font-medium">{label}</div>
        <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#7C3AED]"/>
        </div>
      </div>
      <div className={`tjfx-mono text-2xl font-semibold ${color}`}>{value}</div>
      {change !== undefined && (
        <div className={`text-xs mt-2 ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(2)}%
        </div>
      )}
    </div>
  );
}

// =============== EMPTY STATE ===============
function EmptyState({ message, icon: Icon = PiggyBank }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6 py-12">
      <div>
        <Icon className="w-8 h-8 text-[#7C3AED] mx-auto mb-3 opacity-50"/>
        <div className="text-sm text-[#6D6D82]">{message}</div>
        <Link to="/add-trade" className="mt-3 inline-block text-sm text-[#7C3AED] font-semibold hover:underline">
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
  const [stats, setStats] = useState(null);
  const [layout, setLayout] = useState(loadLayout);
  const [customize, setCustomize] = useState(false);
  const [timeframe, setTimeframe] = useState("monthly");
  const [positionsTab, setPositionsTab] = useState("open");
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Fetch dashboard data
  useEffect(() => {
    statsApi.dashboard(activeId)
      .then(setStats)
      .catch(() => setStats(null));
  }, [activeId]);

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

  const cycleSize = (id) => 
    setLayout(l => l.map(x => x.id === id ? { ...x, size: NEXT_SIZE[x.size || "lg"] } : x));
  
  const toggleVisible = (id) => 
    setLayout(l => l.map(x => x.id === id ? { ...x, visible: !x.visible } : x));
  
  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  // =============== RENDER WIDGETS ===============
  const widgetComponents = {
    // Header
    header: (
      <Card className="bg-gradient-to-r from-[#F3E8FF] to-white mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm text-[#7C3AED] font-semibold uppercase tracking-wide mb-2">
              Welcome back, {user?.name || "Trader"} 👋
            </div>
            <div className="font-display text-2xl font-bold text-[#16151F] mb-1">
              Discipline today, freedom tomorrow.
            </div>
            <p className="text-sm text-[#6D6D82] mt-3">
              {activeId === "all" 
                ? `Viewing all ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`
                : `Viewing ${active?.name} • $${(active?.balance || 0).toFixed(2)}`
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs text-[#6D6D82] mb-1">Date Range</div>
              <select 
                className="h-10 px-3 rounded-lg border border-[#E8E8F1] text-sm font-medium bg-white"
                onChange={(e) => setTimeframe(e.target.value)}
                value={timeframe}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </div>
      </Card>
    ),

    // KPI Cards (6 cards)
    kpis: (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="kpi-cards">
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
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-bold">Performance Overview</h3>
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm font-medium bg-white"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="h-[300px]">
          {stats?.equity_curve && stats.equity_curve.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equity_curve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8F1" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#A1A1AA" }} />
                <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: 12, 
                    border: "1px solid #E8E8F1",
                    backgroundColor: "#fff"
                  }}
                  formatter={(value) => `$${value.toFixed(2)}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#7C3AED" 
                  strokeWidth={2}
                  fill="url(#perfGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No performance data yet. Add some trades to see your progress." />
          )}
        </div>
      </Card>
    ),

    // Open Positions + Recent Trades (COMBINED)
    positions: (
      <Card data-testid="positions-trades-card">
        <div className="flex items-center justify-between mb-6">
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
            {stats?.open_positions && stats.open_positions.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-[#6D6D82] border-b border-[#E8E8F1]">
                  <tr className="text-left">
                    <th className="py-2 font-medium">Pair</th>
                    <th className="py-2 font-medium">Dir</th>
                    <th className="py-2 font-medium">Size</th>
                    <th className="py-2 font-medium">Entry</th>
                    <th className="py-2 font-medium">Current</th>
                    <th className="py-2 font-medium">SL</th>
                    <th className="py-2 font-medium">TP</th>
                    <th className="py-2 font-medium">Float P&L</th>
                    <th className="py-2 font-medium">R</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.open_positions.map((pos) => (
                    <tr key={pos.id} className="border-t border-[#E8E8F1] hover:bg-[#F6F6FB]">
                      <td className="py-3 font-semibold tjfx-mono">{pos.pair}</td>
                      <td className={pos.direction === "long" ? "text-emerald-600" : "text-red-500"}>
                        {pos.direction === "long" ? "↑ Long" : "↓ Short"}
                      </td>
                      <td className="py-3 tjfx-mono">{pos.size}</td>
                      <td className="py-3 tjfx-mono text-sm">{pos.entry.toFixed(2)}</td>
                      <td className="py-3 tjfx-mono text-sm">{pos.current_price.toFixed(2)}</td>
                      <td className="py-3 tjfx-mono text-sm text-red-500">{pos.stop_loss.toFixed(2)}</td>
                      <td className="py-3 tjfx-mono text-sm text-emerald-600">{pos.take_profit.toFixed(2)}</td>
                      <td className={`py-3 tjfx-mono font-medium ${pos.floating_pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {pos.floating_pnl >= 0 ? "+" : ""}{pos.floating_pnl.toFixed(2)}
                      </td>
                      <td className="py-3 tjfx-mono">{pos.floating_r?.toFixed(2)}R</td>
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
                    <tr key={trade.id} className="border-t border-[#E8E8F1] hover:bg-[#F6F6FB]">
                      <td className="py-3 font-semibold tjfx-mono">{trade.pair}</td>
                      <td className={trade.direction === "long" ? "text-emerald-600" : "text-red-500"}>
                        {trade.direction === "long" ? "↑ Long" : "↓ Short"}
                      </td>
                      <td className="py-3 tjfx-mono text-sm">{trade.entry.toFixed(2)}</td>
                      <td className="py-3 tjfx-mono text-sm">{trade.exit.toFixed(2)}</td>
                      <td className={`py-3 tjfx-mono font-medium ${trade.net_pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {trade.net_pnl >= 0 ? "+" : ""}{trade.net_pnl.toFixed(2)}
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
        <div className="grid grid-cols-7 gap-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-[#6D6D82] py-2">
              {day}
            </div>
          ))}
          {stats?.calendar && stats.calendar.map((day) => (
            <button
              key={day.date}
              className={`aspect-square rounded-lg text-xs font-medium transition flex flex-col items-center justify-center ${
                day.pnl > 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  : day.pnl < 0
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-[#F6F6FB] text-[#6D6D82] border border-[#E8E8F1] hover:bg-white"
              }`}
              title={`${day.date}: ${day.trades} trades`}
            >
              <div>{day.date.split("-")[2]}</div>
              {day.pnl !== 0 && <div className="text-[10px]">${Math.abs(day.pnl).toFixed(0)}</div>}
            </button>
          ))}
        </div>
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
            className="h-8 px-2 rounded-lg border border-[#E8E8F1] text-xs font-medium bg-white"
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
                <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E8F1" }} />
                <Bar dataKey="pnl" radius={[8, 8, 0, 0]}>
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
                  <div className={`font-semibold text-sm ${strat.pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {strat.pnl >= 0 ? "+" : ""}{strat.pnl.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6D6D82]">{strat.win_rate}% WR</span>
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
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#7C3AED" />
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

    // Streaks
    streaks: (
      <Card data-testid="streaks-card">
        <h3 className="font-display text-lg font-bold mb-4">Streaks</h3>
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
        <div className="flex items-start justify-between mb-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
        ) : null}

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
    <div className="p-8 max-w-[1800px] mx-auto" data-testid="dashboard-page">
      {/* Customize Panel */}
      {customize && (
        <div className="tjfx-card p-4 mb-6" data-testid="customize-panel">
          <div className="text-sm text-[#6D6D82] mb-4">
            <strong className="text-[#16151F]">Drag widgets</strong> to reorder. 
            Use buttons to resize and hide/show widgets.
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

      {/* Customize Button */}
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setCustomize(!customize)}
          data-testid="customize-btn"
          className={`h-10 px-4 rounded-xl text-sm font-medium flex items-center gap-2 transition ${
            customize
              ? "bg-[#7C3AED] text-white"
              : "border border-[#E8E8F1] text-[#16151F] hover:border-[#7C3AED]"
          }`}
        >
          <Settings2 className="w-4 h-4" />
          {customize ? "Done Customizing" : "✏️ Customize"}
        </button>
      </div>

      {/* Dashboard Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext 
          items={visibleLayout.map(x => x.id)} 
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-12 auto-rows-max gap-6">
            {visibleLayout.map((item) => (
              <SortableCard
                key={item.id}
                id={item.id}
                size={item.size || "lg"}
                customize={customize}
                onCycleSize={cycleSize}
                onToggleVisible={toggleVisible}
                testid={`widget-${item.id}`}
              >
                {widgetComponents[item.id] || <div>Widget not found</div>}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
