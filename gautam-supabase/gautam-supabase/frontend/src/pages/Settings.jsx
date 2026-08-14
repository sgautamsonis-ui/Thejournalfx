import React, { useEffect, useState } from "react";
import { settingsApi, accountsApi, prefsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Check, X, Save, CheckCircle2 } from "lucide-react";

const TABS = ["Profile","Trade Presets","Bias Presets"];

// Small reusable hook that shows a "Saved ✓" confirmation on a save button
// for a couple seconds after a successful save, instead of the button just
// silently reverting back to its idle label with no feedback.
function useSaveFeedback() {
  const [state, setState] = useState("idle"); // idle | saving | saved
  const run = async (fn) => {
    setState("saving");
    try {
      await fn();
      setState("saved");
      setTimeout(() => setState("idle"), 1800);
    } catch (e) {
      setState("idle");
      throw e;
    }
  };
  return [state, run];
}

function SaveButton({ state, onClick, idleLabel, testId }) {
  return (
    <button
      onClick={onClick}
      disabled={state === "saving"}
      data-testid={testId}
      className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
    >
      {state === "saved" && <CheckCircle2 className="w-4 h-4" />}
      {state === "saving" ? "Saving..." : state === "saved" ? "Saved" : idleLabel}
    </button>
  );
}

const PROP_FIRM_TYPES = ["1 Step", "2 Step", "Instant"];
const PROP_FIRM_PRESETS = {
  "1 Step": { maxDrawdown: 10, profitTarget: 8 },
  "2 Step": { maxDrawdown: 10, profitTarget: 8 },
  "Instant": { maxDrawdown: 6, profitTarget: 10 },
};

const PRESET_KINDS = [
  { kind: "strategy", label: "Strategies", hint: "Dropdown in Add Trade → Strategy" },
  { kind: "htf_poi_type", label: "HTF POI Types", hint: "Second dropdown in the HTF POI builder" },
  { kind: "htf_timeframe", label: "HTF Timeframes", hint: "First dropdown in the HTF POI builder" },
  { kind: "entry_confirmation_type", label: "Entry Confirmation Types", hint: "Second dropdown in the Entry Confirmation builder" },
  { kind: "entry_timeframe", label: "Entry Timeframes", hint: "First dropdown in the Entry Confirmation builder" },
  { kind: "mood", label: "Psychology Moods", hint: "Mood chips in Add Trade" },
  { kind: "mistake", label: "Mistakes", hint: "Mistake tracker chips" },
  { kind: "strength", label: "Strengths", hint: "Strengths chips in Add Trade" },
  { kind: "session", label: "Sessions", hint: "Session dropdown" },
  { kind: "symbol", label: "Symbols", hint: "Symbol dropdown in Add Trade" },
];
const BIAS_KINDS = [
  { kind: "key_level_weekly", label: "Weekly Key Levels", hint: "Preset names shown in Bias Center → Weekly tab" },
  { kind: "key_level_daily", label: "Daily Key Levels", hint: "Preset names shown in Bias Center → Daily tab" },
];

const EMPTY_NEW_ACC = { name: "", broker: "", account_type: "Live", balance: 10000, currency: "USD", dailyLimit: "", weeklyLimit: "", propFirmType: "", maxDrawdown: "", profitTarget: "" };

export default function Settings() {
  const { refresh } = useAuth();
  const [tab, setTab] = useState("Profile");
  const [settings, setSettings] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [newAcc, setNewAcc] = useState(EMPTY_NEW_ACC);
  const [editAcc, setEditAcc] = useState(null);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(()=>{});
    accountsApi.list().then(setAccounts).catch(()=>{});
  }, []);

  // Persists whatever is currently in `settings` (risk %, report time
  // format, report timezone, account drawdown/prop-firm limits, ...).
  // Different cards below share this one function since they all just
  // read/write into the same `settings` object.
  const savePrefs = async () => {
    const merged = await settingsApi.update(settings);
    setSettings(merged);
    await refresh();
  };

  // Per-account extras (daily/weekly DD limits + prop firm type/DD/target)
  // are stored inside settings.account_limits[accountId], the same place
  // the daily/weekly limits already lived — no database migration needed.
  const saveAccountLimits = async (accountId, extra) => {
    const nextLimits = { ...(settings.account_limits || {}) };
    const clean = {};
    if (extra.dailyLimit) clean.daily = parseFloat(extra.dailyLimit);
    if (extra.weeklyLimit) clean.weekly = parseFloat(extra.weeklyLimit);
    if (extra.propFirmType) clean.propFirmType = extra.propFirmType;
    if (extra.maxDrawdown) clean.maxDrawdown = parseFloat(extra.maxDrawdown);
    if (extra.profitTarget) clean.profitTarget = parseFloat(extra.profitTarget);
    if (Object.keys(clean).length) {
      nextLimits[accountId] = clean;
    } else {
      delete nextLimits[accountId];
    }
    try {
      const merged = await settingsApi.update({ account_limits: nextLimits });
      setSettings(merged);
      await refresh();
    } catch {
      toast.error("Could not save account limits — please try again.");
    }
  };

  const addAccount = async () => {
    if (!newAcc.name) { toast.error("Account name is required"); return; }
    try {
      const { dailyLimit, weeklyLimit, propFirmType, maxDrawdown, profitTarget, ...accPayload } = newAcc;
      const a = await accountsApi.create(accPayload);
      setAccounts(prev => [...prev, a]);
      if (dailyLimit || weeklyLimit || propFirmType || maxDrawdown || profitTarget) {
        await saveAccountLimits(a.id, { dailyLimit, weeklyLimit, propFirmType, maxDrawdown, profitTarget });
      }
      setNewAcc(EMPTY_NEW_ACC);
      toast.success("Account added");
    } catch {
      toast.error("Could not add account — please try again.");
    }
  };
  const delAcc = async (id) => {
    try { await accountsApi.delete(id); setAccounts(prev => prev.filter(a=>a.id!==id)); toast.success("Account deleted"); }
    catch { toast.error("Could not delete account — please try again."); }
  };

  const startEditAcc = (a) => {
    const limits = settings.account_limits?.[a.id] || {};
    setEditAcc({
      id: a.id, name: a.name, broker: a.broker || "", account_type: a.account_type || "Live",
      balance: a.balance, currency: a.currency || "USD",
      dailyLimit: limits.daily ?? "", weeklyLimit: limits.weekly ?? "",
      propFirmType: limits.propFirmType ?? "", maxDrawdown: limits.maxDrawdown ?? "", profitTarget: limits.profitTarget ?? "",
    });
  };
  const saveEditAcc = async () => {
    if (!editAcc?.name) { toast.error("Account name is required"); return; }
    try {
      const { id, dailyLimit, weeklyLimit, propFirmType, maxDrawdown, profitTarget, ...accPayload } = editAcc;
      const updated = await accountsApi.update(id, { ...accPayload, balance: parseFloat(accPayload.balance) || 0 });
      setAccounts(prev => prev.map(a => a.id === id ? updated : a));
      await saveAccountLimits(id, { dailyLimit, weeklyLimit, propFirmType, maxDrawdown, profitTarget });
      setEditAcc(null);
      toast.success("Account updated");
    } catch {
      toast.error("Could not update account — please try again.");
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-[1300px] mx-auto" data-testid="settings-page">
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

        <div className="col-span-12 md:col-span-9 space-y-4">
          {tab==="Profile" && (
            <div className="space-y-5">
              <ProfileTab/>

              {/* TRADING DEFAULTS — just Risk %, the only Preferences field that was actually wired up anywhere (AddTrade / TradeView). */}
              <RiskSection settings={settings} setSettings={setSettings} savePrefs={savePrefs}/>

              {/* TIME — report time format actually reformats the Trades table in
                  Reports now; report timezone is shown as a label on the report
                  header (entry times are stored as plain "HH:MM" with no source
                  timezone, so a real conversion isn't reliable). */}
              <TimeSection settings={settings} setSettings={setSettings} savePrefs={savePrefs}/>

              <AppearanceTab/>

              <AccountsSection
                settings={settings} accounts={accounts}
                newAcc={newAcc} setNewAcc={setNewAcc}
                editAcc={editAcc} setEditAcc={setEditAcc}
                addAccount={addAccount} delAcc={delAcc}
                startEditAcc={startEditAcc} saveEditAcc={saveEditAcc}
              />
            </div>
          )}

          {tab==="Trade Presets" && (
            <div className="space-y-5">
              {PRESET_KINDS.map(k => (
                <React.Fragment key={k.kind}>
                  <PresetManager kind={k.kind} label={k.label} hint={k.hint}/>
                  {k.kind==="strategy" && <StrategySubPresetManager/>}
                </React.Fragment>
              ))}
            </div>
          )}

          {tab==="Bias Presets" && (
            <div className="space-y-4">
              <BiasPresetTabs/>
            </div>
          )}
        </div>
      </div>

      <style>{`.inp{width:100%;height:40px;padding:0 12px;border:1px solid #E8E8F1;border-radius:12px;outline:none;font-size:14px;background:#fff}.inp:focus{border-color:#7C3AED}`}</style>
    </div>
  );
}

function RiskSection({ settings, setSettings, savePrefs }) {
  const [state, run] = useSaveFeedback();
  return (
    <div className="tjfx-card p-6 space-y-4" data-testid="risk-section">
      <div>
        <h3 className="font-display text-lg font-bold">Trading Defaults</h3>
        <p className="text-sm text-[#6D6D82]">Used to size positions in Add Trade.</p>
      </div>
      <div className="max-w-xs">
        <Field label="Default Risk % per trade">
          <input type="number" step="0.1" value={settings.risk_percent ?? 1} onChange={e=>setSettings({...settings,risk_percent:parseFloat(e.target.value)||0})} className="inp" data-testid="risk-percent-input"/>
        </Field>
      </div>
      <SaveButton state={state} idleLabel="Save Trading Defaults" testId="save-risk" onClick={()=>run(async()=>{ await savePrefs(); toast.success("Trading defaults saved"); }).catch(()=>toast.error("Could not save — please try again."))}/>
    </div>
  );
}

function TimeSection({ settings, setSettings, savePrefs }) {
  const [state, run] = useSaveFeedback();
  return (
    <div className="tjfx-card p-6 space-y-4" data-testid="time-section">
      <div>
        <h3 className="font-display text-lg font-bold">Time</h3>
        <p className="text-sm text-[#6D6D82]">Controls how times are displayed in your exported Reports.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Report time format">
          <select value={settings.report_time_format||"12h"} onChange={e=>setSettings({...settings,report_time_format:e.target.value})} className="inp" data-testid="report-time-format-input">
            <option value="12h">12-hour (AM / PM)</option>
            <option value="24h">24-hour</option>
          </select>
        </Field>
        <Field label="Report timezone">
          <select value={settings.report_timezone||"Asia/Kolkata"} onChange={e=>setSettings({...settings,report_timezone:e.target.value})} className="inp" data-testid="report-timezone-input">
            <option value="Asia/Kolkata">India Standard Time (IST)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">New York (EST/EDT)</option>
            <option value="Europe/London">London (GMT/BST)</option>
          </select>
        </Field>
      </div>
      <SaveButton state={state} idleLabel="Save Time Settings" testId="save-time" onClick={()=>run(async()=>{ await savePrefs(); toast.success("Time settings saved"); }).catch(()=>toast.error("Could not save — please try again."))}/>
    </div>
  );
}

function AccountsSection({ settings, accounts, newAcc, setNewAcc, editAcc, setEditAcc, addAccount, delAcc, startEditAcc, saveEditAcc }) {
  const onPropFirmType = (t, setter, current) => {
    const preset = PROP_FIRM_PRESETS[t] || {};
    setter({
      ...current,
      propFirmType: t,
      maxDrawdown: current.maxDrawdown || (preset.maxDrawdown ?? ""),
      profitTarget: current.profitTarget || (preset.profitTarget ?? ""),
    });
  };
  const limitBadge = (a) => {
    const l = settings.account_limits?.[a.id];
    if (!l) return null;
    const parts = [];
    if (l.propFirmType) parts.push(l.propFirmType);
    if (l.maxDrawdown) parts.push(`Max DD ${l.maxDrawdown}%`);
    if (l.profitTarget) parts.push(`Target ${l.profitTarget}%`);
    if (l.daily) parts.push(`Daily limit $${l.daily}`);
    if (l.weekly) parts.push(`Weekly limit $${l.weekly}`);
    return parts.length ? <span className="ml-2 text-[#7C3AED]">{parts.join(" • ")}</span> : null;
  };
  return (
            <div className="tjfx-card p-6" data-testid="accounts-section">
              <h3 className="font-display text-lg font-bold mb-1">Trading Accounts</h3>
              <p className="text-xs text-[#6D6D82] mb-4">Optionally set Daily / Weekly Drawdown Limits per account — they'll show next to your actual drawdown in the sidebar.</p>
              <div className="grid md:grid-cols-6 gap-2 mb-2">
                <input value={newAcc.name} onChange={e=>setNewAcc({...newAcc,name:e.target.value})} placeholder="Account name" className="inp"/>
                <input value={newAcc.broker} onChange={e=>setNewAcc({...newAcc,broker:e.target.value})} placeholder="Broker" className="inp"/>
                <select value={newAcc.account_type} onChange={e=>setNewAcc({...newAcc,account_type:e.target.value})} className="inp">{["Live","Demo","Prop Firm"].map(x=><option key={x}>{x}</option>)}</select>
                <input type="number" value={newAcc.balance} onChange={e=>setNewAcc({...newAcc,balance:parseFloat(e.target.value)||0})} placeholder="Balance" className="inp"/>
                <input type="number" value={newAcc.dailyLimit} onChange={e=>setNewAcc({...newAcc,dailyLimit:e.target.value})} placeholder="Daily DD limit" className="inp"/>
                <input type="number" value={newAcc.weeklyLimit} onChange={e=>setNewAcc({...newAcc,weeklyLimit:e.target.value})} placeholder="Weekly DD limit" className="inp"/>
              </div>
              {newAcc.account_type === "Prop Firm" && (
                <div className="grid md:grid-cols-3 gap-2 mb-2 p-3 rounded-xl bg-[#F3E8FF]/40 border border-[#7C3AED]/20" data-testid="new-acc-prop-firm-fields">
                  <select value={newAcc.propFirmType} onChange={e=>onPropFirmType(e.target.value, setNewAcc, newAcc)} className="inp" data-testid="new-acc-prop-firm-type">
                    <option value="">Prop Firm Type</option>
                    {PROP_FIRM_TYPES.map(x=><option key={x} value={x}>{x}</option>)}
                  </select>
                  <input type="number" value={newAcc.maxDrawdown} onChange={e=>setNewAcc({...newAcc,maxDrawdown:e.target.value})} placeholder="Max Drawdown %" className="inp" data-testid="new-acc-max-dd"/>
                  <input type="number" value={newAcc.profitTarget} onChange={e=>setNewAcc({...newAcc,profitTarget:e.target.value})} placeholder="Profit Target %" className="inp" data-testid="new-acc-profit-target"/>
                </div>
              )}
              <button onClick={addAccount} className="h-10 px-5 mb-4 rounded-xl bg-[#7C3AED] text-white font-semibold">+ Add Account</button>
              <div className="space-y-2">
                {accounts.map(a => editAcc?.id === a.id ? (
                  <div key={a.id} className="p-3 rounded-xl border border-[#7C3AED] bg-[#F3E8FF]/30 space-y-2" data-testid={`account-edit-${a.id}`}>
                    <div className="grid md:grid-cols-6 gap-2">
                      <input value={editAcc.name} onChange={e=>setEditAcc({...editAcc,name:e.target.value})} placeholder="Account name" className="inp"/>
                      <input value={editAcc.broker} onChange={e=>setEditAcc({...editAcc,broker:e.target.value})} placeholder="Broker" className="inp"/>
                      <select value={editAcc.account_type} onChange={e=>setEditAcc({...editAcc,account_type:e.target.value})} className="inp">{["Live","Demo","Prop Firm"].map(x=><option key={x}>{x}</option>)}</select>
                      <input type="number" value={editAcc.balance} onChange={e=>setEditAcc({...editAcc,balance:e.target.value})} placeholder="Balance" className="inp"/>
                      <input type="number" value={editAcc.dailyLimit} onChange={e=>setEditAcc({...editAcc,dailyLimit:e.target.value})} placeholder="Daily DD limit" className="inp"/>
                      <input type="number" value={editAcc.weeklyLimit} onChange={e=>setEditAcc({...editAcc,weeklyLimit:e.target.value})} placeholder="Weekly DD limit" className="inp"/>
                    </div>
                    {editAcc.account_type === "Prop Firm" && (
                      <div className="grid md:grid-cols-3 gap-2 p-3 rounded-xl bg-[#F3E8FF]/40 border border-[#7C3AED]/20" data-testid={`account-edit-prop-firm-${a.id}`}>
                        <select value={editAcc.propFirmType} onChange={e=>onPropFirmType(e.target.value, setEditAcc, editAcc)} className="inp">
                          <option value="">Prop Firm Type</option>
                          {PROP_FIRM_TYPES.map(x=><option key={x} value={x}>{x}</option>)}
                        </select>
                        <input type="number" value={editAcc.maxDrawdown} onChange={e=>setEditAcc({...editAcc,maxDrawdown:e.target.value})} placeholder="Max Drawdown %" className="inp"/>
                        <input type="number" value={editAcc.profitTarget} onChange={e=>setEditAcc({...editAcc,profitTarget:e.target.value})} placeholder="Profit Target %" className="inp"/>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={saveEditAcc} className="h-9 px-4 rounded-lg bg-[#7C3AED] text-white text-sm font-semibold flex items-center gap-1.5"><Save className="w-3.5 h-3.5"/> Save</button>
                      <button onClick={()=>setEditAcc(null)} className="h-9 px-4 rounded-lg border border-[#E8E8F1] text-sm font-medium text-[#6D6D82]">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E8E8F1]" data-testid={`account-row-${a.id}`}>
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-[#6D6D82]">
                        {a.broker} • {a.account_type}
                        {limitBadge(a)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tjfx-mono">${a.balance?.toFixed(2)} {a.currency}</span>
                      <button onClick={()=>startEditAcc(a)} className="text-[#7C3AED]" data-testid={`account-edit-btn-${a.id}`}><Pencil className="w-4 h-4"/></button>
                      <button onClick={()=>delAcc(a.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
                {accounts.length===0 && <div className="text-sm text-[#6D6D82]">No accounts yet.</div>}
              </div>
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
    try {
      const created = await prefsApi.create(kind, val.trim());
      setItems(current => [...current, created]);
      setVal("");
      localStorage.removeItem("tjfx-preference-cache-v1");
      toast.success(`${label} added`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not add this item. Update and restart the backend, then try again.");
    }
  };
  const startEdit = (it) => setEdit({ id: it.id, val: it.value });
  const saveEdit = async () => {
    if (!edit.val.trim()) return;
    try {
      const updated = await prefsApi.update(kind, edit.id, edit.val.trim());
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
      localStorage.removeItem("tjfx-preference-cache-v1");
      setEdit({ id: null, val: "" });
      toast.success(`${label} updated`);
    } catch (error) { toast.error(error?.response?.data?.detail || "Could not update this item"); }
  };
  const del = async (id) => {
    try { await prefsApi.delete(kind, id); setItems(current => current.filter(item => item.id !== id)); localStorage.removeItem("tjfx-preference-cache-v1"); toast.success(`${label} deleted`); }
    catch (error) { toast.error(error?.response?.data?.detail || "Could not delete this item"); }
  };

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

// Sub-strategies belong to a parent strategy (e.g. "Liquidity Sweep + MSS" →
// PDL / PDH / PML / PMH / HTF POI / Session High). They're stored using the
// existing flat `preferences` table (kind="sub_strategy") with the parent
// baked into the value as "Parent::Child" — no schema change needed. In Add
// Trade, picking one combines with the base strategy into a single tag like
// "Liquidity Sweep + MSS - PDL".
function StrategySubPresetManager() {
  const [strategies, setStrategies] = useState([]);
  const [items, setItems] = useState([]);
  const [parent, setParent] = useState("");
  const [val, setVal] = useState("");
  const [edit, setEdit] = useState({ id: null, val: "" });

  const load = () => Promise.all([prefsApi.list("strategy"), prefsApi.list("sub_strategy")])
    .then(([s, sub]) => { setStrategies(s); setItems(sub); if (!parent && s[0]) setParent(s[0].value); })
    .catch(()=>{});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async () => {
    if (!parent || !val.trim()) return;
    try {
      const created = await prefsApi.create("sub_strategy", `${parent}::${val.trim()}`);
      setItems(current => [...current, created]);
      setVal("");
      localStorage.removeItem("tjfx-preference-cache-v1");
      toast.success("Sub-strategy added");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not add this item.");
    }
  };
  const startEdit = (it) => setEdit({ id: it.id, val: it.value.split("::").slice(1).join("::") });
  const saveEdit = async (it) => {
    if (!edit.val.trim()) return;
    try {
      const parentName = it.value.split("::")[0];
      const updated = await prefsApi.update("sub_strategy", edit.id, `${parentName}::${edit.val.trim()}`);
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
      localStorage.removeItem("tjfx-preference-cache-v1");
      setEdit({ id: null, val: "" });
      toast.success("Sub-strategy updated");
    } catch (error) { toast.error(error?.response?.data?.detail || "Could not update this item"); }
  };
  const del = async (id) => {
    try { await prefsApi.delete("sub_strategy", id); setItems(current => current.filter(item => item.id !== id)); localStorage.removeItem("tjfx-preference-cache-v1"); toast.success("Sub-strategy deleted"); }
    catch (error) { toast.error(error?.response?.data?.detail || "Could not delete this item"); }
  };

  const grouped = strategies.map(s => ({ strategy: s.value, subs: items.filter(it => it.value.split("::")[0] === s.value) }));

  return (
    <div className="tjfx-card p-6" data-testid="preset-sub_strategy">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-lg font-bold">Sub-strategies</h3>
        <span className="text-[11px] text-[#A1A1AA]">{items.length} items</span>
      </div>
      <p className="text-xs text-[#6D6D82] mb-4">Nested under a strategy — e.g. "Liquidity Sweep + MSS" → PDL, PDH, PML, PMH, HTF POI, Session High. Picking one in Add Trade combines it into a single tag.</p>
      <div className="flex gap-2 mb-4">
        <select value={parent} onChange={e=>setParent(e.target.value)} className="h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm bg-white" data-testid="sub-strategy-parent-select">
          {strategies.length===0 && <option value="">Add a strategy first</option>}
          {strategies.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
        </select>
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add sub-strategy (e.g. PDL)" className="flex-1 h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm" data-testid="sub-strategy-input"/>
        <button onClick={add} className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1"><Plus className="w-4 h-4"/> Add</button>
      </div>
      <div className="space-y-3">
        {grouped.filter(g => g.subs.length>0).map(g => (
          <div key={g.strategy}>
            <div className="text-[11px] font-semibold text-[#7C3AED] mb-1.5">{g.strategy}</div>
            <div className="flex flex-wrap gap-2">
              {g.subs.map(it => (
                edit.id===it.id ? (
                  <div key={it.id} className="flex items-center gap-1 h-8 rounded-full border border-[#7C3AED] bg-white px-2">
                    <input value={edit.val} onChange={e=>setEdit({...edit,val:e.target.value})} className="text-sm outline-none w-28"/>
                    <button onClick={()=>saveEdit(it)} className="text-emerald-600"><Check className="w-4 h-4"/></button>
                    <button onClick={()=>setEdit({id:null,val:""})} className="text-[#6D6D82]"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <div key={it.id} className="chip active flex items-center gap-1.5 pr-1">
                    <span>{it.value.split("::").slice(1).join("::")}</span>
                    <button onClick={()=>startEdit(it)} className="w-5 h-5 rounded-full hover:bg-white/60 flex items-center justify-center"><Pencil className="w-3 h-3"/></button>
                    <button onClick={()=>del(it.id)} className="w-5 h-5 rounded-full hover:bg-red-100 hover:text-red-600 flex items-center justify-center"><X className="w-3 h-3"/></button>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}
        {items.length===0 && <div className="text-sm text-[#6D6D82]">No sub-strategies yet.</div>}
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
  const [state, run] = useSaveFeedback();
  const save = () => run(async () => {
    await settingsApi.update({ display_name: name.trim() });
    await refresh();
    toast.success("Profile updated");
  }).catch(() => toast.error("Save failed"));
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
      <SaveButton state={state} idleLabel="Save Profile" testId="profile-save" onClick={save}/>
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
  const [motivation, setMotivation] = React.useState(user?.settings?.motivation || QUOTES[0]);
  const [state, run] = useSaveFeedback();
  const save = () => run(async () => {
    await settingsApi.update({ motivation: motivation.trim() });
    await refresh();
    toast.success("Motivation updated");
  }).catch(() => toast.error("Save failed"));
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
      <SaveButton state={state} idleLabel="Save Motivation" testId="motivation-save" onClick={save}/>
      <div className="pt-4 border-t border-[#E8E8F1]">
        <div className="text-sm text-[#6D6D82]">Theme: Light with purple accent. Dark mode coming soon.</div>
      </div>
    </div>
  );
}
