import React, { useEffect, useState } from "react";
import { notebookApi } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pin, PinOff, CheckCircle2, Circle, BookOpen, Sparkles, ClipboardList } from "lucide-react";

const KINDS = [
  { id: "rule", label: "Rules", icon: ClipboardList, color: "purple" },
  { id: "lesson", label: "Lessons", icon: Sparkles, color: "amber" },
  { id: "checklist", label: "Checklists", icon: CheckCircle2, color: "emerald" },
];

const inp = "w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white";

export default function Notebook() {
  const [kind, setKind] = useState("rule");
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState({ title: "", body: "", items: [], tags: [] });

  const load = () => notebookApi.list(kind).then(setEntries).catch(()=>{});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kind]);

  const add = async () => {
    if (!draft.title.trim()) return toast.error("Add a title first");
    const payload = { kind, title: draft.title, body: draft.body, items: kind==="checklist"?draft.items:[], tags: draft.tags };
    await notebookApi.create(payload);
    setDraft({ title: "", body: "", items: [], tags: [] });
    toast.success(`${kind[0].toUpperCase()+kind.slice(1)} added`);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this entry?")) return;
    await notebookApi.delete(id);
    load();
  };

  const togglePin = async (e) => {
    await notebookApi.update(e.id, { pinned: !e.pinned });
    load();
  };

  const toggleItem = async (e, idx) => {
    const items = [...(e.items||[])];
    items[idx] = { ...items[idx], checked: !items[idx].checked };
    await notebookApi.update(e.id, { items });
    load();
  };

  const addDraftItem = () => setDraft(p => ({ ...p, items: [...p.items, { text: "", checked: false }] }));

  const pinned = entries.filter(e => e.pinned);
  const rest = entries.filter(e => !e.pinned);

  return (
    <div className="notebook-premium p-4 sm:p-6 max-w-[1280px] mx-auto space-y-4" data-testid="notebook-page">
      <div className="notebook-hero">
        <div><div className="notebook-eyebrow">Trading playbook</div><h1 className="font-display text-3xl font-bold mt-1">Notebook & Rules</h1><p className="text-[#6D6D82] mt-1 text-sm">Capture what works, protect your rules, and keep checklists close to every trade.</p></div>
        <div className="notebook-count"><BookOpen className="w-4 h-4"/><span>{entries.length}</span> {kind}{entries.length === 1 ? "" : "s"}</div>
      </div>

      <div className="notebook-tabs flex gap-1 bg-[#F6F6FB] p-1 rounded-xl w-fit">
        {KINDS.map(k => (
          <button key={k.id} onClick={()=>setKind(k.id)} data-testid={`notebook-tab-${k.id}`}
            className={`px-4 h-9 text-sm rounded-lg font-medium flex items-center gap-2 ${kind===k.id?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82]"}`}>
            <k.icon className="w-4 h-4"/> {k.label}
          </button>
        ))}
      </div>

      {/* Draft */}
      <div className="notebook-composer tjfx-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3"><div><div className="font-display font-bold">Add new {kind}</div><div className="text-[11px] text-[#6D6D82] mt-1">This stays in your private trading playbook.</div></div><span className="text-[11px] uppercase tracking-wider font-bold text-[#7C3AED]">New entry</span></div>
        <input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder={kind==="rule"?"e.g. Never risk more than 1% per trade":kind==="lesson"?"e.g. My best entries come after a clear MSS":"Checklist title, e.g. Pre-trade checklist"} className={inp} data-testid="notebook-title"/>
        {kind!=="checklist" && (
          <textarea value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} rows={3} placeholder="Details, context or examples..." className="w-full p-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"/>
        )}
        {kind==="checklist" && (
          <div className="space-y-2">
            {draft.items.map((it, idx) => (
              <div key={idx} className="flex gap-2">
                <input value={it.text} onChange={e=>{const c=[...draft.items];c[idx]={...c[idx],text:e.target.value};setDraft({...draft,items:c});}} placeholder={`Item ${idx+1}`} className="flex-1 h-9 px-3 rounded-lg border border-[#E8E8F1] text-sm"/>
                <button onClick={()=>setDraft({...draft,items:draft.items.filter((_,i)=>i!==idx)})} className="w-9 h-9 rounded-lg text-[#6D6D82] hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4 mx-auto"/></button>
              </div>
            ))}
            <button onClick={addDraftItem} className="text-sm text-[#7C3AED] font-medium">+ Add item</button>
          </div>
        )}
        <button onClick={add} data-testid="notebook-save" className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4"/> Save</button>
      </div>

      {/* Entries */}
      {pinned.length>0 && (
        <div>
          <div className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wide mb-2 flex items-center gap-1"><Pin className="w-3 h-3"/> Pinned</div>
          <div className="notebook-grid grid md:grid-cols-2 gap-3">{pinned.map(e => <EntryCard key={e.id} e={e} onDelete={remove} onTogglePin={togglePin} onToggleItem={toggleItem}/>)}</div>
        </div>
      )}
      <div>
        {rest.length===0 && pinned.length===0 && <div className="tjfx-card p-8 text-center text-[#6D6D82]"><BookOpen className="w-10 h-10 mx-auto text-[#7C3AED] mb-2"/>No {kind}s yet. Add your first one above.</div>}
        <div className="notebook-grid grid md:grid-cols-2 gap-3">{rest.map(e => <EntryCard key={e.id} e={e} onDelete={remove} onTogglePin={togglePin} onToggleItem={toggleItem}/>)}</div>
      </div>
    </div>
  );
}

function EntryCard({ e, onDelete, onTogglePin, onToggleItem }) {
  return (
    <div className="notebook-entry tjfx-card p-4 tjfx-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="font-display font-bold text-[15px] leading-snug">{e.title}</div>
        <div className="flex gap-1 shrink-0">
          <button onClick={()=>onTogglePin(e)} className="w-8 h-8 rounded-lg text-[#6D6D82] hover:bg-[#F3E8FF] hover:text-[#7C3AED] flex items-center justify-center">{e.pinned? <Pin className="w-4 h-4 fill-[#7C3AED] text-[#7C3AED]"/> : <PinOff className="w-4 h-4"/>}</button>
          <button onClick={()=>onDelete(e.id)} className="w-8 h-8 rounded-lg text-[#6D6D82] hover:bg-red-50 hover:text-red-500 flex items-center justify-center"><Trash2 className="w-4 h-4"/></button>
        </div>
      </div>
      {e.body && <div className="mt-2 text-sm text-[#6D6D82] whitespace-pre-wrap">{e.body}</div>}
      {e.kind==="checklist" && (
        <div className="mt-3 space-y-1.5">
          {(e.items||[]).map((it, idx) => (
            <button key={idx} onClick={()=>onToggleItem(e, idx)} className="w-full flex items-center gap-2 text-left text-sm hover:bg-[#F6F6FB] rounded-lg px-2 py-1.5">
              {it.checked ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> : <Circle className="w-4 h-4 text-[#A1A1AA] shrink-0"/>}
              <span className={it.checked?"line-through text-[#A1A1AA]":""}>{it.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
