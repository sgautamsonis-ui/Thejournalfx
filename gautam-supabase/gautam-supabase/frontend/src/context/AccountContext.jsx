import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { accountsApi } from "@/lib/api";

const AccountCtx = createContext(null);
const KEY = "tjfx.activeAccount";

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(KEY) || "all");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await accountsApi.list();
      setAccounts(list);
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

  return (
    <AccountCtx.Provider value={{ accounts, activeId, active, setActive, reload, loading }}>
      {children}
    </AccountCtx.Provider>
  );
}

export const useAccount = () => useContext(AccountCtx);
