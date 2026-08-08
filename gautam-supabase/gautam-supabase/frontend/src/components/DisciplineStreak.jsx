import React, { useEffect } from "react";
import { statsApi } from "@/lib/api";
import { Flame, Trophy, Shield } from "lucide-react";

export default function DisciplineStreak() {
  const [d, setD] = React.useState(null);
  useEffect(() => { statsApi.discipline().then(setD).catch(()=>{}); }, []);
  const cur = d?.current_streak ?? 0;
  const best = d?.best_streak ?? 0;
  const adh = d?.rule_adherence ?? 0;

  return (
    <div className="tjfx-card p-6 relative overflow-hidden" data-testid="discipline-streak-card">
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-gradient-to-br from-amber-300/40 to-[#7C3AED]/20 blur-2xl pointer-events-none"/>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-bold flex items-center gap-2"><Shield className="w-4 h-4 text-[#7C3AED]"/> Discipline Streak</h3>
        <div className="text-[11px] text-[#6D6D82] tjfx-mono">Max risk: {d?.max_risk_setting ?? 1}%</div>
      </div>

      <div className="flex items-end gap-4">
        <div className="relative">
          <Flame className={`w-16 h-16 ${cur>0?"text-orange-500":"text-[#E8E8F1]"} drop-shadow`} strokeWidth={1.5} fill={cur>0?"currentColor":"none"}/>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="tjfx-mono text-xl font-extrabold text-white mix-blend-difference" style={{textShadow:"0 1px 2px rgba(0,0,0,0.2)"}}>{cur}</span>
          </div>
        </div>
        <div>
          <div className="text-[13px] text-[#6D6D82]">Current streak</div>
          <div className="font-display text-3xl font-extrabold tjfx-mono">{cur} <span className="text-[13px] text-[#6D6D82] font-medium">days</span></div>
        </div>
      </div>

      {/* Last 7 days */}
      <div className="mt-5">
        <div className="text-[11px] text-[#6D6D82] mb-2">Last 7 days</div>
        <div className="flex gap-1.5">
          {(d?.last7||[]).map(day => (
            <div key={day.date} title={day.date}
              className={`flex-1 h-8 rounded-lg border ${day.state==="good"?"bg-emerald-500 border-emerald-500":day.state==="bad"?"bg-red-400 border-red-400":"bg-[#F6F6FB] border-[#E8E8F1]"}`}/>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="p-3 rounded-xl bg-[#F6F6FB]">
          <div className="text-[11px] text-[#6D6D82] flex items-center gap-1"><Trophy className="w-3 h-3"/> Best streak</div>
          <div className="tjfx-mono text-lg font-bold">{best} days</div>
        </div>
        <div className="p-3 rounded-xl bg-[#F6F6FB]">
          <div className="text-[11px] text-[#6D6D82]">Rule adherence</div>
          <div className="tjfx-mono text-lg font-bold text-[#7C3AED]">{adh}%</div>
        </div>
      </div>

      <div className="mt-4 text-[12px] text-[#6D6D82] leading-relaxed">
        A day counts <span className="text-emerald-600 font-semibold">green</span> when every trade has no mistakes logged and risk stays within your limit. Miss the rule and the streak resets.
      </div>
    </div>
  );
}
