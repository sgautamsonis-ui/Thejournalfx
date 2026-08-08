import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Target, BookOpen, Brain, Settings, LogOut, TrendingUp, Table2, CalendarDays, FileText, NotebookPen, Moon, Sun } from "lucide-react";
import AccountSwitcher from "@/components/AccountSwitcher";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Toaster } from "sonner";
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
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-[#F6F6FB]">
      <aside className="w-[260px] shrink-0 bg-white border-r border-[#E8E8F1] flex flex-col sticky top-0 h-screen" data-testid="sidebar">
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#7C3AED] flex items-center justify-center shadow-[0_8px_24px_rgba(124,58,237,0.35)]">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display text-[15px] font-bold leading-tight">TheJournalFX</div>
            <div className="text-[11px] text-[#6D6D82]">Journal • Analyze • Improve</div>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-1">
          {nav.map(({ to, label, icon: Icon, testid }) => (
            <NavLink key={to} to={to} data-testid={testid}
              className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                isActive ? "bg-[#F3E8FF] text-[#7C3AED] border-l-[3px] border-[#7C3AED] pl-[9px]" : "text-[#6D6D82] hover:bg-[#F6F6FB] hover:text-[#16151F]"
              }`}>
              <Icon className="w-4 h-4"/> {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#E8E8F1]">
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
        <div className="sticky top-0 z-30 bg-[#F6F6FB]/85 backdrop-blur border-b border-[#E8E8F1] px-8 py-3 flex items-center justify-between gap-4">
          <AccountSwitcher compact/>
          <div className="hidden md:block font-display text-[15px] font-bold text-center flex-1" data-testid="header-greeting">
            {(() => {
              const h = new Date().getHours();
              const g = h<12? "Good Morning" : h<17? "Good Afternoon" : "Good Evening";
              const name = user?.settings?.display_name || user?.name || "Trader";
              return <>{g}, {name.split(" ")[0]} <span>👋</span></>;
            })()}
          </div>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle colour mode" title="Toggle light/dark mode" className="h-9 w-9 rounded-xl border border-[#E8E8F1] bg-white text-[#6D6D82] hover:border-[#7C3AED] hover:text-[#7C3AED] flex items-center justify-center">
            {theme === "dark" ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <div className="text-[11px] text-[#6D6D82] tjfx-mono">TheJournalFX</div>
        </div>
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
