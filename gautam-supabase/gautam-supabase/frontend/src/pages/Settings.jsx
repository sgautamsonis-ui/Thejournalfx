import React, { useEffect, useState } from "react";
import { settingsApi, accountsApi, prefsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const TABS = ["Profile","Accounts","Preferences","Trade Presets","Bias Presets","Appearance"];

const PRESET_KINDS = [
  { kind: "strategy", label: "Strategies", hint: "Dropdown in Add Trade → Strategy" },
  { kind: "htf_poi", label: "HTF POIs", hint: "Chips in Add Trade + Bias Center" },
  { kind: "entry_tag", label: "Entry Confirmations", hint: "Chips in Add Trade" },
  { kind: "mood", label: "Moods", hint: "Psychology chips in Add Trade" },
  { kind: "mistake", label: "Mistakes", hint: "Mistake tracker chips" },
  { kind: "strength", label: "Strengths", hint: "Strengths chips in Add Trade" },
  { kind: "session", label: "Sessions", hint: "Session dropdown" },
  { kind: "symbol", label: "Symbols", hint: "Symbol dropdown in Add Trade" },
];
const BIAS_KINDS = [
  { kind: "key_level_weekly", label: "Weekly Key Levels", hint: "Preset names shown in Bias Center → Weekly tab" },
  { kind: "key_level_daily", label: "Daily Key Levels", hint: "Preset names shown in Bias Center → Daily tab" },
];

export default function Settings() {
  const [tab, setTab] = useState("Trade Presets");
  const [settings, setSettings] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [newAcc, setNewAcc] = useState({ name: "", broker: "", account_type: "Live", balance: 10000, currency: "USD" });

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(()=>{});
    accountsApi.list().then(setAccounts).catch(()=>{});
  }, []);

  const savePrefs = async () => { await settingsApi.update(settings); toast.success("Settings saved"); };
  const addAccount = async () => {
    if (!newAcc.name) return;
    const a = await accountsApi.create(newAcc);
    setAccounts([...accounts, a]); setNewAcc({ name: "", broker: "", account_type: "Live", balance: 10000, currency: "USD" });
    toast.success("Account added");
  };
  const delAcc = async (id) => { await accountsApi.delete(id); setAccounts(accounts.filter(a=>a.id!==id)); };

  return (
    <div className="p-8 max-w-[1300px] mx-auto" data-testid="settings-page">
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <p className="text-[#6D6D82] mt-1 mb-6">All your presets and preferences live here. Add once, use everywhere.</p>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 md:col-span-3 tjfx-card p-3 h-fit">
          <div className="space-y-1">
            {TABS.map(t => (
              <button key={t} onClick={()=>setTab(t)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium ${tab===t?"bg-[#F3E8FF] text-[#7C3AED]":"hover:bg-[#F6F6FB] text-[#6D6D82]"}`} data-testid={`tab-${t.toLowerCase().replace(/\s/g,"-")}`}>{t}</button>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-9 space-y-5">
          {tab==="Preferences" && (
            <div className="tjfx-card p-6 space-y-4">
              <h3 className="font-display text-lg font-bold">Trading Preferences</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Currency"><select value={settings.currency||"USD"} onChange={e=>setSettings({...settings,currency:e.target.value})} className="inp">{["USD","INR","EUR","GBP"].map(x=><option key={x}>{x}</option>)}</select></Field>
                <Field label="Default Risk %"><input type="number" step="0.1" value={settings.risk_percent||1} onChange={e=>setSettings({...settings,risk_percent:parseFloat(e.target.value)||0})} className="inp"/></Field>
                <Field label="Default Session"><select value={settings.default_session||"London"} onChange={e=>setSettings({...settings,default_session:e.target.value})} className="inp">{["Asian","London","New York","Overlap"].map(x=><option key={x}>{x}</option>)}</select></Field>
                <Field label="Timezone"><input value={settings.timezone||"UTC"} onChange={e=>setSettings({...settings,timezone:e.target.value})} className="inp"/></Field>
              </div>
              <button onClick={savePrefs} className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold" data-testid="save-prefs">Save Preferences</button>
            </div>
          )}

          {tab==="Trade Presets" && (
            <div className="space-y-5">
              {PRESET_KINDS.map(k => <PresetManager key={k.kind} kind={k.kind} label={k.label} hint={k.hint}/>)}
            </div>
          )}

          {tab==="Bias Presets" && (
            <div className="space-y-4">
              <BiasPresetTabs/>
            </div>
          )}

          {tab==="Accounts" && (
            <div className="tjfx-card p-6">
              <h3 className="font-display text-lg font-bold mb-4">Trading Accounts</h3>
              <div className="grid md:grid-cols-5 gap-2 mb-4">
                <input value={newAcc.name} onChange={e=>setNewAcc({...newAcc,name:e.target.value})} placeholder="Account name" className="inp"/>
                <input value={newAcc.broker} onChange={e=>setNewAcc({...newAcc,broker:e.target.value})} placeholder="Broker" className="inp"/>
                <select value={newAcc.account_type} onChange={e=>setNewAcc({...newAcc,account_type:e.target.value})} className="inp">{["Live","Demo","Prop Firm"].map(x=><option key={x}>{x}</option>)}</select>
                <input type="number" value={newAcc.balance} onChange={e=>setNewAcc({...newAcc,balance:parseFloat(e.target.value)||0})} className="inp"/>
                <button onClick={addAccount} className="h-10 rounded-xl bg-[#7C3AED] text-white font-semibold">+ Add</button>
              </div>
              <div className="space-y-2">
                {accounts.map(a=>(
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E8E8F1]">
                    <div><div className="font-semibold">{a.name}</div><div className="text-xs text-[#6D6D82]">{a.broker} • {a.account_type}</div></div>
                    <div className="flex items-center gap-3"><span className="tjfx-mono">${a.balance?.toFixed(2)} {a.currency}</span><button onClick={()=>delAcc(a.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
                {accounts.length===0 && <div className="text-sm text-[#6D6D82]">No accounts yet.</div>}
              </div>
            </div>
          )}

          {tab==="Profile" && <ProfileTab/>}

          {tab==="Appearance" && <AppearanceTab/>}
        </div>
      </div>

      <style>{`.inp{width:100%;height:40px;padding:0 12px;border:1px solid #E8E8F1;border-radius:12px;outline:none;font-size:14px;background:#fff}.inp:focus{border-color:#7C3AED}`}</style>
    </div>
  );
}

function BiasPresetTabs() {
  const [sub, setSub] = useState("key_level_weekly");
  const active = BIAS_KINDS.find(k => k.kind===sub);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl w-fit" data-testid="bias-preset-tabs">
        {BIAS_KINDS.map(k => (
          <button key={k.kind} onClick={()=>setSub(k.kind)} data-testid={`bias-preset-tab-${k.kind}`}
            className={`px-4 h-9 text-sm rounded-lg font-medium ${sub===k.kind?"bg-white shadow text-[#7C3AED]":"text-[#6D6D82]"}`}>
            {k.label.replace(" Key Levels","")}
          </button>
        ))}
      </div>
      <PresetManager kind={active.kind} label={active.label} hint={active.hint}/>
    </div>
  );
}

function PresetManager({ kind, label, hint }) {
  const [items, setItems] = useState([]);
  const [val, setVal] = useState("");
  const [edit, setEdit] = useState({ id: null, val: "" });

  const load = () => prefsApi.list(kind).then(setItems).catch(()=>{});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kind]);

  const add = async () => {
    if (!val.trim()) return;
    await prefsApi.create(kind, val.trim());
    setVal(""); load();
  };
  const startEdit = (it) => setEdit({ id: it.id, val: it.value });
  const saveEdit = async () => {
    await prefsApi.update(kind, edit.id, edit.val.trim());
    setEdit({ id: null, val: "" }); load();
  };
  const del = async (id) => { await prefsApi.delete(kind, id); load(); };

  return (
    <div className="tjfx-card p-6" data-testid={`preset-${kind}`}>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-lg font-bold">{label}</h3>
        <span className="text-[11px] text-[#A1A1AA]">{items.length} items</span>
      </div>
      <p className="text-xs text-[#6D6D82] mb-4">{hint}</p>
      <div className="flex gap-2 mb-4">
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder={`Add new ${label.toLowerCase().slice(0,-1)}`} className="flex-1 h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" data-testid={`preset-input-${kind}`}/>
        <button onClick={add} className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1"><Plus className="w-4 h-4"/> Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(it => (
          edit.id===it.id ? (
            <div key={it.id} className="flex items-center gap-1 h-8 rounded-full border border-[#7C3AED] bg-white px-2">
              <input value={edit.val} onChange={e=>setEdit({...edit,val:e.target.value})} className="text-sm outline-none w-32"/>
              <button onClick={saveEdit} className="text-emerald-600"><Check className="w-4 h-4"/></button>
              <button onClick={()=>setEdit({id:null,val:""})} className="text-[#6D6D82]"><X className="w-4 h-4"/></button>
            </div>
          ) : (
            <div key={it.id} className="chip active flex items-center gap-1.5 pr-1">
              <span>{it.value}</span>
              <button onClick={()=>startEdit(it)} className="w-5 h-5 rounded-full hover:bg-white/60 flex items-center justify-center"><Pencil className="w-3 h-3"/></button>
              <button onClick={()=>del(it.id)} className="w-5 h-5 rounded-full hover:bg-red-100 hover:text-red-600 flex items-center justify-center"><X className="w-3 h-3"/></button>
            </div>
          )
        ))}
        {items.length===0 && <div className="text-sm text-[#6D6D82]">No items — defaults will seed on next load.</div>}
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div><label className="block text-[12px] font-medium text-[#6D6D82] mb-1.5">{label}</label>{children}</div>
);

function ProfileTab() {
  const { user, refresh } = useAuth();
  const [name, setName] = React.useState(user?.settings?.display_name || user?.name || "");
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    setSaving(true);
    try { await settingsApi.update({ display_name: name.trim() }); await refresh(); toast.success("Profile updated"); }
    catch { toast.error("Save failed"); } finally { setSaving(false); }
  };
  return (
    <div className="tjfx-card p-6 space-y-5" data-testid="profile-tab">
      <div className="flex items-center gap-4">
        {user?.picture ? <img src={user.picture} alt="" className="w-16 h-16 rounded-2xl border border-[#E8E8F1]"/> :
          <div className="w-16 h-16 rounded-2xl bg-[#F3E8FF] flex items-center justify-center text-2xl font-bold text-[#7C3AED]">{(user?.name?.[0]||"T").toUpperCase()}</div>}
        <div>
          <div className="font-display text-xl font-bold">{user?.name}</div>
          <div className="text-sm text-[#6D6D82]">{user?.email}</div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Signed in with Google</div>
        </div>
      </div>
      <Field label="Display name (shown across the app)">
        <input value={name} onChange={e=>setName(e.target.value)} className="inp" data-testid="profile-display-name" placeholder="How would you like to be called?"/>
      </Field>
      <button onClick={save} disabled={saving} data-testid="profile-save" className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-60">
        {saving?"Saving...":"Save Profile"}
      </button>
    </div>
  );
}

const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "The market rewards patience, not prediction.",
  "Focus on the process. Results will follow.",
  "Risk small. Think big. Compound daily.",
  "One trade doesn't define you — one thousand do.",
  "You don't rise to the level of your goals — you fall to the level of your system.",
  "Great traders are made in the losing streaks.",
  "Trade the plan. Not the emotion.",
];

function AppearanceTab() {
  const { user, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const [motivation, setMotivation] = React.useState(user?.settings?.motivation || QUOTES[0]);
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    setSaving(true);
    try { await settingsApi.update({ motivation: motivation.trim() }); await refresh(); toast.success("Motivation updated"); }
    catch { toast.error("Save failed"); } finally { setSaving(false); }
  };
  return (
    <div className="tjfx-card p-6 space-y-5" data-testid="appearance-tab">
      <div>
        <h3 className="font-display text-lg font-bold">Motivational Quote</h3>
        <p className="text-sm text-[#6D6D82]">Shown at the top of your Dashboard every day.</p>
      </div>
      <textarea rows={3} value={motivation} onChange={e=>setMotivation(e.target.value)} className="w-full p-4 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" data-testid="motivation-input" placeholder="Write your own or pick a preset below..."/>
      <div>
        <div className="text-[11px] text-[#6D6D82] uppercase tracking-wide mb-2">Presets</div>
        <div className="flex flex-wrap gap-2">
          {QUOTES.map(q => <button key={q} onClick={()=>setMotivation(q)} className={`chip text-left ${motivation===q?"active":""}`} style={{maxWidth:340}}>{q}</button>)}
        </div>
      </div>
      <button onClick={save} disabled={saving} data-testid="motivation-save" className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-60">
        {saving?"Saving...":"Save Motivation"}
      </button>
      <div className="pt-4 border-t border-[#E8E8F1]">
        <div className="text-sm font-medium mb-2">Colour mode</div>
        <div className="flex gap-2">
          {[["light", "Light"], ["dark", "Dark"]].map(([value, label]) => (
            <button key={value} onClick={() => setTheme(value)} className={`h-10 px-4 rounded-xl border text-sm font-medium ${theme === value ? "bg-[#F3E8FF] border-[#7C3AED] text-[#7C3AED]" : "border-[#E8E8F1] text-[#6D6D82]"}`}>{label}</button>
          ))}
        </div>
        <p className="text-xs text-[#6D6D82] mt-2">This choice is saved to your account and will apply on every device.</p>
      </div>
    </div>
  );
}
