import React from "react";
import { BarChart, Bar, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { BarChart3, CalendarDays, Clock3, Layers3, ListChecks, PieChart as PieIcon, Trophy, Wallet } from "lucide-react";

const PURPLE = "#7C3AED";
const COLOURS = ["#7C3AED", "#A78BFA", "#10B981", "#38BDF8", "#F59E0B", "#EC4899"];
const money = (n) => `${n >= 0 ? "+" : "-"}$${Math.abs(Number(n || 0)).toFixed(2)}`;

const Card = ({ title, icon: Icon, children, action }) => (
  <div className="tjfx-card p-5 h-full min-h-[250px]">
    <div className="flex justify-between items-center mb-4"><h3 className="font-display text-base font-bold flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#7C3AED]"/>}{title}</h3>{action}</div>
    {children}
  </div>
);

const Empty = ({ text = "Add closed trades to see this widget." }) => <div className="h-40 flex items-center justify-center text-center text-sm text-[#6D6D82] px-6">{text}</div>;

export function PerformanceOverview({ analytics }) {
  const pie = analytics.total ? [{ name: "Profitable", value: analytics.pnl >= 0 ? Math.ceil(analytics.total * 0.6) : Math.floor(analytics.total * 0.4) }, { name: "Other", value: Math.max(0, analytics.total - (analytics.pnl >= 0 ? Math.ceil(analytics.total * 0.6) : Math.floor(analytics.total * 0.4))) }] : [];
  return <Card title="Performance Overview" icon={PieIcon} action={<span className="text-xs text-[#6D6D82]">All time</span>}>
    {!analytics.total ? <Empty/> : <div className="grid grid-cols-2 gap-3 items-center"><div className="h-40 relative"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" innerRadius={45} outerRadius={65} paddingAngle={3}>{pie.map((x, i) => <Cell key={x.name} fill={i ? "#E8E8F1" : "#10B981"}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><b className="tjfx-mono text-xl">{analytics.total}</b><span className="text-[10px] text-[#6D6D82]">trades</span></div></div><div className="space-y-3 text-sm"><Metric label="Net P&L" value={money(analytics.pnl)} good={analytics.pnl >= 0}/><Metric label="Expectancy" value={money(analytics.expectancy)} good={analytics.expectancy >= 0}/><Metric label="Win streak" value={`${analytics.maxWins}`} good/></div></div>
  </Card>;
}

export function TradingStats({ analytics }) {
  const best = analytics.daily.reduce((a, x) => !a || x.pnl > a.pnl ? x : a, null);
  const worst = analytics.daily.reduce((a, x) => !a || x.pnl < a.pnl ? x : a, null);
  return <Card title="Trading Stats" icon={ListChecks}>{!analytics.total ? <Empty/> : <div className="space-y-2"><Metric label="Best Day" value={best ? money(best.pnl) : "—"} good/><Metric label="Worst Day" value={worst ? money(worst.pnl) : "—"} good={false}/><Metric label="Max Consecutive Wins" value={`${analytics.maxWins}`} good/><Metric label="Max Consecutive Losses" value={`${analytics.maxLosses}`} good={false}/><Metric label="Total closed trades" value={`${analytics.total}`}/></div>}</Card>;
}

export function PnlByPeriod({ title, data }) {
  return <Card title={title} icon={BarChart3} action={<span className="text-xs text-[#6D6D82]">Recent</span>}>{!data.length ? <Empty/> : <div className="h-44"><ResponsiveContainer><BarChart data={data}><Tooltip formatter={(v) => money(v)}/><Bar dataKey="pnl" radius={[5, 5, 0, 0]}>{data.map(x => <Cell key={x.name} fill={x.pnl >= 0 ? "#10B981" : "#EF4444"}/>)}</Bar></BarChart></ResponsiveContainer></div>}</Card>;
}

export function SessionBreakdown({ data }) {
  const pieData = data.map(x => ({ ...x, value: Math.abs(x.pnl) || 1 }));
  return <Card title="P&L by Session" icon={PieIcon}>{!data.length ? <Empty/> : <div className="grid grid-cols-2 gap-3 items-center"><div className="h-40"><ResponsiveContainer><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={65}>{pieData.map((x, i) => <Cell key={x.name} fill={COLOURS[i % COLOURS.length]}/>)}</Pie><Tooltip formatter={(v, _name, item) => money(item?.payload?.pnl)}/></PieChart></ResponsiveContainer></div><div className="space-y-2">{data.slice(0, 4).map((x, i) => <div key={x.name} className="flex justify-between gap-2 text-xs"><span className="flex items-center gap-1.5 truncate"><i className="w-2 h-2 rounded-full" style={{background: COLOURS[i]}}/>{x.name}</span><b className={x.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>{money(x.pnl)}</b></div>)}</div></div>}</Card>;
}

export function MonthlyCalendar({ data }) {
  const recent = data.slice(-28);
  return <Card title="Monthly Calendar" icon={CalendarDays} action={<span className="text-xs text-[#6D6D82]">Last 28 days</span>}>{!recent.length ? <Empty/> : <div className="grid grid-cols-7 gap-1.5">{["M","T","W","T","F","S","S"].map((x, i) => <div key={`${x}${i}`} className="text-center text-[10px] text-[#6D6D82]">{x}</div>)}{recent.map(x => <div key={x.name} title={`${x.name}: ${money(x.pnl)}`} className={`h-10 rounded-lg flex flex-col items-center justify-center text-[10px] ${x.pnl >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}><span>{String(x.name).slice(-2)}</span><b>{x.pnl >= 0 ? "+" : ""}{Math.round(x.pnl)}</b></div>)}</div>}</Card>;
}

export function ActiveTimes({ data }) { const high = Math.max(1, ...data.map(x => x.count)); return <Card title="Most Active Times" icon={Clock3}>{!data.some(x => x.count) ? <Empty text="Add entry times to see your most active trading hours."/> : <div className="grid grid-cols-3 gap-3 pt-4">{data.map(x => <div key={x.label}><div className="text-xs text-[#6D6D82] mb-2">{x.label}</div><div className="h-20 rounded-xl bg-[#F3E8FF] flex items-end p-2"><div className="w-full rounded-lg bg-[#7C3AED]" style={{height:`${Math.max(10, x.count / high * 100)}%`}}/></div><div className="text-center text-xs mt-1 tjfx-mono">{x.count}</div></div>)}</div>}</Card>; }

export function TradesBreakdown({ data }) { return <Card title="Trades Breakdown" icon={Layers3}>{!data.length ? <Empty/> : <div className="space-y-3">{data.slice(0, 6).map((x, i) => <div key={x.name}><div className="flex justify-between text-sm gap-3"><span className="truncate">{x.name}</span><b className={x.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>{money(x.pnl)}</b></div><div className="h-1.5 mt-1.5 rounded-full bg-[#F6F6FB]"><div className="h-full rounded-full" style={{width:`${Math.min(100, Math.abs(x.pnl) / Math.max(1, Math.abs(data[0].pnl)) * 100)}%`, background:COLOURS[i]}}/></div></div>)}</div>}</Card>; }

export function TopPairs({ data }) { return <Card title="Top Performing Pairs" icon={Trophy}>{!data.length ? <Empty/> : <div className="space-y-3">{data.map((x, i) => <div key={x.name} className="flex justify-between items-center"><div className="flex gap-2 items-center"><span className="w-6 h-6 rounded-lg bg-[#F3E8FF] text-[#7C3AED] text-xs grid place-items-center font-bold">{i + 1}</span><span className="tjfx-mono text-sm">{x.name}</span></div><b className={x.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>{money(x.pnl)}</b></div>)}</div>}</Card>; }

export function OpenPositions({ data }) { return <Card title="Open Positions" icon={Wallet}>{!data.length ? <Empty text="No open positions. Your currently open trades will appear here."/> : <div className="space-y-3">{data.map(t => <div key={t.id} className="p-3 rounded-xl bg-[#F6F6FB] flex items-center justify-between"><div><b className="tjfx-mono text-sm">{t.symbol}</b><div className="text-xs text-[#6D6D82]">{t.session || "—"} · {t.order_type || "Market"}</div></div><span className={t.direction === "long" ? "text-emerald-600" : "text-red-500"}>{t.direction === "long" ? "Long" : "Short"}</span></div>)}</div>}</Card>; }

function Metric({ label, value, good }) { return <div className="flex justify-between items-center py-1.5 border-b border-[#E8E8F1] last:border-0"><span className="text-sm text-[#6D6D82]">{label}</span><b className={`tjfx-mono text-sm ${good === true ? "text-emerald-600" : good === false ? "text-red-500" : ""}`}>{value}</b></div>; }
