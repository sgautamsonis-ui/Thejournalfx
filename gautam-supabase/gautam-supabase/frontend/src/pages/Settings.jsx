import React, { useEffect, useState } from "react";
import { accountsApi, prefsApi, settingsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Building2, Brain, Check, ChevronRight, Landmark, Layers3, Palette, Pencil, Plus, Save, SlidersHorizontal, Target, Trash2, UserRound, X, ArrowRight } from "lucide-react";
import { PROP_FIRM_TYPES, PROP_FIRM_PRESETS, getActivePropFirmPhase } from "@/lib/propFirm";

const NAV_ITEMS = [
  ["profile", "Profile", "Identity & workspace", UserRound],
  ["trading", "Trading defaults", "Risk & time", SlidersHorizontal],
  ["presets", "Trade presets", "Strategies & trade fields", Layers3],
  ["bias", "Bias presets", "Weekly & daily levels", Target],
  ["psychology", "Psychology", "Moods, mistakes & strengths", Brain],
  ["poi", "HTF POI", "POI & confirmation fields", Landmark],
  ["prop", "Prop firms", "Accounts & guardrails", Building2],
  ["appearance", "Appearance", "Dashboard quote", Palette],
];
const GROUPS = {
  presets: [
    ["strategy", "Strategies", "Used in the Strategy dropdown when adding a trade."],
    ["symbol", "Symbols", "Your preferred instruments in the Symbol dropdown."],
    ["session", "Sessions", "Session choices for every trade."],
  ],
  psychology: [
    ["mood", "Mood tags", "Mood chips used before, during and after a trade."],
    ["mistake", "Mistakes", "Common execution errors to track."],
    ["strength", "Strengths", "Good habits and strengths worth reinforcing."],
  ],
  poi: [
    ["htf_poi_type", "HTF POI types", "The POI type dropdown in your trade plan."],
    ["htf_timeframe", "HTF timeframes", "Timeframe choices for high-timeframe POIs."],
    ["entry_confirmation_type", "Entry confirmation types", "How you confirmed a trade entry."],
    ["entry_timeframe", "Entry timeframes", "Timeframe choices for entry confirmation."],
  ],
  bias: [
    ["key_level_weekly", "Weekly key levels", "Preset names shown in Bias Center’s weekly view."],
    ["key_level_daily", "Daily key levels", "Preset names shown in Bias Center’s daily view."],
  ],
};
const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "The market rewards patience, not prediction.",
  "Focus on the process. Results will follow.",
  "Risk small. Think big. Compound daily.",
  "Trade the plan. Not the emotion.",
  "Great traders are made in the losing streaks.",
];
const EMPTY_ACCOUNT = {
  name: "", broker: "", account_type: "Live", balance: 10000, currency: "USD",
  dailyLimit: "", weeklyLimit: "",
  propFirmType: "",
  // 1 Step / Instant / Prop Firm Live (single phase)
  maxDrawdown: "", dailyDrawdown: "", profitTarget: "",
  // 2 Step — tracked as two separate phases, since you get a fresh account
  // for step 2 after passing step 1 in real prop firms.
  currentStep: 1,
  step1Max: "", step1Daily: "", step1Target: "",
  step2Max: "", step2Daily: "", step2Target: "",
};

export default function Settings() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState("profile");
  const [settings, setSettings] = useState({});
  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [newAccount, setNewAccount] = useState(EMPTY_ACCOUNT);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then(data => { setSettings(data || {}); setName(data?.display_name || user?.name || ""); }).catch(() => {});
    accountsApi.list().then(setAccounts).catch(() => {});
  }, [user?.name]);

  const saveAll = async () => {
    setSaving(true);
    try {
      const data = await settingsApi.update({ ...settings, display_name: name.trim() });
      setSettings(data);
      await refresh();
      toast.success("All settings saved");
    } catch { toast.error("Could not save settings. Please try again."); }
    finally { setSaving(false); }
  };
  const saveLimits = async (id, source) => {
    const all = { ...(settings.account_limits || {}) };
    const clean = {};
    if (source.dailyLimit !== "") clean.daily = Number(source.dailyLimit);
    if (source.weeklyLimit !== "") clean.weekly = Number(source.weeklyLimit);
    if (source.propFirmType) {
      clean.propFirmType = source.propFirmType;
      if (source.propFirmType === "2 Step") {
        clean.currentStep = source.currentStep === 2 ? 2 : 1;
        clean.step1 = {};
        if (source.step1Daily !== "") clean.step1.dailyDrawdown = Number(source.step1Daily);
        if (source.step1Max !== "") clean.step1.maxDrawdown = Number(source.step1Max);
        if (source.step1Target !== "") clean.step1.profitTarget = Number(source.step1Target);
        clean.step2 = {};
        if (source.step2Daily !== "") clean.step2.dailyDrawdown = Number(source.step2Daily);
        if (source.step2Max !== "") clean.step2.maxDrawdown = Number(source.step2Max);
        if (source.step2Target !== "") clean.step2.profitTarget = Number(source.step2Target);
      } else {
        if (source.dailyDrawdown !== "") clean.dailyDrawdown = Number(source.dailyDrawdown);
        if (source.maxDrawdown !== "") clean.maxDrawdown = Number(source.maxDrawdown);
        if (source.profitTarget !== "") clean.profitTarget = Number(source.profitTarget);
      }
    }
    if (Object.keys(clean).length) all[id] = clean; else delete all[id];
    const updated = await settingsApi.update({ account_limits: all });
    setSettings(updated);
  };
  const addAccount = async () => {
    if (!newAccount.name.trim()) return toast.error("Account name is required");
    try {
      const {
        dailyLimit, weeklyLimit, propFirmType, maxDrawdown, dailyDrawdown, profitTarget,
        currentStep, step1Max, step1Daily, step1Target, step2Max, step2Daily, step2Target,
        ...payload
      } = newAccount;
      const created = await accountsApi.create({ ...payload, balance: Number(payload.balance) || 0 });
      await saveLimits(created.id, {
        dailyLimit, weeklyLimit, propFirmType, maxDrawdown, dailyDrawdown, profitTarget,
        currentStep, step1Max, step1Daily, step1Target, step2Max, step2Daily, step2Target,
      });
      setAccounts(items => [...items, created]); setNewAccount(EMPTY_ACCOUNT); toast.success("Trading account added");
    } catch { toast.error("Could not add account"); }
  };
  const startEdit = account => {
    const limits = settings.account_limits?.[account.id] || {};
    setEditing({
      ...account,
      dailyLimit: limits.daily ?? "", weeklyLimit: limits.weekly ?? "",
      propFirmType: limits.propFirmType ?? "",
      maxDrawdown: limits.maxDrawdown ?? "", dailyDrawdown: limits.dailyDrawdown ?? "", profitTarget: limits.profitTarget ?? "",
      currentStep: limits.currentStep === 2 ? 2 : 1,
      step1Max: limits.step1?.maxDrawdown ?? "", step1Daily: limits.step1?.dailyDrawdown ?? "", step1Target: limits.step1?.profitTarget ?? "",
      step2Max: limits.step2?.maxDrawdown ?? "", step2Daily: limits.step2?.dailyDrawdown ?? "", step2Target: limits.step2?.profitTarget ?? "",
    });
  };
  const updateAccount = async () => {
    if (!editing?.name?.trim()) return toast.error("Account name is required");
    try {
      const {
        id, dailyLimit, weeklyLimit, propFirmType, maxDrawdown, dailyDrawdown, profitTarget,
        currentStep, step1Max, step1Daily, step1Target, step2Max, step2Daily, step2Target,
        ...payload
      } = editing;
      const updated = await accountsApi.update(id, { ...payload, balance: Number(payload.balance) || 0 });
      await saveLimits(id, {
        dailyLimit, weeklyLimit, propFirmType, maxDrawdown, dailyDrawdown, profitTarget,
        currentStep, step1Max, step1Daily, step1Target, step2Max, step2Daily, step2Target,
      });
      setAccounts(items => items.map(item => item.id === id ? updated : item)); setEditing(null); toast.success("Account updated");
    } catch { toast.error("Could not update account"); }
  };
  const deleteAccount = async id => {
    try { await accountsApi.delete(id); setAccounts(items => items.filter(item => item.id !== id)); toast.success("Account deleted"); }
    catch { toast.error("Could not delete account"); }
  };

  return <div className="settings-workspace p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto" data-testid="settings-page">
    <header className="settings-hero mb-5 sm:mb-6"><div><div className="settings-eyebrow">Workspace preferences</div><h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Settings</h1><p className="text-sm sm:text-base text-[#6D6D82] mt-2">Fine-tune your journal, workflow and trading guardrails in one place.</p></div><button onClick={saveAll} disabled={saving} className="settings-save-all" data-testid="settings-save-all"><Save className="w-4 h-4"/>{saving ? "Saving changes…" : "Save all changes"}</button></header>
    <div className="settings-layout"><aside className="settings-nav scroll-thin"><div className="settings-nav-label">Settings menu</div>{NAV_ITEMS.map(([id, label, copy, Icon]) => <button key={id} onClick={() => setTab(id)} data-testid={`tab-${id}`} className={`settings-nav-item ${tab === id ? "active" : ""}`}><span className="settings-nav-icon"><Icon className="w-4 h-4"/></span><span className="min-w-0 flex-1 text-left"><span className="block text-sm font-semibold">{label}</span><span className="block text-[11px] mt-0.5 opacity-70 truncate">{copy}</span></span><ChevronRight className="w-4 h-4 opacity-45"/></button>)}</aside>
      <main className="min-w-0 space-y-4 sm:space-y-5">
        {tab === "profile" && <Profile user={user} name={name} setName={setName}/>} 
        {tab === "trading" && <Trading settings={settings} setSettings={setSettings}/>} 
        {tab === "presets" && <PresetGroup items={GROUPS.presets} subStrategies/>}
        {tab === "bias" && <PresetGroup items={GROUPS.bias}/>} 
        {tab === "psychology" && <PresetGroup items={GROUPS.psychology}/>} 
        {tab === "poi" && <PresetGroup items={GROUPS.poi}/>} 
        {tab === "prop" && <Accounts accounts={accounts} settings={settings} newAccount={newAccount} setNewAccount={setNewAccount} editing={editing} setEditing={setEditing} onAdd={addAccount} onEdit={startEdit} onUpdate={updateAccount} onDelete={deleteAccount}/>} 
        {tab === "appearance" && <Appearance settings={settings} setSettings={setSettings}/>} 
      </main></div>
    <SettingsStyle /></div>;
}

function Panel({ title, copy, children }) { return <section className="settings-panel"><div className="settings-panel-head"><div><h2 className="settings-panel-title">{title}</h2><p className="settings-panel-copy">{copy}</p></div></div>{children}</section>; }
function Field({ label, children }) { return <div><label className="block text-[11px] font-bold tracking-wide uppercase text-[#6D6D82] mb-2">{label}</label>{children}</div>; }

function Profile({ user, name, setName }) { return <div className="space-y-4"><Panel title="Your profile" copy="This is how your workspace greets and identifies you."><div className="flex items-center gap-4 pb-5 mb-5 border-b border-[#F0F0F5]">{user?.picture ? <img src={user.picture} alt="" className="w-14 h-14 rounded-2xl object-cover border border-[#E8E8F1]"/> : <div className="w-14 h-14 rounded-2xl bg-[#F3E8FF] text-[#7C3AED] grid place-items-center font-display text-xl font-bold">{(user?.name?.[0] || "T").toUpperCase()}</div>}<div className="min-w-0"><div className="font-display font-bold">{user?.name || "Trader"}</div><div className="text-xs text-[#6D6D82] truncate mt-1">{user?.email}</div></div></div><Field label="Display name"><input value={name} onChange={e => setName(e.target.value)} className="inp" placeholder="How should we call you?" data-testid="profile-display-name"/></Field></Panel><Panel title="Privacy" copy="Your journal data is private to your account."><div className="settings-row"><div><div className="settings-row-title">Secure sign-in</div><div className="settings-row-copy">Signed in securely with Google. Account access is managed through your Google account.</div></div><span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Protected</span></div></Panel></div>; }

function Trading({ settings, setSettings }) { const update = (key, value) => setSettings(current => ({ ...current, [key]: value })); return <div className="space-y-4"><Panel title="Trading defaults" copy="Applied automatically when you start a new trade."><div className="grid sm:grid-cols-2 gap-4"><Field label="Default risk per trade"><div className="relative"><input type="number" min="0" step="0.1" value={settings.risk_percent ?? 1} onChange={e => update("risk_percent", Number(e.target.value))} className="inp pr-8" data-testid="risk-percent-input"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field><Field label="Default currency"><select value={settings.currency || "USD"} onChange={e => update("currency", e.target.value)} className="inp"><option value="USD">USD — US Dollar</option><option value="INR">INR — Indian Rupee</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — British Pound</option></select></Field></div></Panel><Panel title="Time & regional format" copy="Time format updates the trade list, tracker and reports. Times are stored as entered, so changing timezone never alters a recorded trade."><div className="settings-row"><div><div className="settings-row-title">Time format</div><div className="settings-row-copy">Choose how saved trade times are displayed across the workspace.</div></div><select value={settings.time_format || settings.report_time_format || "12h"} onChange={e => { update("time_format", e.target.value); update("report_time_format", e.target.value); }} className="inp settings-select" data-testid="report-time-format-input"><option value="12h">12-hour (AM / PM)</option><option value="24h">24-hour</option></select></div><div className="settings-row"><div><div className="settings-row-title">Reference timezone</div><div className="settings-row-copy">Used in reports and saved for future timezone-aware features.</div></div><select value={settings.report_timezone || settings.timezone || "Asia/Kolkata"} onChange={e => { update("report_timezone", e.target.value); update("timezone", e.target.value); }} className="inp settings-select" data-testid="report-timezone-input"><option value="Asia/Kolkata">India Standard Time (IST)</option><option value="UTC">UTC</option><option value="America/New_York">New York (EST/EDT)</option><option value="Europe/London">London (GMT/BST)</option></select></div></Panel></div>; }

function PresetGroup({ items, subStrategies = false }) { return <div className="space-y-4">{items.map((item, index) => <React.Fragment key={item[0]}><PresetManager kind={item[0]} label={item[1]} hint={item[2]}/>{subStrategies && index === 0 && <SubStrategies/>}</React.Fragment>)}</div>; }
function PresetManager({ kind, label, hint }) { const [items, setItems] = useState([]); const [value, setValue] = useState(""); const [edit, setEdit] = useState(null); useEffect(() => { prefsApi.list(kind).then(setItems).catch(() => {}); }, [kind]); const add = async () => { if (!value.trim()) return; try { const created = await prefsApi.create(kind, value.trim()); setItems(current => [...current, created]); setValue(""); toast.success(`${label} added`); } catch { toast.error("Could not add this item"); } }; const save = async () => { if (!edit?.value.trim()) return; try { const updated = await prefsApi.update(kind, edit.id, edit.value.trim()); setItems(current => current.map(item => item.id === updated.id ? updated : item)); setEdit(null); toast.success(`${label} updated`); } catch { toast.error("Could not update this item"); } }; const remove = async id => { try { await prefsApi.delete(kind, id); setItems(current => current.filter(item => item.id !== id)); toast.success(`${label} removed`); } catch { toast.error("Could not remove this item"); } }; return <Panel title={label} copy={hint}><div className="flex gap-2 mb-4"><input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} className="inp flex-1" placeholder={`Add a ${label.toLowerCase().replace(/s$/, "")}`}/><button onClick={add} className="settings-add"><Plus className="w-4 h-4"/>Add</button></div><div className="flex flex-wrap gap-2">{items.map(item => edit?.id === item.id ? <div key={item.id} className="edit-chip"><input autoFocus value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value })}/><button onClick={save} className="text-emerald-600"><Check className="w-4 h-4"/></button><button onClick={() => setEdit(null)}><X className="w-4 h-4"/></button></div> : <div key={item.id} className="setting-chip"><span>{item.value}</span><button aria-label={`Edit ${item.value}`} onClick={() => setEdit(item)}><Pencil className="w-3 h-3"/></button><button aria-label={`Remove ${item.value}`} onClick={() => remove(item.id)}><X className="w-3 h-3"/></button></div>)}{items.length === 0 && <div className="text-sm text-[#6D6D82] py-1">No custom items yet. Add the ones you use most.</div>}</div></Panel>; }
function SubStrategies() { const [strategies, setStrategies] = useState([]); const [items, setItems] = useState([]); const [parent, setParent] = useState(""); const [value, setValue] = useState(""); useEffect(() => { Promise.all([prefsApi.list("strategy"), prefsApi.list("sub_strategy")]).then(([s, sub]) => { setStrategies(s); setItems(sub); setParent(s[0]?.value || ""); }).catch(() => {}); }, []); const add = async () => { if (!parent || !value.trim()) return; try { const item = await prefsApi.create("sub_strategy", `${parent}::${value.trim()}`); setItems(current => [...current, item]); setValue(""); toast.success("Sub-strategy added"); } catch { toast.error("Could not add sub-strategy"); } }; const remove = async id => { try { await prefsApi.delete("sub_strategy", id); setItems(current => current.filter(item => item.id !== id)); } catch { toast.error("Could not remove sub-strategy"); } }; return <Panel title="Sub-strategies" copy="Attach a precise setup label to a parent strategy. Example: Liquidity sweep → PDL."><div className="grid sm:grid-cols-[minmax(150px,.45fr)_1fr_auto] gap-2 mb-4"><select value={parent} onChange={e => setParent(e.target.value)} className="inp">{strategies.length === 0 && <option value="">Add a strategy first</option>}{strategies.map(item => <option key={item.id} value={item.value}>{item.value}</option>)}</select><input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} className="inp" placeholder="Add sub-strategy"/><button onClick={add} className="settings-add"><Plus className="w-4 h-4"/>Add</button></div><div className="space-y-3">{strategies.map(strategy => { const children = items.filter(item => item.value.split("::")[0] === strategy.value); return children.length ? <div key={strategy.id}><div className="text-[11px] font-bold text-[#7C3AED] mb-1.5">{strategy.value}</div><div className="flex flex-wrap gap-2">{children.map(item => <div key={item.id} className="setting-chip"><span>{item.value.split("::").slice(1).join("::")}</span><button onClick={() => remove(item.id)}><X className="w-3 h-3"/></button></div>)}</div></div> : null; })}</div></Panel>; }

function PropFirmFields({ account, setAccount }) {
  const set = (key, value) => setAccount(current => ({ ...current, [key]: value }));
  const onType = (t) => {
    const preset = PROP_FIRM_PRESETS[t] || {};
    if (t === "2 Step") {
      setAccount(current => ({
        ...current,
        propFirmType: t,
        currentStep: current.currentStep || 1,
        step1Max: current.step1Max || (preset.step1?.maxDrawdown ?? ""),
        step1Daily: current.step1Daily || (preset.step1?.dailyDrawdown ?? ""),
        step1Target: current.step1Target || (preset.step1?.profitTarget ?? ""),
        step2Max: current.step2Max || (preset.step2?.maxDrawdown ?? ""),
        step2Daily: current.step2Daily || (preset.step2?.dailyDrawdown ?? ""),
        step2Target: current.step2Target || (preset.step2?.profitTarget ?? ""),
      }));
    } else {
      setAccount(current => ({
        ...current,
        propFirmType: t,
        maxDrawdown: current.maxDrawdown || (preset.maxDrawdown ?? ""),
        dailyDrawdown: current.dailyDrawdown || (preset.dailyDrawdown ?? ""),
        profitTarget: current.profitTarget || (preset.profitTarget ?? ""),
      }));
    }
  };
  return <>
    <Field label="Challenge type">
      <select value={account.propFirmType} onChange={e => onType(e.target.value)} className="inp" data-testid="prop-firm-type">
        <option value="">Select type</option>
        {PROP_FIRM_TYPES.map(t => <option key={t}>{t}</option>)}
      </select>
    </Field>

    {account.propFirmType === "2 Step" && (
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 text-xs text-[#6D6D82]">
        <span>Currently on:</span>
        <select value={account.currentStep} onChange={e => set("currentStep", Number(e.target.value))} className="h-8 px-2 rounded-lg border border-[#E8E8F1] text-xs">
          <option value={1}>Step 1</option>
          <option value={2}>Step 2</option>
        </select>
        {account.currentStep !== 2 && (
          <button type="button" onClick={() => set("currentStep", 2)} className="text-[11px] text-[#7C3AED] font-semibold hover:underline flex items-center gap-0.5" data-testid="prop-firm-advance-step">
            Passed Step 1 <ArrowRight className="w-3 h-3" /> Move to Step 2
          </button>
        )}
      </div>
    )}

    {account.propFirmType === "2 Step" ? (
      <>
        <Field label="Step 1 — Daily drawdown"><div className="relative"><input type="number" value={account.step1Daily} onChange={e => set("step1Daily", e.target.value)} className="inp pr-8" placeholder="e.g. 5"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Step 1 — Max drawdown"><div className="relative"><input type="number" value={account.step1Max} onChange={e => set("step1Max", e.target.value)} className="inp pr-8" placeholder="e.g. 10"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Step 1 — Profit target"><div className="relative"><input type="number" value={account.step1Target} onChange={e => set("step1Target", e.target.value)} className="inp pr-8" placeholder="e.g. 8"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Step 2 — Daily drawdown"><div className="relative"><input type="number" value={account.step2Daily} onChange={e => set("step2Daily", e.target.value)} className="inp pr-8" placeholder="e.g. 5"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Step 2 — Max drawdown"><div className="relative"><input type="number" value={account.step2Max} onChange={e => set("step2Max", e.target.value)} className="inp pr-8" placeholder="e.g. 10"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Step 2 — Profit target"><div className="relative"><input type="number" value={account.step2Target} onChange={e => set("step2Target", e.target.value)} className="inp pr-8" placeholder="e.g. 5"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
      </>
    ) : account.propFirmType === "1 Step" ? (
      <>
        <Field label="Daily drawdown"><div className="relative"><input type="number" value={account.dailyDrawdown} onChange={e => set("dailyDrawdown", e.target.value)} className="inp pr-8" placeholder="e.g. 5"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Maximum drawdown"><div className="relative"><input type="number" value={account.maxDrawdown} onChange={e => set("maxDrawdown", e.target.value)} className="inp pr-8" placeholder="e.g. 10"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Profit target"><div className="relative"><input type="number" value={account.profitTarget} onChange={e => set("profitTarget", e.target.value)} className="inp pr-8" placeholder="e.g. 8"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
      </>
    ) : (account.propFirmType === "Instant" || account.propFirmType === "Prop Firm Live") ? (
      <>
        <Field label="Daily drawdown"><div className="relative"><input type="number" value={account.dailyDrawdown} onChange={e => set("dailyDrawdown", e.target.value)} className="inp pr-8" placeholder="e.g. 3"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
        <Field label="Maximum drawdown"><div className="relative"><input type="number" value={account.maxDrawdown} onChange={e => set("maxDrawdown", e.target.value)} className="inp pr-8" placeholder="e.g. 6"/><span className="absolute right-3 top-3 text-xs text-[#6D6D82]">%</span></div></Field>
      </>
    ) : null}
  </>;
}
function AccountFields({ account, setAccount }) { const set = (key, value) => setAccount(current => ({ ...current, [key]: value })); return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"><Field label="Account name"><input value={account.name} onChange={e => set("name", e.target.value)} className="inp" placeholder="e.g. FTMO 100K"/></Field><Field label="Broker / firm"><input value={account.broker || ""} onChange={e => set("broker", e.target.value)} className="inp" placeholder="e.g. FTMO"/></Field><Field label="Account type"><select value={account.account_type} onChange={e => set("account_type", e.target.value)} className="inp"><option>Live</option><option>Demo</option><option>Prop Firm</option></select></Field><Field label="Starting balance"><input type="number" value={account.balance} onChange={e => set("balance", e.target.value)} className="inp"/></Field>{account.account_type !== "Prop Firm" && <><Field label="Daily loss limit"><input type="number" value={account.dailyLimit} onChange={e => set("dailyLimit", e.target.value)} className="inp" placeholder="Optional $ limit"/></Field><Field label="Weekly loss limit"><input type="number" value={account.weeklyLimit} onChange={e => set("weeklyLimit", e.target.value)} className="inp" placeholder="Optional $ limit"/></Field></>}{account.account_type === "Prop Firm" && <PropFirmFields account={account} setAccount={setAccount}/>}</div>; }
function Accounts({ accounts, settings, newAccount, setNewAccount, editing, setEditing, onAdd, onEdit, onUpdate, onDelete }) { return <div className="space-y-4"><Panel title="Add trading account" copy="Create a dedicated account and set safety limits that protect your trading discipline."><AccountFields account={newAccount} setAccount={setNewAccount}/><button onClick={onAdd} className="settings-add mt-4"><Plus className="w-4 h-4"/>Add account</button></Panel><Panel title="Your accounts" copy="Edit account details and prop-firm limits without leaving Settings.">{accounts.length === 0 ? <div className="text-sm text-[#6D6D82] py-2">No accounts yet. Add your first one above.</div> : <div className="space-y-3">{accounts.map(account => { const limits = settings.account_limits?.[account.id] || {}; const phase = getActivePropFirmPhase(limits); const extra = limits.propFirmType ? [limits.propFirmType, limits.propFirmType === "2 Step" && phase?.stepLabel, phase?.dailyDrawdown !== undefined && `Daily DD ${phase.dailyDrawdown}%`, phase?.maxDrawdown !== undefined && `Max DD ${phase.maxDrawdown}%`, phase?.hasTarget && phase?.profitTarget !== undefined && `Target ${phase.profitTarget}%`].filter(Boolean).join(" · ") : [limits.daily !== undefined && `Daily $${limits.daily}`, limits.weekly !== undefined && `Weekly $${limits.weekly}`].filter(Boolean).join(" · "); return editing?.id === account.id ? <div key={account.id} className="account-edit"><AccountFields account={editing} setAccount={setEditing}/><div className="flex gap-2 mt-4"><button onClick={onUpdate} className="settings-add"><Check className="w-4 h-4"/>Save account</button><button onClick={() => setEditing(null)} className="settings-secondary">Cancel</button></div></div> : <div key={account.id} className="account-row"><div className="min-w-0"><div className="font-display text-sm font-bold">{account.name}</div><div className="text-[11px] text-[#6D6D82] mt-1">{[account.broker, account.account_type, extra].filter(Boolean).join(" · ")}</div></div><div className="flex items-center gap-2 shrink-0"><span className="text-xs font-bold text-[#16151F]">${Number(account.balance || 0).toLocaleString()} {account.currency || "USD"}</span><button onClick={() => onEdit(account)} className="icon-button" aria-label={`Edit ${account.name}`}><Pencil className="w-4 h-4"/></button><button onClick={() => onDelete(account.id)} className="icon-button danger" aria-label={`Delete ${account.name}`}><Trash2 className="w-4 h-4"/></button></div></div>; })}</div>}</Panel></div>; }
function Appearance({ settings, setSettings }) { const value = settings.motivation || QUOTES[0]; return <Panel title="Dashboard motivation" copy="Set the reminder shown beneath your name in the workspace header."><textarea rows={3} value={value} onChange={e => setSettings(current => ({ ...current, motivation: e.target.value }))} className="w-full p-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" data-testid="motivation-input"/><div className="grid sm:grid-cols-2 gap-2 mt-4">{QUOTES.map(quote => <button key={quote} onClick={() => setSettings(current => ({ ...current, motivation: quote }))} className={`quote-preset ${value === quote ? "active" : ""}`}>{quote}</button>)}</div></Panel>; }

function SettingsStyle() { return <style>{`.inp{width:100%;height:42px;padding:0 12px;border:1px solid #E8E8F1;border-radius:12px;outline:none;font-size:14px;background:#fff}.inp:focus{border-color:#7C3AED;box-shadow:0 0 0 3px rgba(124,58,237,.09)}.settings-hero{display:flex;align-items:end;justify-content:space-between;gap:18px}.settings-eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7C3AED}.settings-save-all,.settings-add{height:42px;padding:0 16px;border-radius:12px;background:#7C3AED;color:white;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 9px 18px rgba(124,58,237,.18);transition:.2s}.settings-save-all:hover,.settings-add:hover{background:#6D28D9;transform:translateY(-1px)}.settings-save-all:disabled{opacity:.65;transform:none}.settings-layout{display:grid;grid-template-columns:252px minmax(0,1fr);gap:20px;align-items:start}.settings-nav{position:sticky;top:18px;background:rgba(255,255,255,.82);border:1px solid #E8E8F1;border-radius:22px;padding:10px;box-shadow:0 12px 36px rgba(22,21,31,.04)}.settings-nav-label{padding:8px 10px 7px;font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:#A1A1AA}.settings-nav-item{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;color:#6D6D82;transition:.18s}.settings-nav-item:hover{background:#F6F6FB;color:#16151F}.settings-nav-item.active{background:linear-gradient(135deg,#F3E8FF,#FAF5FF);color:#6D28D9;box-shadow:inset 0 0 0 1px rgba(124,58,237,.12)}.settings-nav-icon{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;background:#F6F6FB}.settings-nav-item.active .settings-nav-icon{background:#7C3AED;color:white}.settings-panel{background:#fff;border:1px solid #E8E8F1;border-radius:22px;padding:22px;box-shadow:0 6px 22px rgba(22,21,31,.025)}.settings-panel-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:20px}.settings-panel-title{font-family:Comfortaa,sans-serif;font-size:18px;font-weight:700}.settings-panel-copy{font-size:12px;line-height:1.55;color:#6D6D82;margin-top:5px}.settings-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:15px 0;border-top:1px solid #F0F0F5}.settings-row:first-of-type{border-top:0;padding-top:0}.settings-row-title{font-size:13px;font-weight:700}.settings-row-copy{font-size:11px;line-height:1.5;color:#6D6D82;margin-top:4px}.settings-select{width:190px;flex:none}.setting-chip,.edit-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 7px 6px 11px;border:1px solid #DDD6FE;border-radius:999px;background:#F5F3FF;color:#6D28D9;font-size:12px;font-weight:600}.setting-chip button,.edit-chip button{width:20px;height:20px;display:grid;place-items:center;border-radius:999px}.setting-chip button:hover{background:#E9D5FF}.edit-chip{background:#fff;border-color:#7C3AED;padding-left:9px}.edit-chip input{outline:0;width:130px;font-size:12px}.quote-preset{padding:10px 12px;border:1px solid #E8E8F1;border-radius:12px;text-align:left;font-size:11px;color:#6D6D82;transition:.18s}.quote-preset:hover,.quote-preset.active{border-color:#7C3AED;background:#F3E8FF;color:#6D28D9}.account-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #F0F0F5}.account-row:first-child{border-top:0;padding-top:0}.account-edit{padding:16px;border:1px solid #DDD6FE;background:#FAF7FF;border-radius:16px}.settings-secondary{height:42px;padding:0 16px;border-radius:12px;border:1px solid #E8E8F1;color:#6D6D82;font-size:13px;font-weight:700}.icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid #E8E8F1;border-radius:9px;color:#6D6D82}.icon-button:hover{border-color:#7C3AED;color:#7C3AED}.icon-button.danger:hover{border-color:#FCA5A5;color:#DC2626;background:#FEF2F2}@media(max-width:900px){.settings-layout{grid-template-columns:1fr}.settings-nav{position:static;display:flex;overflow:auto;gap:6px;padding:8px}.settings-nav-label{display:none}.settings-nav-item{min-width:170px}.settings-nav-item span span:last-child,.settings-nav-item>svg{display:none}}@media(max-width:640px){.settings-hero{align-items:start;flex-direction:column}.settings-save-all{width:100%}.settings-panel{padding:16px}.settings-row{align-items:start;flex-direction:column;gap:10px}.settings-select{width:100%}.account-row{align-items:start;flex-direction:column}.account-row>div:last-child{width:100%;justify-content:space-between}}`}</style>; }
