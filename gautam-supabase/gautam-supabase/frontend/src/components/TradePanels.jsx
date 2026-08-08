import React, { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { biasApi } from "@/lib/api";

export function AttachmentPanel({ images, onFile }) {
  return <div className="tjfx-card p-6">
    <h3 className="font-display text-lg font-bold">Trade Notes & Attachments</h3>
    <p className="text-xs text-[#6D6D82] mt-1 mb-4">Upload or paste chart screenshots; larger previews stay readable.</p>
    <label className="block border-2 border-dashed border-[#E8E8F1] rounded-2xl p-8 text-center hover:border-[#7C3AED] cursor-pointer">
      <Upload className="w-7 h-7 mx-auto text-[#7C3AED] mb-2"/><div className="text-sm text-[#6D6D82]">Click to upload chart images, or paste directly</div>
      <input type="file" multiple accept="image/*" onChange={onFile} className="hidden"/>
    </label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">{images.map((image,i)=><img key={i} src={image} alt={`Trade chart ${i+1}`} className="w-full h-52 object-cover rounded-xl border border-[#E8E8F1]"/>)}</div>
  </div>;
}

export function LinkedBiasCard() {
  const [biases, setBiases] = useState({ daily: null, weekly: null });
  useEffect(() => { let alive = true; Promise.all([biasApi.latest("daily"), biasApi.latest("weekly")]).then(([daily, weekly]) => alive && setBiases({ daily, weekly })).catch(() => {}); return () => { alive = false; }; }, []);
  return <section className="tjfx-card p-6" data-testid="linked-bias-card">
    <h3 className="font-display text-lg font-bold">4. Daily / Weekly Bias</h3><p className="text-xs text-[#6D6D82] mt-1">Live view from Bias Center — edit the source there.</p>
    <div className="grid md:grid-cols-2 gap-4 mt-4">{[["Daily",biases.daily],["Weekly",biases.weekly]].map(([label,b])=><div key={label} className="rounded-2xl border border-[#E8E8F1] overflow-hidden">
      <div className="p-4 flex items-center justify-between"><b>{label} Bias</b><span className={`text-xs font-bold uppercase ${b?.direction==="bullish"?"text-emerald-600":b?.direction==="bearish"?"text-red-500":"text-[#6D6D82]"}`}>{b?.direction || "Not set"}</span></div>
      {b?.images?.[0] && <img src={b.images[0]} alt={`${label} bias chart`} className="w-full h-44 object-cover"/>}
      <div className="p-4 text-sm text-[#6D6D82]"><div className="font-semibold text-[#7C3AED] mb-1">AI summary</div><p>{b?.ai_summary || b?.narrative || "No saved bias for the current period yet."}</p>{b?.key_levels?.length>0 && <p className="mt-3 text-xs"><b>Key levels:</b> {b.key_levels.map(x=>x.name || x.price).filter(Boolean).join(" · ")}</p>}</div>
    </div>)}</div>
  </section>;
}
