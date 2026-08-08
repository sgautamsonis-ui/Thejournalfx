import React, { useEffect, useMemo, useState } from "react";
import { aiApi, tradesApi, prefsApi } from "@/lib/api";
import { Sparkles, Brain, Target, TrendingUp, ShieldCheck, Send, Filter, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export default function Psychology() {
  const [data, setData] = useState(null);
  const [rule, setRule] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState({ symbol:[], strategy:[], session:[], mood:[] });
  const [filters, setFilters] = useState({ sessions:[], strategies:[], moods:[], days:[], symbols:[], date_from:"", date_to:"" });
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    prefsApi.listMany(["symbol","strategy","session","mood"])
      .then(prefData => setPresets(p => ({ ...p, ...Object.fromEntries(Object.entries(prefData).map(([k, v]) => [k, v.map(x => x.value)])) })))
      .catch(()=>{});
    tradesApi.list().then(setTrades).catch(()=>{});
    aiApi.ruleAdherence().then(setRule).catch(()=>{});
  }, []);

  const runCoach = async (opts = {}) => {
    setLoading(true);
    try {
      const r = await aiApi.psychology({ ...filters, ...opts });
      setData(r);
    } catch { toast.error("AI failed"); } finally { setLoading(false); }
  };

  useEffect(() => { runCoach(); /* eslint-disable-next-line */ }, []);

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true);
    try {
      const r = await aiApi.psychology({ ...filters, question });
      setData(prev => ({...prev, ...r}));
    } catch { toast.error("AI failed"); } finally { setAsking(false); }
  };

  const toggle = (k, v) => setFilters(p => ({...p, [k]: p[k].includes(v) ? p[k].filter(x=>x!==v) : [...p[k], v]}));

  const activeCount = useMemo(() => {
    let n = 0;
    ["sessions","strategies","moods","days","symbols"].forEach(k => n += filters[k].length);
    if (filters.date_from) n++; if (filters.date_to) n++;
    return n;
  }, [filters]);

  return (
    <div className="p-8 max-w-[1300px] mx-auto space-y-5" data-testid="psychology-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Psychology AI</h1>
          <p className="text-[#6D6D82] mt-1">Slice by any dimension, ask a question, get honest answers.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setShowFilters(!showFilters)} className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm font-medium flex items-center gap-2" data-testid="psy-filter-toggle">
            <Filter className="w-4 h-4"/> Filters {activeCount>0 && <span className="bg-[#7C3AED] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{activeCount}</span>}
          </button>
          <button onClick={()=>runCoach()} disabled={loading} className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2" data-testid="refresh-ai-btn">
            <Sparkles className="w-4 h-4"/> {loading?"Analysing...":"Refresh Coach"}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="tjfx-card p-0 overflow-hidden" data-testid="psy-filter-panel">
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#E8E8F1] bg-gradient-to-r from-[#F3E8FF]/50 to-white">
            <div className="font-display font-bold">Filter by dimension</div>
            <button onClick={()=>setFilters({ sessions:[], strategies:[], moods:[], days:[], symbols:[], date_from:"", date_to:"" })} className="text-xs text-[#7C3AED] font-medium">Clear</button>
          </div>
          <div className="p-6 grid md:grid-cols-2 gap-4">
            <PsyFilterSection label="Sessions" items={presets.session} sel={filters.sessions} onToggle={v=>toggle("sessions",v)}/>
            <PsyFilterSection label="Strategies" items={presets.strategy} sel={filters.strategies} onToggle={v=>toggle("strategies",v)}/>
            <PsyFilterSection label="Symbols" items={presets.symbol} sel={filters.symbols} onToggle={v=>toggle("symbols",v)}/>
            <PsyFilterSection label="Moods" items={presets.mood} sel={filters.moods} onToggle={v=>toggle("moods",v)}/>
            <PsyFilterSection label="Days of week" items={DAYS} sel={filters.days} onToggle={v=>toggle("days",v)}/>
            <div>
              <div className="text-[11px] text-[#6D6D82] mb-1.5 uppercase tracking-wide font-semibold">Date range</div>
              <div className="flex gap-2">
                <input type="date" value={filters.date_from} onChange={e=>setFilters({...filters,date_from:e.target.value})} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] text-xs tjfx-mono"/>
                <input type="date" value={filters.date_to} onChange={e=>setFilters({...filters,date_to:e.target.value})} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] text-xs tjfx-mono"/>
              </div>
            </div>
          </div>
          <div className="border-t border-[#E8E8F1] px-6 py-3 bg-[#F6F6FB] flex justify-end">
            <button onClick={()=>runCoach()} className="h-9 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold">Apply filters</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KPI label="Win Rate" value={`${data?.win_rate||0}%`} icon={Target}/>
        <KPI label="Trades" value={data?.total||0} icon={TrendingUp}/>
        <KPI label="Net P&L" value={`${(data?.pnl||0)>=0?"+":""}$${(data?.pnl||0).toFixed(2)}`} icon={TrendingUp} color={(data?.pnl||0)>=0?"text-emerald-600":"text-red-500"}/>
        <KPI label="Discipline" value={`${Math.min(100, 60 + Math.round((data?.win_rate||0)/3))}%`} icon={Brain}/>
      </div>

      {/* Ask AI */}
      <div className="tjfx-card p-6 bg-gradient-to-br from-[#F3E8FF] to-white" data-testid="psy-ask-card">
        <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#7C3AED]"/> Ask Your AI Coach</h3>
        <div className="flex gap-2">
          <input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="e.g. Why am I losing on Mondays? Which strategy is best for me?" className="flex-1 h-11 px-4 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white" data-testid="psy-question-input"/>
          <button onClick={ask} disabled={asking||!question.trim()} className="h-11 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60" data-testid="psy-ask-btn">
            {asking? "Thinking..." : <><Send className="w-4 h-4"/> Ask</>}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "Where is my biggest leak?",
            "What time of day am I most profitable?",
            "Which strategy has the best win rate?",
            "How does my mood impact my P&L?",
            "What should I focus on next week?"
          ].map(q => (
            <button key={q} onClick={()=>{setQuestion(q); setTimeout(ask, 0);}} className="chip">{q}</button>
          ))}
        </div>
      </div>

      {/* Insight */}
      <div className="tjfx-card p-6" data-testid="psy-insight-card">
        <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-[#7C3AED]"/> Auto Diagnosis</h3>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{data?.insight || "Loading personalised insights..."}</p>
      </div>

      {/* Breakdown grids */}
      <div className="grid md:grid-cols-2 gap-5">
        <BreakdownCard title="By Session" items={data?.by_session}/>
        <BreakdownCard title="By Strategy" items={data?.by_strategy}/>
        <BreakdownCard title="By Day of Week" items={data?.by_day}/>
        <BreakdownCard title="By Symbol" items={data?.by_symbol}/>
        <BreakdownCard title="By Mood" items={data?.by_mood}/>
        <div className="tjfx-card p-6">
          <h3 className="font-display text-lg font-bold mb-3">Costly Mistakes</h3>
          {(data?.top_mistakes||[]).length===0 ? <div className="text-sm text-[#6D6D82]">No mistakes tracked yet.</div> :
            <div className="space-y-2">
              {(data?.top_mistakes||[]).map(([m,c]) => (
                <div key={m} className="flex items-center justify-between p-3 rounded-xl bg-red-50/40">
                  <span className="text-sm font-medium">{m}</span>
                  <span className="tjfx-mono text-sm text-red-600">×{c}</span>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      {/* Rule Adherence Coach */}
      <div className="tjfx-card p-6" data-testid="rule-adherence-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#7C3AED]"/> Rule Adherence Coach</h3>
          <div className="text-[11px] text-[#6D6D82] tjfx-mono">Reviewed {rule?.total_trades_reviewed||0} trades · {rule?.total_rules||0} rules</div>
        </div>
        {(!rule || rule.total_rules===0) ? (
          <div className="text-sm text-[#6D6D82]">Add your trading rules in <span className="text-[#7C3AED] font-medium">Notebook → Rules</span> so the coach can measure adherence.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">Rules broken most</div>
              <div className="space-y-2">
                {rule.top_broken.map(r => {
                  const total = r.broken + r.followed;
                  const brokenPct = total ? Math.round((r.broken/total)*100) : 0;
                  return (
                    <div key={r.rule}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="line-clamp-1 pr-2">{r.rule}</span>
                        <span className="tjfx-mono text-[#6D6D82]">{r.broken} broken · {r.followed} kept</span>
                      </div>
                      <div className="h-2 bg-[#F6F6FB] rounded-full overflow-hidden">
                        <div className={`h-full ${brokenPct>=60?"bg-red-500":brokenPct>=30?"bg-amber-500":"bg-emerald-500"}`} style={{width:`${brokenPct}%`}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#F3E8FF] to-white">
              <div className="text-[11px] text-[#7C3AED] font-semibold uppercase tracking-wide mb-2">Focus Rule for Next Week</div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{rule.insight}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PsyFilterSection({ label, items, sel, onToggle }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="rounded-xl border border-[#E8E8F1]">
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2">
        <span className="text-[12px] font-semibold">{label} {sel.length>0 && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#7C3AED]">{sel.length}</span>}</span>
        <ChevronDown className={`w-4 h-4 text-[#6D6D82] transition-transform ${open?"":"-rotate-90"}`}/>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {items.length===0 ? <div className="text-xs text-[#A1A1AA]">No presets.</div> :
            <div className="flex flex-wrap gap-1.5">{items.map(v => <button key={v} onClick={()=>onToggle(v)} className={`chip ${sel.includes(v)?"active":""}`} style={{fontSize:11, padding:"3px 8px"}}>{v}</button>)}</div>
          }
        </div>
      )}
    </div>
  );
}

function BreakdownCard({ title, items }) {
  const list = (items || []).slice(0, 6);
  return (
    <div className="tjfx-card p-6">
      <h3 className="font-display text-lg font-bold mb-3">{title}</h3>
      {list.length===0 ? <div className="text-sm text-[#6D6D82]">No data.</div> :
        <div className="space-y-2">
          {list.map(x => (
            <div key={x.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{x.key || "—"}</span>
                <span className="tjfx-mono text-[#6D6D82]">{x.trades}t · {x.wr}%WR · <span className={x.pnl>=0?"text-emerald-600":"text-red-500"}>${x.pnl.toFixed(2)}</span></span>
              </div>
              <div className="h-2 bg-[#F6F6FB] rounded-full overflow-hidden">
                <div className={`h-full ${x.pnl>=0?"bg-emerald-500":"bg-red-500"}`} style={{width: `${Math.min(100, Math.abs(x.wr))}%`}}/>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

const KPI = ({ label, value, icon: Icon, color="text-[#16151F]" }) => (
  <div className="tjfx-card p-6 tjfx-card-hover">
    <div className="flex items-start justify-between mb-3">
      <div className="text-[13px] text-[#6D6D82] font-medium">{label}</div>
      <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] flex items-center justify-center"><Icon className="w-4 h-4 text-[#7C3AED]"/></div>
    </div>
    <div className={`tjfx-mono text-3xl font-semibold ${color}`}>{value}</div>
  </div>
);
