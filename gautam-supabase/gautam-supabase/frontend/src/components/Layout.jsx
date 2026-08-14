import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Target, BookOpen, Activity, Settings, LogOut, TrendingUp, Table2, FileText, NotebookPen, Moon, Sun, ChevronDown, User, Menu, X, AlertTriangle } from "lucide-react";
import AccountSwitcher from "@/components/AccountSwitcher";
import CoachWidget from "@/components/CoachWidget";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { HeaderActionsProvider, useHeaderActions } from "@/context/HeaderActionsContext";
import { Toaster } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

// Layout is only responsible for providing header-action slots; the actual
// header/sidebar rendering lives in LayoutInner so it can consume the
// context a level below where it's provided.
export default function Layout() {
  return (
    <HeaderActionsProvider>
      <LayoutInner />
    </HeaderActionsProvider>
  );
}

function LayoutInner() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("tjfx-theme") || "light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { dailyDrawdownLocked, dailyDrawdownInfo } = useAccount();
  const [showDrawdownAlert, setShowDrawdownAlert] = useState(false);

  useEffect(() => { if (dailyDrawdownLocked) setShowDrawdownAlert(true); }, [dailyDrawdownLocked]);

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

  useEffect(() => {
    setSidebarOpen(false);
  }, [navigate]);

  return (
    <div className={`h-screen overflow-hidden flex flex-col md:flex-row bg-[#F6F6FB] ${theme === "dark" ? "dark" : ""}`}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-30 w-64 ${sidebarCollapsed ? "md:w-0 md:border-r-0 md:overflow-hidden" : "md:w-56 lg:w-64"} bg-white border-r border-[#E8E8F1] flex flex-col sticky top-0 h-screen transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        data-testid="sidebar"
      >
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

        </div>

        <div className="shrink-0 border-t border-[#E8E8F1] bg-white">
          <div className="px-3 py-3"><AccountSwitcher /></div>
        </div>

      </aside>

      {showDrawdownAlert && <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-red-200 shadow-2xl p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3 text-red-600"><span className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></span><h2 className="font-display text-lg font-bold">Daily drawdown hit</h2></div><button onClick={()=>setShowDrawdownAlert(false)} className="text-[#6D6D82] hover:text-[#16151F]"><X className="w-5 h-5" /></button></div>
          <p className="mt-4 text-sm leading-6 text-[#6D6D82]">Your daily loss limit of <b className="text-red-600">${Number(dailyDrawdownInfo.limit || 0).toFixed(0)}</b> has been reached. Add Trade is locked for today to prevent overtrading.</p>
          <button onClick={()=>setShowDrawdownAlert(false)} className="mt-5 w-full h-10 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold">I understand</button>
        </div>
      </div>}

      <main className="flex-1 min-w-0 flex flex-col w-full">
        <div className="sticky top-0 z-20 bg-[#F6F6FB]/85 backdrop-blur border-b border-[#E8E8F1] px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => isMobile ? setSidebarOpen(!sidebarOpen) : setSidebarCollapsed(!sidebarCollapsed)}
              className="text-[#6D6D82] hover:text-[#16151F] p-1"
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

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Page-specific action injected via HeaderActionsContext — e.g. Dashboard's "Customize" button */}
            <HeaderActionSlot />

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
                  onSelect={(e) => { e.preventDefault(); setTheme(theme === "dark" ? "light" : "dark"); }}
                  data-testid="header-menu-theme"
                >
                  {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      <Toaster position="top-right" richColors />
      <CoachWidget />
    </div>
  );
}

function HeaderActionSlot() {
  const { headerAction } = useHeaderActions();
  return headerAction || null;
}
