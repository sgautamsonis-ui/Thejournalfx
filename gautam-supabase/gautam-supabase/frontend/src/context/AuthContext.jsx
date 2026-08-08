import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authApi } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pulls the app-level profile (name, picture, settings, onboarding_done)
  // from our backend, which itself validates the Supabase access token.
  const refresh = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Initial check: is there already a Supabase session (e.g. after refresh)?
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) {
        await refresh();
      }
      if (mounted) setLoading(false);
    });

    // Keep in sync with sign-in / sign-out / token refresh events.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await refresh();
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [refresh]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, refresh, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
