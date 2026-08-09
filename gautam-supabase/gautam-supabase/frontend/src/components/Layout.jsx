import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Target, BookOpen, Brain, Settings, LogOut, TrendingUp, Table2, CalendarDays, FileText, NotebookPen, Moon, Sun, Wallet, ArrowUp, ArrowDown } from "lucide-react";
import AccountSwitcher from "@/components/AccountSwitcher";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { statsApi } from "@/lib/api";
import { Toaster } from "sonner";

function AccountOverview() {
  const { activeId, active, accounts } = useAccount();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    statsApi.dashboard(activeId).then(setStats).catch(() => setStats(null));
  }, [activeId]);

  const balance = activeId === "all"
    ? accounts.reduce((s, a) => s + (a.balance || 0), 0)
    : (active?.balance || 0);
  const todaysPnl = stats?.todays_pnl ?? 0;
  const totalPnl = stats?.total_pnl ?? 0;

  const Row = ({ label, value, positive }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-[#6D6D82]">{label}</span>
      <span className={`text-[12px] font-semibold tjfx-mono tjfx-num ${
        positive === undefined ? "text-[#16151F]" : positive ? "text-emerald-600" : "text-red-500"
      }`}>
        {value}
      </span>
    </div>
  );

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

        <div className="p-3 border-t border-[#E8E8F1] shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-9 h-9 rounded-full border border-[#E8E8F1]" />
            ) : (
              <div className="w-9 h-9 rounded-full border border-[#E8E8F1] bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED] font-semibold text-sm">
                {(user?.name?.[0] || "T").toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate">{user?.settings?.display_name || user?.name}</div>
              <div className="text-[11px] text-[#6D6D82] truncate">{user?.email}</div>
            </div>
          </div>
          <button data-testid="logout-btn" onClick={logout} className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-[#6D6D82] hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4"/> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-30 bg-[#F6F6FB]/85 backdrop-blur border-b border-[#E8E8F1] px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="font-display text-[14px] font-bold" data-testid="header-greeting">
            {(() => {
              const h = new Date().getHours();
              const g = h<12? "Good Morning" : h<17? "Good Afternoon" : "Good Evening";
              const name = user?.settings?.display_name || user?.name || "Trader";
              return <>{g}, {name.split(" ")[0]} <span>👋</span></>;
            })()}
          </div>
          <button type="button" onClick={()=>setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme" data-testid="theme-toggle" className="w-8 h-8 rounded-xl border border-[#E8E8F1] flex items-center justify-center text-[#6D6D82] hover:text-[#7C3AED] hover:border-[#7C3AED] shrink-0">
            {theme === "dark" ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
        </div>
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
