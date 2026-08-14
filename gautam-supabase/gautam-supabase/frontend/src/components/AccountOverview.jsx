import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { statsApi } from "@/lib/api";

// Was previously pinned in the sidebar; now rendered on the Dashboard page
// itself (below Thought of the Day) so the sidebar can stay a pure nav rail.
export default function AccountOverview() {
  const { activeId, active, accounts } = useAccount();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    statsApi.dashboard(activeId).then(setStats).catch(() => setStats(null));
  }, [activeId]);

  const balance = activeId === "all"
    ? accounts.reduce((s, a) => s + (a.balance || 0), 0)
    : (active?.balance || 0);
  const todaysPnl = stats?.todays_pnl ?? 0;
  const totalPnl = stats?.total_pnl ?? 0;
  const dailyDD = stats?.daily_drawdown ?? 0;
  const weeklyDD = stats?.weekly_drawdown ?? 0;

  const limits = (activeId !== "all" && user?.settings?.account_limits?.[activeId]) || null;
  const dailyLimit = limits?.daily;
  const weeklyLimit = limits?.weekly;

  const Row = ({ label, value, positive, limit }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-[#6D6D82]">{label}</span>
      <span className={`text-[12px] sm:text-[13px] font-semibold tjfx-mono tjfx-num ${
        positive === undefined ? "text-[#16151F]" : positive ? "text-emerald-600" : "text-red-500"
      }`}>
        {value}{limit ? <span className="text-[#A1A1AA] font-normal"> / ${limit.toFixed(0)}</span> : ""}
      </span>
    </div>
  );

  const DrawdownBar = ({ label, used, limit }) => {
    const pct = limit ? Math.min(100, (Math.abs(used) / limit) * 100) : 0;
    const barColor = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] text-[#6D6D82]">{label}</span>
          <span className="text-[12px] sm:text-[13px] font-semibold tjfx-mono text-[#16151F]">
            ${Math.abs(used).toFixed(0)} <span className="text-[#A1A1AA] font-normal">/ ${limit.toFixed(0)}</span>
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[#E8E8F1] overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="tjfx-card px-4 py-3.5 mb-1.5" data-testid="account-overview">
      <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2">
        Account Overview
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6">
        <Row label="Balance" value={`$${balance.toFixed(2)}`} />
        <Row label="Today's P&L" value={`${todaysPnl >= 0 ? "+" : ""}$${todaysPnl.toFixed(2)}`} positive={todaysPnl >= 0} />
        <Row label="Total P&L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`} positive={totalPnl >= 0} />
        <Row label="Win Rate" value={`${stats?.win_rate ?? 0}%`} />
        {dailyLimit ? (
          <DrawdownBar label="Daily Drawdown" used={dailyDD} limit={dailyLimit} />
        ) : (
          <Row
            label="Daily Drawdown"
            value={`${dailyDD === 0 ? "" : "-"}$${Math.abs(dailyDD).toFixed(2)}`}
            positive={dailyDD >= -0.001 ? undefined : false}
          />
        )}
        {weeklyLimit ? (
          <DrawdownBar label="Weekly Drawdown" used={weeklyDD} limit={weeklyLimit} />
        ) : (
          <Row
            label="Weekly Drawdown"
            value={`${weeklyDD === 0 ? "" : "-"}$${Math.abs(weeklyDD).toFixed(2)}`}
            positive={weeklyDD >= -0.001 ? undefined : false}
          />
        )}
      </div>
      {activeId !== "all" && !limits && (
        <Link to="/settings" className="mt-2 inline-block text-[11px] text-[#7C3AED] hover:underline">
          + Set drawdown limits →
        </Link>
      )}
    </div>
  );
}
