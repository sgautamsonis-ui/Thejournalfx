import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, Loader2 } from "lucide-react";

// Supabase's redirectTo points straight at /dashboard and supabase-js
// auto-exchanges the token from the URL hash, so this page is only a
// safety net for any old bookmarked /auth/callback links.
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const done = useRef(false);
  const [status, setStatus] = useState("Signing you in...");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        navigate("/login");
        return;
      }
      await refresh();
      setStatus("Welcome back! Preparing your workspace...");
      setOk(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 500);
    })();
  }, [navigate, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center login-bg">
      <div className="tjfx-card p-10 text-center max-w-sm w-full">
        {ok ? <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-4"/> :
          <Loader2 className="w-10 h-10 mx-auto text-[#7C3AED] mb-4 animate-spin"/>}
        <div className="font-display text-xl font-bold">{status}</div>
      </div>
    </div>
  );
}
