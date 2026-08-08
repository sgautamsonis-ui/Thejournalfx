import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { accountsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const AccountCtx = createContext(null);
const KEY = "tjfx.activeAccount";

export function AccountProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(KEY) || "all");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    // Avoid an unnecessary API call before Supabase has restored the session.
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    try {
      const list = await accountsApi.list();
      setAccounts(list);
      // if active id no longer valid, fallback to 'all'
      if (activeId !== "all" && !list.find(a => a.id === activeId)) {
        setActiveId("all"); localStorage.setItem(KEY, "all");
      }
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  }, [activeId, user]);

  useEffect(() => {
    if (!authLoading) reload();
  }, [authLoading, reload]);

  const setActive = (id) => { setActiveId(id); localStorage.setItem(KEY, id); };
  const active = accounts.find(a => a.id === activeId) || null;

  return (
    <AccountCtx.Provider value={{ accounts, activeId, active, setActive, reload, loading }}>
      {children}
    </AccountCtx.Provider>
  );
}

export const useAccount = () => useContext(AccountCtx);
