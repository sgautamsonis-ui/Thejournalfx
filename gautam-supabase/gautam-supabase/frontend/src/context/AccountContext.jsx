import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { accountsApi, statsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getEffectiveDailyDollarLimit } from "@/lib/propFirm";

const AccountCtx = createContext(null);
const KEY = "tjfx.activeAccount";

export function AccountProvider({ children }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(KEY) || "all");
  const [loading, setLoading] = useState(true);
  const [dailyDrawdownLocked, setDailyDrawdownLocked] = useState(false);
  const [dailyDrawdownInfo, setDailyDrawdownInfo] = useState({ used: 0, limit: null });
  const [statsRefresh, setStatsRefresh] = useState(0);

  const reload = useCallback(async () => {
    try {
      const list = await accountsApi.list();
      setAccounts(list);
      setStatsRefresh(v => v + 1);
      // if active id no longer valid, fallback to 'all'
      if (activeId !== "all" && !list.find(a => a.id === activeId)) {
        setActiveId("all"); localStorage.setItem(KEY, "all");
      }
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  }, [activeId]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const setActive = (id) => { setActiveId(id); localStorage.setItem(KEY, id); };
  const active = accounts.find(a => a.id === activeId) || null;

  useEffect(() => {
    let live = true;
    const account = accounts.find(a => a.id === activeId);
    const limits = activeId !== "all" ? user?.settings?.account_limits?.[activeId] : null;
    const limit = getEffectiveDailyDollarLimit(limits, account);
    if (!limit) {
      setDailyDrawdownLocked(false);
      setDailyDrawdownInfo({ used: 0, limit: null });
      return undefined;
    }
    statsApi.dashboard(activeId).then((stats) => {
      if (!live) return;
      const used = Math.abs(Number(stats?.daily_drawdown || 0));
      setDailyDrawdownInfo({ used, limit: Number(limit) });
      setDailyDrawdownLocked(used >= Number(limit));
    }).catch(() => { if (live) setDailyDrawdownLocked(false); });
    return () => { live = false; };
  }, [activeId, user?.settings?.account_limits, statsRefresh, accounts]);

  return (
    <AccountCtx.Provider value={{ accounts, activeId, active, setActive, reload, loading, dailyDrawdownLocked, dailyDrawdownInfo }}>
      {children}
    </AccountCtx.Provider>
  );
}

export const useAccount = () => useContext(AccountCtx);
