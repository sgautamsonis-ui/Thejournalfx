import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { statsApi } from "@/lib/api";
import AccountSwitcher from "@/components/AccountSwitcher";

// Rich "Account Overview" hero card — balance + live sparkline on the left,
// win-rate gauge + drawdown bars + risk-per-trade on the right. Every number
// here comes from /stats/dashboard and the active account/user settings —
// nothing is hardcoded.
export default function AccountOverview() {
  const { activeId, active, accounts } = useAccount();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    statsApi.dashboard(activeId).then(setStats).catch(() => setStats(null));
  }, [activeId]);

  const balance = activeId === "all"
    ? accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)
    : Number(active?.balance || 0);

  const todaysPnl = stats?.todays_pnl ?? 0;
  const totalPnl = stats?.total_pnl ?? 0;
  const dailyDD = stats?.daily_drawdown ?? 0;
  const weeklyDD = stats?.weekly_drawdown ?? 0;
  const winRate = stats?.win_rate ?? 0;

  const limits = (activeId !== "all" && user?.settings?.account_limits?.[activeId]) || null;
  const dailyLimit = limits?.daily;
  const weeklyLimit = limits?.weekly;
  const riskPercent = Number(user?.settings?.risk_percent ?? 1);

  // Rebuild an absolute equity curve (in account-currency terms, not just
  // cumulative P&L) from the running total the backend already computed —
  // shift stats.equity_curve up by the account's opening balance so the last
  // point lands exactly on the current balance.
  const equityPoints = useMemo(() => {
    const curve = stats?.equity_curve || [];
    const startBalance = balance - totalPnl;
    if (curve.length === 0) {
      return [{ i: 0, equity: startBalance }, { i: 1, equity: startBalance }];
    }
    return [
      { i: 0, equity: startBalance },
      ...curve.map((pt, idx) => ({ i: idx + 1, equity: startBalance + (pt.equity || 0) })),
    ];
  }, [stats, balance, totalPnl]);

  const todaysPct = useMemo(() => {
    const base = balance - todaysPnl;
    if (!base) return 0;
    return (todaysPnl / base) * 100;
  }, [balance, todaysPnl]);

  const dailyPct = dailyLimit ? Math.min(100, (Math.abs(dailyDD) / dailyLimit) * 100) : 0;
  const weeklyPct = weeklyLimit ? Math.min(100, (Math.abs(weeklyDD) / weeklyLimit) * 100) : 0;

  // Derived "account health" — not a fabricated label, computed from the
  // real drawdown usage + win rate we already have.
  const health = useMemo(() => {
    if (!stats) return null;
    const worstUsage = Math.max(dailyPct, weeklyPct);
    if (worstUsage >= 90) return { label: "At risk", color: "text-red-600 bg-red-50" };
    if (worstUsage >= 60 || (stats.closed_trades > 0 && winRate < 40)) {
      return { label: "Caution", color: "text-amber-600 bg-amber-50" };
    }
    return { label: "Excellent", color: "text-emerald-600 bg-emerald-50" };
  }, [stats, dailyPct, weeklyPct, winRate]);

  const insight = useMemo(() => {
    if (!stats || stats.closed_trades === 0) {
      return "Log your first trade to start seeing insights here.";
    }
    const worstUsage = Math.max(dailyPct, weeklyPct);
    if (worstUsage >= 90) return "You're close to your drawdown limit — consider stepping away for today.";
    if (worstUsage >= 60) return "Drawdown is building up. Trade smaller and stick to your plan.";
    if (totalPnl >= 0 && winRate >= 50) return "You're doing great! Keep following your plan and managing risk.";
    if (totalPnl < 0) return "You're in the red overall — review your losing trades before adding size.";
    return "Steady so far. Keep journaling every trade to spot the pattern.";
  }, [stats, dailyPct, weeklyPct, totalPnl, winRate]);

  const gaugeR = 42;
  const gaugeC = 2 * Math.PI * gaugeR;
  const gaugeOffset = gaugeC - (Math.min(100, Math.max(0, winRate)) / 100) * gaugeC;

  const fmt = (n) => `$${Math.abs(n).toFixed(2)}`;

  return (
    <div className="tjfx-card px-4 py-3.5 mb-4" data-testid="account-overview">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide whitespace-nowrap">
          Account Overview
        </div>
        <div className="w-full max-w-[260px]">
          <AccountSwitcher compact />
        </div>
        {health && (
          <div className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${health.color}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Account Health <span>{health.label}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.4fr] gap-4">
        {/* Balance hero */}
        <div className="relative overflow-hidden rounded-2xl px-5 py-4 text-white bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#5B21B6]">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Current Balance
          </div>
          <div className="flex items-end gap-3 mt-1">
            <div className="text-[32px] leading-none font-bold tjfx-mono tjfx-num">
              ${balance.toFixed(2)}
            </div>
            <div className={`mb-0.5 text-[11px] font-semibold rounded-full px-2 py-0.5 ${todaysPct >= 0 ? "bg-white/20" : "bg-red-500/30"}`}>
              {todaysPct >= 0 ? "▲" : "▼"} {Math.abs(todaysPct).toFixed(2)}% today
            </div>
          </div>

          <div className="h-16 -mx-2 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityPoints} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="aoSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="equity" stroke="#ffffff" strokeWidth={2} fill="url(#aoSpark)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-white/15">
            <div>
              <div className="text-[10px] text-white/70 uppercase tracking-wide">Today's P&L</div>
              <div className="text-[13px] font-semibold tjfx-mono tjfx-num">
                {todaysPnl >= 0 ? "+" : "-"}{fmt(todaysPnl)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/70 uppercase tracking-wide">Total P&L</div>
              <div className="text-[13px] font-semibold tjfx-mono tjfx-num">
                {totalPnl >= 0 ? "+" : "-"}{fmt(totalPnl)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/70 uppercase tracking-wide">Equity</div>
              <div className="text-[13px] font-semibold tjfx-mono tjfx-num">${balance.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Right: gauge + drawdowns + risk */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E8E8F1] p-3">
            <div className="relative w-[92px] h-[92px]">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r={gaugeR} fill="none" stroke="#E8E8F1" strokeWidth="9" />
                <circle
                  cx="50" cy="50" r={gaugeR} fill="none" stroke="#10B981" strokeWidth="9"
                  strokeDasharray={gaugeC} strokeDashoffset={gaugeOffset} strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[16px] font-bold tjfx-mono tjfx-num text-[#16151F]">{winRate.toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-[10px] text-[#6D6D82] uppercase tracking-wide mt-1.5">Win Rate</div>
          </div>

          <DrawdownTile label="Daily Drawdown" used={dailyDD} limit={dailyLimit} pct={dailyPct} fmt={fmt} />
          <DrawdownTile label="Weekly Drawdown" used={weeklyDD} limit={weeklyLimit} pct={weeklyPct} fmt={fmt} />

          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E8E8F1] p-3 text-center">
            <div className="text-[10px] text-[#6D6D82] uppercase tracking-wide">Risk Per Trade</div>
            <div className="text-[22px] font-bold tjfx-mono tjfx-num text-[#16151F] mt-1">{riskPercent}%</div>
            <div className="text-[10px] text-[#A1A1AA]">of Account</div>
            <Link to="/settings" className="mt-1.5 w-6 h-6 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7C3AED]" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 rounded-xl bg-[#F6F6FB] px-3 py-2">
        <Sparkles className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
        <span className="text-[12px] text-[#6D6D82]">{insight}</span>
      </div>

      {activeId !== "all" && !limits && (
        <Link to="/settings" className="mt-2 inline-block text-[11px] text-[#7C3AED] hover:underline">
          + Set drawdown limits →
        </Link>
      )}
    </div>
  );
}

function DrawdownTile({ label, used, limit, pct, fmt }) {
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-[#E8E8F1] p-3">
      <div className="text-[10px] text-[#6D6D82] uppercase tracking-wide">{label}</div>
      <div className="text-[15px] font-semibold tjfx-mono tjfx-num text-[#16151F] mt-1">
        {fmt(used)}
        {limit ? <span className="text-[#A1A1AA] font-normal text-[12px]"> / ${limit.toFixed(0)}</span> : null}
      </div>
      {limit ? (
        <div className="h-1.5 w-full rounded-full bg-[#E8E8F1] overflow-hidden mt-1.5">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="text-[10px] text-[#A1A1AA] mt-1.5">No limit set</div>
      )}
    </div>
  );
}
