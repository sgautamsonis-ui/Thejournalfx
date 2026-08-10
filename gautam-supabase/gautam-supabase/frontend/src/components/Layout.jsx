import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Target, BookOpen, Brain, Settings, LogOut, TrendingUp, Table2, CalendarDays, FileText, NotebookPen, Moon, Sun, Wallet, ArrowUp, ArrowDown, ChevronDown, User } from "lucide-react";
import AccountSwitcher from "@/components/AccountSwitcher";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { statsApi } from "@/lib/api";
import { Toaster } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function AccountOverview() {
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

  // Per-account drawdown limits, set in Settings → Accounts (edit an account).
  const limits = (activeId !== "all" && user?.settings?.account_limits?.[activeId]) || null;
  const dailyLimit = limits?.daily;
  const weeklyLimit = limits?.weekly;

  const Row = ({ label, value, positive, limit }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-[#6D6D82]">{label}</span>
      <span className={`text-[12px] font-semibold tjfx-mono tjfx-num ${
        positive === undefined ? "text-[#16151F]" : positive ? "text-emerald-600" : "text-red-500"
      }`}>
        {value}{limit ? <span className="text-[#A1A1AA] font-normal"> / ${limit.toFixed(0)}</span> : ""}
      </span>
    </div>
  );

  // Battery-style usage bar for a drawdown vs its limit — fills up (and turns
  // amber/red) as more of the daily/weekly allowance gets used.
  const DrawdownBar = ({ label, used, limit }) => {
    const pct = limit ? Math.min(100, (Math.abs(used) / limit) * 100) : 0;
    const barColor = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[#6D6D82]">{label}</span>
          <span className="text-[11px] font-semibold tjfx-mono text-[#16151F]">
            ${Math.abs(used).toFixed(0)} <span className="text-[#A1A1AA] font-normal">/ ${limit.toFixed(0)}</span>
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#E8E8F1] overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 py-3 border-t border-[#E8E8F1]" data-testid="account-overview">
      <div className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wide px-1 mb-2">
        Account Overview
      </div>
      <div className="px-1">
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
        {activeId !== "all" && !limits && (
          <Link to="/settings" className="mt-1 block text-[10px] text-[#7C3AED] hover:underline">
            + Set drawdown limits →
          </Link>
        )}
      </div>
    </div>
  );
}
const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/add-trade", label: "Add Trade", icon: PlusCircle, testid: "nav-add-trade" },
  { to: "/trades", label: "Trade View", icon: Table2, testid: "nav-trades" },
  { to: "/bias", label: "Bias Center", icon: Target, testid: "nav-bias" },
  { to: "/psychology", label: "Psychology AI", icon: Brain, testid: "nav-psychology" },
  { to: "/notebook", label: "Notebook", icon: NotebookPen, testid: "nav-notebook" },
  { to: "/records", label: "Records", icon: BookOpen, testid: "nav-records" },
  { to: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("tjfx-theme") || "light");
  useEffect(() => {
    localStorage.setItem("tjfx-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className={`min-h-screen flex bg-[#F6F6FB] ${theme === "dark" ? "dark" : ""}`}>
      <aside className="w-[260px] shrink-0 bg-white border-r border-[#E8E8F1] flex flex-col sticky top-0 h-screen" data-testid="sidebar">
        <div className="px-6 py-6 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-[#7C3AED] flex items-center justify-center shadow-[0_8px_24px_rgba(124,58,237,0.35)]">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display text-[15px] font-bold leading-tight">TheJournalFX</div>
            <div className="text-[11px] text-[#6D6D82]">Journal • Analyze • Improve</div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <nav className="px-3 space-y-1">
            {nav.map(({ to, label, icon: Icon, testid }) => (
              <NavLink key={to} to={to} data-testid={testid}
                className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                  isActive ? "bg-[#F3E8FF] text-[#7C3AED] border-l-[3px] border-[#7C3AED] pl-[9px]" : "text-[#6D6D82] hover:bg-[#F6F6FB] hover:text-[#16151F]"
                }`}>
                <Icon className="w-4 h-4"/> {label}
              </NavLink>
            ))}
          </nav>

          <div className="px-3 pt-3">
            <AccountSwitcher />
          </div>
          <AccountOverview />
        </div>

        {/* Profile & logout live in the header menu (top-right) now — no need to repeat them here. */}
        <button
          data-testid="logout-btn"
          onClick={logout}
          className="m-3 mt-0 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] text-[#6D6D82] border-t border-[#E8E8F1] pt-3 hover:text-red-600 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4"/> Logout
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-30 bg-[#F6F6FB]/85 backdrop-blur border-b border-[#E8E8F1] px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="leading-tight min-w-0" data-testid="header-greeting">
            <div className="font-display text-[14px] font-bold truncate">
              {(() => {
                const h = new Date().getHours();
                const g = h<12? "Good Morning" : h<17? "Good Afternoon" : "Good Evening";
                const name = user?.settings?.display_name || user?.name || "Trader";
                return <>{g}, {name.split(" ")[0]} <span>👋</span></>;
              })()}
            </div>
            <div className="text-[11px] text-[#6D6D82] truncate">{user?.settings?.motivation || "Discipline today, freedom tomorrow."}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NavLink to="/settings" data-testid="header-settings-btn" aria-label="Settings" className="w-8 h-8 rounded-xl border border-[#E8E8F1] flex items-center justify-center text-[#6D6D82] hover:text-[#7C3AED] hover:border-[#7C3AED]">
              <Settings className="w-4 h-4"/>
            </NavLink>
            <button type="button" onClick={()=>setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme" data-testid="theme-toggle" className="w-8 h-8 rounded-xl border border-[#E8E8F1] flex items-center justify-center text-[#6D6D82] hover:text-[#7C3AED] hover:border-[#7C3AED]">
              {theme === "dark" ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" data-testid="header-profile-btn" aria-label="Account menu" className="h-8 pl-1 pr-2 rounded-xl border border-[#E8E8F1] flex items-center gap-1.5 text-[#6D6D82] hover:text-[#7C3AED] hover:border-[#7C3AED]">
                  {user?.picture ? (
                    <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED] font-semibold text-[11px]">
                      {(user?.name?.[0] || "T").toUpperCase()}
                    </div>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-[13px] font-semibold truncate">{user?.settings?.display_name || user?.name}</div>
                  <div className="text-[11px] font-normal text-[#6D6D82] truncate">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="header-menu-settings">
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} data-testid="header-menu-logout" className="text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
