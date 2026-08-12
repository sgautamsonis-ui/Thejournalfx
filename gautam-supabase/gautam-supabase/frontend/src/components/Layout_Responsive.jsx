import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Target, BookOpen, Activity, Settings, LogOut, TrendingUp, Table2, FileText, NotebookPen, Moon, Sun, ChevronDown, User, Menu, X } from "lucide-react";
import AccountSwitcher from "@/components/AccountSwitcher";
import CoachWidget from "@/components/CoachWidget";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { statsApi } from "@/lib/api";
import { Toaster } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

  const limits = (activeId !== "all" && user?.settings?.account_limits?.[activeId]) || null;
  const dailyLimit = limits?.daily;
  const weeklyLimit = limits?.weekly;

  const Row = ({ label, value, positive, limit }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[10px] sm:text-[11px] text-[#6D6D82]">{label}</span>
      <span className={`text-[11px] sm:text-[12px] font-semibold tjfx-mono tjfx-num ${
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
          <span className="text-[10px] sm:text-[11px] text-[#6D6D82]">{label}</span>
          <span className="text-[10px] sm:text-[11px] font-semibold tjfx-mono text-[#16151F]">
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
      <div className="text-[9px] sm:text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wide px-1 mb-2">
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
          <Link to="/settings" className="mt-1 block text-[9px] sm:text-[10px] text-[#7C3AED] hover:underline">
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
  { to: "/tracker", label: "Tracker", icon: Activity, testid: "nav-tracker" },
  { to: "/notebook", label: "Notebook", icon: NotebookPen, testid: "nav-notebook" },
  { to: "/records", label: "Records", icon: BookOpen, testid: "nav-records" },
  { to: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("tjfx-theme") || "light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    localStorage.setItem("tjfx-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [navigate]);

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-[#F6F6FB] ${theme === "dark" ? "dark" : ""}`}>
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-30 w-64 md:w-56 lg:w-64 bg-white border-r border-[#E8E8F1] flex flex-col sticky top-0 h-screen transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        data-testid="sidebar"
      >
        {/* LOGO */}
        <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 flex items-center gap-3 shrink-0 border-b border-[#E8E8F1]">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-2xl bg-[#7C3AED] flex items-center justify-center shadow-[0_8px_24px_rgba(124,58,237,0.35)]">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[13px] sm:text-[15px] font-bold leading-tight">TheJournalFX</div>
            <div className="text-[9px] sm:text-[11px] text-[#6D6D82] whitespace-nowrap">Journal • Analyze • Improve</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden ml-auto text-[#6D6D82] hover:text-[#16151F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAV */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <nav className="px-2 sm:px-3 space-y-1 py-3">
            {nav.map(({ to, label, icon: Icon, testid }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={testid}
                className={({ isActive }) => `
                  flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl 
                  text-[12px] sm:text-[14px] font-medium transition-colors whitespace-nowrap sm:whitespace-normal
                  ${
                    isActive
                      ? "bg-[#F3E8FF] text-[#7C3AED] border-l-[3px] border-[#7C3AED] pl-[5px] sm:pl-[9px]"
                      : "text-[#6D6D82] hover:bg-[#F6F6FB] hover:text-[#16151F]"
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-2 sm:px-3 pt-2 sm:pt-3">
            <AccountSwitcher />
          </div>
          <AccountOverview />
        </div>

        {/* LOGOUT BUTTON */}
        <button
          data-testid="logout-btn"
          onClick={logout}
          className="m-2 sm:m-3 mt-0 flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-2 rounded-lg sm:rounded-xl text-[12px] sm:text-[13px] text-[#6D6D82] border-t border-[#E8E8F1] pt-3 hover:text-red-600 transition-colors shrink-0 w-full"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0 flex flex-col w-full">
        {/* HEADER */}
        <div className="sticky top-0 z-20 bg-[#F6F6FB]/85 backdrop-blur border-b border-[#E8E8F1] px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4">
          {/* HAMBURGER + GREETING */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-[#6D6D82] hover:text-[#16151F] p-1"
              data-testid="mobile-menu-btn"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="leading-tight min-w-0" data-testid="header-greeting">
              <div className="font-display text-[13px] sm:text-[14px] font-bold truncate">
                {(() => {
                  const h = new Date().getHours();
                  const g = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
                  const name = user?.settings?.display_name || user?.name || "Trader";
                  return (
                    <>
                      <span className="hidden sm:inline">{g}, {name.split(" ")[0]}</span>
                      <span className="sm:hidden">{name.split(" ")[0]}</span> <span>👋</span>
                    </>
                  );
                })()}
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#6D6D82] truncate hidden sm:block">
                {user?.settings?.motivation || "Discipline today, freedom tomorrow."}
              </div>
            </div>
          </div>

          {/* HEADER ACTIONS */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <NavLink
              to="/settings"
              data-testid="header-settings-btn"
              aria-label="Settings"
              className="w-8 h-8 rounded-lg sm:rounded-xl border border-[#E8E8F1] flex items-center justify-center text-[#6D6D82] hover:text-[#7C3AED] hover:border-[#7C3AED] transition-colors"
            >
              <Settings className="w-4 h-4" />
            </NavLink>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle color theme"
              data-testid="theme-toggle"
              className="w-8 h-8 rounded-lg sm:rounded-xl border border-[#E8E8F1] flex items-center justify-center text-[#6D6D82] hover:text-[#7C3AED] hover:border-[#7C3AED] transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="header-profile-btn"
                  aria-label="Account menu"
                  className="h-8 pl-1 pr-1.5 sm:pr-2 rounded-lg sm:rounded-xl border border-[#E8E8F1] flex items-center gap-1 sm:gap-1.5 text-[#6D6D82] hover:text-[#7C3AED] hover:border-[#7C3AED] transition-colors"
                >
                  {user?.picture ? (
                    <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED] font-semibold text-[10px]">
                      {(user?.name?.[0] || "T").toUpperCase()}
                    </div>
                  )}
                  <ChevronDown className="w-3 h-3 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-[13px] font-semibold truncate">
                    {user?.settings?.display_name || user?.name}
                  </div>
                  <div className="text-[11px] font-normal text-[#6D6D82] truncate">
                    {user?.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/settings")}
                  data-testid="header-menu-settings"
                >
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  data-testid="header-menu-logout"
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      <Toaster position="top-right" richColors />
      <CoachWidget />
    </div>
  );
}
