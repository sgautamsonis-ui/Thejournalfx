import React, { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { biasApi } from "@/lib/api";
import { useLightbox } from "@/components/ImageLightbox";

export function AttachmentPanel({ images, onFile, uploadingCount = 0 }) {
  const openLightbox = useLightbox();
  return <div className="tjfx-card p-6">
    <h3 className="font-display text-lg font-bold">Trade Notes & Attachments</h3>
    <p className="text-xs text-[#6D6D82] mt-1 mb-4">Upload or paste chart screenshots; larger previews stay readable.</p>
    <label className="block border-2 border-dashed border-[#E8E8F1] rounded-2xl p-8 text-center hover:border-[#7C3AED] cursor-pointer">
      <Upload className="w-7 h-7 mx-auto text-[#7C3AED] mb-2"/><div className="text-sm text-[#6D6D82]">Click to upload chart images, or paste directly</div>
      <input type="file" multiple accept="image/*" onChange={onFile} className="hidden"/>
    </label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {images.map((image,i)=><img key={i} src={image} alt={`Trade chart ${i+1}`} onClick={()=>openLightbox(images,i)} className="w-full h-52 object-cover rounded-xl border border-[#E8E8F1] cursor-zoom-in"/>)}
      {Array.from({length: uploadingCount}).map((_,i)=><div key={`u${i}`} className="w-full h-52 rounded-xl border-2 border-dashed border-[#7C3AED]/40 bg-[#F3E8FF]/40 flex items-center justify-center text-sm text-[#7C3AED] animate-pulse">Uploading...</div>)}
    </div>
  </div>;
}

function formatBullets(text) {
  if (!text) return [];
  return text.split("\n").map(l => l.trim()).filter(l => /^[-•*]/.test(l));
}

export function LinkedBiasCard({ number = "1" }) {
  const [biases, setBiases] = useState({ daily: null, weekly: null });
  const openLightbox = useLightbox();
  useEffect(() => { let alive = true; Promise.all([biasApi.latest("daily"), biasApi.latest("weekly")]).then(([daily, weekly]) => alive && setBiases({ daily, weekly })).catch(() => {}); return () => { alive = false; }; }, []);
  return <section className="tjfx-card p-6" data-testid="linked-bias-card">
    <div className="flex items-start gap-3 mb-1"><span className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-sm font-bold flex items-center justify-center shrink-0">{number}</span><div><h3 className="font-display text-lg font-bold leading-6">Daily / Weekly Bias</h3><p className="text-xs text-[#6D6D82] mt-0.5">Condensed live view from Bias Center — edit the full source there.</p></div></div>
    <div className="grid md:grid-cols-2 gap-4 mt-4">{[["Daily",biases.daily],["Weekly",biases.weekly]].map(([label,b])=>{
      const dir = b?.direction;
      const tint = dir === "bullish" ? "border-emerald-200 bg-emerald-50/40" : dir === "bearish" ? "border-red-200 bg-red-50/40" : "border-[#E8E8F1]";
      const bullets = formatBullets(b?.ai_summary).map(l => l.replace(/^[-•*]\s*/, "")).slice(0, 4);
      const levels = (b?.key_levels || []).map(x => x.name || x.price).filter(Boolean).slice(0, 6);
      return (
      <div key={label} className={`rounded-2xl border overflow-hidden ${tint}`}>
        <div className="p-3.5 flex items-center justify-between border-b border-black/5"><b className="text-sm">{label} Bias</b><span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${dir==="bullish"?"bg-emerald-500 text-white":dir==="bearish"?"bg-red-500 text-white":"bg-[#E8E8F1] text-[#6D6D82]"}`}>{dir || "Not set"}</span></div>
        {b?.images?.length>0 && (
          <div className="flex gap-1.5 p-3.5 pb-0 overflow-x-auto">
            {b.images.slice(0,4).map((src,i)=>(
              <img key={i} src={src} alt="" onClick={()=>openLightbox(b.images,i)} className="h-20 w-28 object-cover rounded-lg border border-black/5 shrink-0 cursor-zoom-in"/>
            ))}
          </div>
        )}
        <div className="p-3.5 text-sm text-[#6D6D82] space-y-2.5">
          {bullets.length > 0 ? (
            <ul className="space-y-1 list-disc list-inside text-[13px]">
              {bullets.map((line,i) => <li key={i} className="text-[#16151F]">{line}</li>)}
            </ul>
          ) : b?.narrative ? (
            <p className="text-[13px] line-clamp-3 whitespace-pre-wrap">{b.narrative}</p>
          ) : <p className="text-xs text-[#A1A1AA]">No saved bias for the current period yet — run it from Bias Center.</p>}
          {levels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-black/5">
              {levels.map((lv, i) => (
                <span key={i} className={`text-[11px] font-semibold tjfx-mono px-2 py-0.5 rounded-full ${dir==="bearish"?"bg-red-100 text-red-700":"bg-emerald-100 text-emerald-700"}`}>{lv}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );})}</div>
  </section>;
}
