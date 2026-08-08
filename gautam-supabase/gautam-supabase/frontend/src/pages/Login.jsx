import React from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, ShieldCheck, LineChart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const startAuth = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
      },
    });
  };

  return (
    <div className="min-h-screen w-full login-bg flex items-center justify-center px-6 py-10 relative">
      <div className="login-grid" />

      {/* floaty gradient orbs */}
      <div className="floaty w-[380px] h-[380px] bg-[#7C3AED]/20 top-[-100px] left-[-100px]" />
      <div className="floaty w-[420px] h-[420px] bg-[#7C3AED]/15 bottom-[-140px] right-[-120px]" style={{animationDelay: "3s"}} />
      <div className="floaty w-[280px] h-[280px] bg-emerald-300/20 top-[40%] right-[8%]" style={{animationDelay: "5s"}} />

      {/* Candle SVG */}
      <svg className="candle-line" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad" x1="0" x2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0"/>
            <stop offset="50%" stopColor="#7C3AED" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M 0 500 C 200 300, 300 700, 500 400 S 800 200, 1000 500 S 1300 400, 1400 300"
              stroke="url(#grad)" strokeWidth="2" fill="none" />
        {[...Array(24)].map((_, i) => {
          const x = 40 + i*48;
          const h = 20 + Math.abs(Math.sin(i*1.5)) * 60;
          const y = 400 + Math.sin(i*0.8) * 80;
          const bull = i % 2 === 0;
          return (
            <g key={i} opacity="0.35">
              <line x1={x} y1={y-h-14} x2={x} y2={y+h+14} stroke="#7C3AED" strokeWidth="1"/>
              <rect x={x-5} y={y-h} width="10" height={h*2} fill={bull ? "#10B981" : "#EF4444"} opacity="0.8"/>
            </g>
          );
        })}
      </svg>

      <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center max-w-6xl w-full">
        {/* left copy */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}} className="space-y-8">
          <div className="inline-flex items-center gap-2 chip bg-white border border-[#E8E8F1]" data-testid="login-badge">
            <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]"/> Trading OS for ICT / SMC traders
          </div>
          <h1 className="font-display text-5xl lg:text-6xl font-extrabold leading-[1.05]">
            Journal. <span className="text-[#7C3AED]">Analyze.</span><br/>Improve.
          </h1>
          <p className="text-[17px] text-[#6D6D82] max-w-md leading-relaxed">
            TheJournalFX is the premium trading journal built for prop-firm traders.
            Track trades, plan your bias, master your psychology, and grow with an AI coach.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="chip"><TrendingUp className="w-3.5 h-3.5 text-emerald-500"/> Live equity curve</div>
            <div className="chip"><LineChart className="w-3.5 h-3.5 text-[#7C3AED]"/> Weekly + Daily Bias</div>
            <div className="chip"><ShieldCheck className="w-3.5 h-3.5 text-[#7C3AED]"/> Secure cloud sync</div>
          </div>
        </motion.div>

        {/* right card */}
        <motion.div initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} transition={{duration:0.5,delay:0.1}}
          className="tjfx-card p-10 max-w-[460px] w-full mx-auto" data-testid="login-card">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-[#7C3AED] flex items-center justify-center shadow-[0_8px_24px_rgba(124,58,237,0.35)]">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-tight">TheJournalFX</div>
              <div className="text-xs text-[#6D6D82]">Journal • Analyze • Improve</div>
            </div>
          </div>
          <h2 className="font-display text-3xl font-bold">Welcome Back <span>👋</span></h2>
          <p className="text-[15px] text-[#6D6D82] mt-2 mb-8">
            Track your trades. Master your psychology.<br/>Become consistently profitable.
          </p>

          <button
            data-testid="google-signin-btn"
            onClick={startAuth}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-[#E8E8F1] bg-white hover:border-[#7C3AED] hover:shadow-[0_10px_30px_rgba(124,58,237,0.15)] transition-all font-medium text-[15px] active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            <span>Continue with Google</span>
          </button>

          <div className="text-[12px] text-[#A1A1AA] text-center mt-6">
            By continuing you agree to our Terms & Privacy.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
