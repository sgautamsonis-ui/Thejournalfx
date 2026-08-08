import React, { useEffect, useMemo, useRef, useState } from "react";
import { tradesApi, biasApi, statsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Download, FileText, Printer, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const inp = "w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white";

function toDateStr(d) { return d.toISOString().slice(0,10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfWeek(d) {
  const x = new Date(d); const day = x.getDay(); const diff = (day===0?-6:1) - day;
  x.setDate(x.getDate()+diff); return x;
}

export default function Reports() {
  const { user } = useAuth();
  const [type, setType] = useState("daily");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [style, setStyle] = useState("professional");
  const [includes, setIncludes] = useState({
    weeklyBias: true, dailyBias: true, trades: true, screenshots: true, psychology: true, stats: true, notes: true,
  });
  const [trades, setTrades] = useState([]);
  const [biasList, setBiasList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, b, s] = await Promise.all([tradesApi.list(), biasApi.list(), statsApi.dashboard()]);
        setTrades(t); setBiasList(b); setStats(s);
      } finally { setLoading(false); }
    })();
  }, []);

  const range = useMemo(() => {
    const d = new Date(date);
    if (type==="daily") return { start: toDateStr(d), end: toDateStr(d) };
    if (type==="weekly") { const s = startOfWeek(d); return { start: toDateStr(s), end: toDateStr(addDays(s,6)) }; }
    // monthly
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    const e = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return { start: toDateStr(s), end: toDateStr(e) };
  }, [date, type]);

  const filtered = useMemo(() => {
    const inRange = (dStr) => dStr && dStr >= range.start && dStr <= range.end;
    const t = trades.filter(x => inRange(x.date));
    const weekly = biasList.filter(x => x.type==="weekly" && inRange(x.date)).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const daily = biasList.filter(x => x.type==="daily" && inRange(x.date)).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const closed = t.filter(x => x.status==="closed");
    const wins = closed.filter(x => (x.net_pnl||0)>0);
    const losses = closed.filter(x => (x.net_pnl||0)<0);
    const pnl = closed.reduce((s,x)=>s+(x.net_pnl||0),0);
    const gw = wins.reduce((s,x)=>s+(x.net_pnl||0),0);
    const gl = Math.abs(losses.reduce((s,x)=>s+(x.net_pnl||0),0)) || 1;
    return {
      trades: t, weekly, daily,
      metrics: {
        total: t.length, wins: wins.length, losses: losses.length,
        wr: closed.length? Math.round(wins.length/closed.length*100):0,
        pf: gl? (gw/gl).toFixed(2):"—",
        pnl: pnl.toFixed(2),
      }
    };
  }, [trades, biasList, range]);

  const reportId = `TJFX-${range.start}-${type[0].toUpperCase()}`;

  const downloadPDF = async () => {
    const node = reportRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`TheJournalFX_${type}_${range.start}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) { toast.error("Export failed"); } finally { setExporting(false); }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5" data-testid="reports-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports & Export</h1>
          <p className="text-[#6D6D82] mt-1">Generate a branded PDF report for any day, week or month.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>window.print()} className="h-10 px-4 rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] text-sm font-medium flex items-center gap-2"><Printer className="w-4 h-4"/> Print</button>
          <button data-testid="download-pdf-btn" onClick={downloadPDF} disabled={exporting} className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
            {exporting? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>} {exporting?"Exporting...":"Download PDF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Config panel */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <div className="tjfx-card p-6 space-y-4">
            <div>
              <div className="text-[12px] text-[#6D6D82] mb-2">Report Type</div>
              <div className="grid grid-cols-3 gap-2">
                {["daily","weekly","monthly"].map(t => (
                  <button key={t} onClick={()=>setType(t)} data-testid={`report-type-${t}`}
                    className={`h-10 rounded-xl text-sm font-medium border capitalize ${type===t?"bg-[#F3E8FF] border-[#7C3AED] text-[#7C3AED]":"border-[#E8E8F1]"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[#6D6D82] mb-1.5">Reference date</div>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inp} data-testid="report-date"/>
              <div className="text-[11px] text-[#A1A1AA] mt-1.5 tjfx-mono">{range.start} → {range.end}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6D6D82] mb-2">Report Style</div>
              <div className="grid grid-cols-3 gap-2">
                {["compact","professional","institutional"].map(s => (
                  <button key={s} onClick={()=>setStyle(s)}
                    className={`h-10 rounded-xl text-xs font-medium border capitalize ${style===s?"bg-[#F3E8FF] border-[#7C3AED] text-[#7C3AED]":"border-[#E8E8F1]"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[#6D6D82] mb-2">Include Sections</div>
              <div className="space-y-2 text-sm">
                {[
                  ["weeklyBias","Weekly Bias"],["dailyBias","Daily Bias"],["trades","Trades table"],
                  ["screenshots","Trade screenshots"],["psychology","Psychology summary"],["stats","Performance stats"],["notes","Notes"],
                ].map(([k,l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includes[k]} onChange={e=>setIncludes({...includes,[k]:e.target.checked})} className="accent-[#7C3AED] w-4 h-4"/>
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="tjfx-card p-5 text-sm text-[#6D6D82]">
            <div className="font-semibold text-[#16151F] mb-1 flex items-center gap-2"><FileText className="w-4 h-4 text-[#7C3AED]"/> Tip</div>
            Fill your bias, log trades and psychology first — the report auto-pulls everything from your journal.
          </div>
        </div>

        {/* Preview */}
        <div className="col-span-12 lg:col-span-8">
          <div className="tjfx-card overflow-hidden">
            <div className="bg-[#F6F6FB] px-4 py-2 text-xs text-[#6D6D82] flex items-center justify-between border-b border-[#E8E8F1]">
              <span>PDF Preview · A4</span>
              <span className="tjfx-mono">{reportId}</span>
            </div>
            <div className="p-4 max-h-[80vh] overflow-auto scroll-thin bg-[#F6F6FB]">
              <div ref={reportRef} className={`mx-auto bg-white shadow-sm ${style==="compact"?"text-[12px]":style==="institutional"?"text-[13px]":"text-[13.5px]"}`}
                   style={{ width: "794px", minHeight: "1123px", padding: "48px" }}>
                {loading ? (
                  <div className="flex items-center justify-center py-24 text-[#6D6D82]"><Loader2 className="w-5 h-5 animate-spin mr-2"/>Loading data...</div>
                ) : (
                  <ReportBody
                    user={user}
                    type={type}
                    range={range}
                    reportId={reportId}
                    data={filtered}
                    stats={stats}
                    includes={includes}
                    style={style}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportBody({ user, type, range, reportId, data, stats, includes, style }) {
  return (
    <div className="space-y-6" style={{ color: "#16151F", fontFamily: "'Satoshi', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-[#E8E8F1]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#7C3AED] flex items-center justify-center"><TrendingUp className="w-5 h-5 text-white"/></div>
          <div>
            <div className="font-display text-lg font-extrabold">TheJournalFX</div>
            <div className="text-[11px] text-[#6D6D82]">Journal • Analyze • Improve</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold uppercase tracking-wide">{type} Trading Report</div>
          <div className="text-[11px] text-[#6D6D82] tjfx-mono">{range.start} → {range.end}</div>
          <div className="text-[10px] text-[#A1A1AA] tjfx-mono mt-0.5">{reportId}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] text-[#6D6D82]">
        <div>Trader: <span className="text-[#16151F] font-semibold">{user?.name}</span></div>
        <div>Email: <span className="text-[#16151F]">{user?.email}</span></div>
      </div>

      {/* Weekly Bias */}
      {includes.weeklyBias && data.weekly && (
        <Section title="1. Weekly Bias">
          <BiasBlock b={data.weekly}/>
        </Section>
      )}

      {/* Daily Bias */}
      {includes.dailyBias && data.daily && (
        <Section title="2. Daily Bias">
          <BiasBlock b={data.daily}/>
        </Section>
      )}

      {/* Stats */}
      {includes.stats && (
        <Section title="3. Performance Summary">
          <div className="grid grid-cols-5 gap-3">
            <Metric label="Trades" value={data.metrics.total}/>
            <Metric label="Wins" value={data.metrics.wins} color="text-emerald-600"/>
            <Metric label="Losses" value={data.metrics.losses} color="text-red-500"/>
            <Metric label="Win Rate" value={`${data.metrics.wr}%`}/>
            <Metric label="Profit Factor" value={data.metrics.pf}/>
          </div>
          <div className="mt-3 p-3 rounded-xl bg-[#F6F6FB] flex items-center justify-between">
            <div className="text-[12px] text-[#6D6D82]">Net P&L</div>
            <div className={`tjfx-mono text-xl font-bold ${parseFloat(data.metrics.pnl)>=0?"text-emerald-600":"text-red-500"}`}>${data.metrics.pnl}</div>
          </div>
        </Section>
      )}

      {/* Trades table */}
      {includes.trades && (
        <Section title="4. Trades Taken">
          {data.trades.length===0 ? <div className="text-[#6D6D82] text-[12px]">No trades in this period.</div> :
            <table className="w-full text-[11px]">
              <thead className="bg-[#F6F6FB] text-[#6D6D82]">
                <tr>{["Date","Symbol","Dir","Entry","Exit","SL","TP","R","P&L","Strategy"].map(h => <th key={h} className="text-left px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.trades.map(t => (
                  <tr key={t.id} className="border-t border-[#E8E8F1]">
                    <td className="px-2 py-1.5 tjfx-mono">{t.date}</td>
                    <td className="px-2 py-1.5 font-semibold tjfx-mono">{t.symbol}</td>
                    <td className={`px-2 py-1.5 ${t.direction==="long"?"text-emerald-600":"text-red-500"}`}>{t.direction==="long"?"↑ L":"↓ S"}</td>
                    <td className="px-2 py-1.5 tjfx-mono">{t.entry_price}</td>
                    <td className="px-2 py-1.5 tjfx-mono">{t.exit_price||"—"}</td>
                    <td className="px-2 py-1.5 tjfx-mono">{t.stop_loss||"—"}</td>
                    <td className="px-2 py-1.5 tjfx-mono">{t.take_profit||"—"}</td>
                    <td className="px-2 py-1.5 tjfx-mono">{t.r_multiple?`${t.r_multiple}R`:"—"}</td>
                    <td className={`px-2 py-1.5 tjfx-mono ${(t.net_pnl||0)>=0?"text-emerald-600":"text-red-500"}`}>${(t.net_pnl||0).toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-[#6D6D82]">{t.strategy||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </Section>
      )}

      {/* Trade details w/ screenshots */}
      {includes.screenshots && data.trades.some(t => t.screenshots?.length) && (
        <Section title="5. Trade Details & Screenshots">
          <div className="space-y-4">
            {data.trades.filter(t=>t.screenshots?.length).map(t => (
              <div key={t.id} className="border border-[#E8E8F1] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold tjfx-mono">{t.symbol} · {t.direction==="long"?"Long":"Short"} · {t.date}</div>
                  <div className={`text-[12px] tjfx-mono ${(t.net_pnl||0)>=0?"text-emerald-600":"text-red-500"}`}>${(t.net_pnl||0).toFixed(2)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {t.screenshots.slice(0,4).map((s,i)=><img key={i} src={s} alt="chart" style={{width:"100%", borderRadius:8, maxHeight:220, objectFit:"cover"}} crossOrigin="anonymous"/>)}
                </div>
                {t.notes && <div className="mt-2 text-[11px] text-[#6D6D82] whitespace-pre-wrap">{t.notes}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Psychology */}
      {includes.psychology && (
        <Section title="6. Psychology Review">
          {(() => {
            const moods = {}; const mistakes = {}; const strengths = {};
            data.trades.forEach(t => {
              (t.mood_before||[]).forEach(m => moods[m] = (moods[m]||0)+1);
              (t.mistakes||[]).forEach(m => mistakes[m] = (mistakes[m]||0)+1);
              (t.strengths||[]).forEach(m => strengths[m] = (strengths[m]||0)+1);
            });
            const top = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5);
            return (
              <div className="grid grid-cols-3 gap-3 text-[12px]">
                <TagsBox label="Top Moods" items={top(moods)}/>
                <TagsBox label="Mistakes" items={top(mistakes)} color="red"/>
                <TagsBox label="Strengths" items={top(strengths)} color="emerald"/>
              </div>
            );
          })()}
        </Section>
      )}

      {/* Notes */}
      {includes.notes && data.daily?.notes?.length>0 && (
        <Section title="7. Notes & Reminders">
          <ul className="list-disc pl-5 space-y-1 text-[12px]">
            {data.daily.notes.map((n,i)=><li key={i}>{n}</li>)}
          </ul>
        </Section>
      )}

      {/* Footer */}
      <div className="pt-4 mt-6 border-t border-[#E8E8F1] flex items-center justify-between text-[10px] text-[#A1A1AA]">
        <span>Generated by TheJournalFX</span>
        <span className="tjfx-mono">{new Date().toISOString().slice(0,10)}</span>
        <span className="tjfx-mono">{reportId}</span>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div>
    <div className="font-display font-bold text-[15px] mb-2">{title}</div>
    <div>{children}</div>
  </div>
);

const Metric = ({ label, value, color="text-[#16151F]" }) => (
  <div className="p-3 rounded-xl bg-[#F6F6FB]">
    <div className="text-[10px] text-[#6D6D82]">{label}</div>
    <div className={`tjfx-mono font-bold text-lg ${color}`}>{value}</div>
  </div>
);

const BiasBlock = ({ b }) => (
  <div className="grid grid-cols-4 gap-2 text-[12px]">
    <div className="p-2 rounded-lg bg-[#F6F6FB]"><div className="text-[10px] text-[#6D6D82]">Direction</div><div className={`font-semibold capitalize ${b.direction==="bullish"?"text-emerald-600":b.direction==="bearish"?"text-red-500":""}`}>{b.direction}</div></div>
    <div className="p-2 rounded-lg bg-[#F6F6FB]"><div className="text-[10px] text-[#6D6D82]">Confidence</div><div className="font-semibold tjfx-mono">{b.confidence}%</div></div>
    <div className="p-2 rounded-lg bg-[#F6F6FB]"><div className="text-[10px] text-[#6D6D82]">Session</div><div className="font-semibold">{b.session||"—"}</div></div>
    <div className="p-2 rounded-lg bg-[#F6F6FB]"><div className="text-[10px] text-[#6D6D82]">Date</div><div className="font-semibold tjfx-mono">{b.date}</div></div>
    {b.narrative && <div className="col-span-4 p-2 rounded-lg bg-[#F6F6FB] whitespace-pre-wrap text-[11px]">{b.narrative}</div>}
    {b.poi_tags?.length>0 && <div className="col-span-4 flex flex-wrap gap-1">{b.poi_tags.map(t => <span key={t} className="chip active" style={{padding:"2px 8px", fontSize:10}}>{t}</span>)}</div>}
    {b.ai_summary && <div className="col-span-4 p-2 rounded-lg" style={{background:"#F3E8FF"}}><div className="text-[10px] font-semibold text-[#7C3AED] mb-1">AI Summary</div><div className="text-[11px] whitespace-pre-wrap">{b.ai_summary}</div></div>}
  </div>
);

const TagsBox = ({ label, items, color="purple" }) => (
  <div className="p-3 rounded-xl bg-[#F6F6FB]">
    <div className="text-[10px] text-[#6D6D82] mb-2">{label}</div>
    {items.length===0 ? <div className="text-[10px] text-[#A1A1AA]">—</div> :
      <div className="space-y-1">
        {items.map(([k,v]) => (
          <div key={k} className="flex items-center justify-between text-[11px]">
            <span>{k}</span>
            <span className={`tjfx-mono ${color==="red"?"text-red-500":color==="emerald"?"text-emerald-600":"text-[#7C3AED]"}`}>×{v}</span>
          </div>
        ))}
      </div>
    }
  </div>
);
