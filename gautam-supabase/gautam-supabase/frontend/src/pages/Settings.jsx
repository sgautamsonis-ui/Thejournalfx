import React, { useEffect, useState } from "react";
import { settingsApi, accountsApi, prefsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Check, X, Save, CheckCircle2, ChevronDown } from "lucide-react";

const TABS = ["Profile","Trade Presets","Bias Presets"];

// ============================================================================
// SAVE FEEDBACK HOOK
// ============================================================================
function useSaveFeedback() {
  const [state, setState] = useState("idle");
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

// ============================================================================
// PROP FIRM TYPES WITH STRUCTURES (INCLUDING LIVE)
// ============================================================================
const PROP_FIRM_TYPES = {
  DEMO: {
    label: "Demo",
    fields: ["daily_dd", "weekly_dd"],
    description: "Demo account - Daily DD + Weekly DD (NO profit target)"
  },
  LIVE: {
    label: "Live",
    fields: ["daily_dd", "weekly_dd"],
    description: "Live account - Daily DD + Weekly DD (NO profit target)"
  },
  INSTANT: {
    label: "Instant",
    fields: ["daily_dd", "max_dd", "profit_target"],
    description: "Instant challenge - Daily DD + Max DD + Profit Target"
  },
  ONE_STEP: {
    label: "1 Step",
    fields: ["daily_dd", "max_dd", "profit_target"],
    description: "1 Step challenge - Daily DD + Max DD + Profit Target"
  },
  TWO_STEP: {
    label: "2 Step",
    fields: ["step_1", "step_2"],
    description: "2 Step challenge - Two milestone goals"
  }
};

// ============================================================================
// AUTO-SAVE HOOK
// ============================================================================
function useAutoSave(initialData, onSave, debounceMs = 1000) {
  const [data, setData] = useState(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = React.useRef(null);

  const handleChange = (updates) => {
    const newData = { ...data, ...updates };
    setData(newData);
    setHasChanges(JSON.stringify(newData) !== JSON.stringify(initialData));
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (JSON.stringify(newData) !== JSON.stringify(initialData)) {
        setIsSaving(true);
        try {
          await onSave(newData);
          setHasChanges(false);
        } catch (error) {
          console.error("Save error:", error);
          toast.error("Save failed - will retry");
        }
        setIsSaving(false);
      }
    }, debounceMs);
  };

  return { data, setData, hasChanges, isSaving, handleChange };
}

// ============================================================================
// PROP FIRM TYPE SELECTOR (DROPDOWN)
// ============================================================================
function PropFirmTypeSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm font-medium flex items-center justify-between bg-white hover:bg-[#F9F9FF] disabled:opacity-50"
      >
        <span className="text-left">{value ? PROP_FIRM_TYPES[value]?.label : "Select type"}</span>
        <ChevronDown className="w-4 h-4 text-[#A1A1AA] flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E8E8F1] rounded-xl shadow-lg z-50">
          {Object.entries(PROP_FIRM_TYPES).map(([key, type]) => (
            <button
              key={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-[#F9F9FF] border-b border-[#E8E8F1] last:border-b-0 text-sm"
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-xs text-[#A1A1AA]">{type.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SINGLE STEP FIELDS (FOR DEMO, LIVE, INSTANT & 1 STEP)
// ============================================================================
function SingleStepFields({ data, onChange, propFirmType }) {
  const fields = PROP_FIRM_TYPES[propFirmType]?.fields || [];
  const isAccountType = propFirmType === "DEMO" || propFirmType === "LIVE";

  return (
    <div className="space-y-3 p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1]">
      <div className="text-xs font-semibold text-[#7C3AED] uppercase">
        {isAccountType ? "Daily & Weekly Limits (NO Profit Target)" : "Drawdown Limits & Profit Target"}
      </div>

      {fields.includes("daily_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Daily Drawdown Limit</label>
          <input
            type="text"
            placeholder={isAccountType ? "e.g., $150 or 2%" : "e.g., 4%"}
            value={data.daily_dd || ""}
            onChange={(e) => onChange({ daily_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">
            {isAccountType ? "Max loss allowed in one trading day" : "Max daily loss before trading stops"}
          </p>
        </div>
      )}

      {fields.includes("weekly_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Weekly Drawdown Limit</label>
          <input
            type="text"
            placeholder="e.g., $300 or 5%"
            value={data.weekly_dd || ""}
            onChange={(e) => onChange({ weekly_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Max loss allowed in one week (resets every Monday/Friday)</p>
        </div>
      )}

      {fields.includes("max_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Maximum Drawdown (Overall)</label>
          <input
            type="text"
            placeholder="e.g., 6%"
            value={data.max_dd || ""}
            onChange={(e) => onChange({ max_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Total account loss limit from start to finish</p>
        </div>
      )}

      {fields.includes("profit_target") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Profit Target (Goal)</label>
          <input
            type="text"
            placeholder="e.g., $8,000"
            value={data.profit_target || ""}
            onChange={(e) => onChange({ profit_target: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Profit you need to earn to complete/advance</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TWO-STEP FIELDS (ONLY FOR 2 STEP)
// ============================================================================
function TwoStepFields({ data, onChange }) {
  return (
    <div className="space-y-4">
      {/* STEP 1 */}
      <div className="p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1] space-y-3">
        <div className="text-xs font-semibold text-[#7C3AED] uppercase">Step 1️⃣</div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Daily Drawdown Limit</label>
          <input
            type="text"
            placeholder="e.g., 2%"
            value={data.step_1_daily_dd || ""}
            onChange={(e) => onChange({ step_1_daily_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Maximum Drawdown</label>
          <input
            type="text"
            placeholder="e.g., 5%"
            value={data.step_1_max_dd || ""}
            onChange={(e) => onChange({ step_1_max_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Step 1 Profit Target</label>
          <input
            type="text"
            placeholder="e.g., $8,000"
            value={data.step_1_profit_target || ""}
            onChange={(e) => onChange({ step_1_profit_target: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Earn this to unlock Step 2</p>
        </div>
      </div>

      {/* STEP 2 */}
      <div className="p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1] space-y-3">
        <div className="text-xs font-semibold text-[#7C3AED] uppercase">Step 2️⃣</div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Daily Drawdown Limit</label>
          <input
            type="text"
            placeholder="e.g., 2%"
            value={data.step_2_daily_dd || ""}
            onChange={(e) => onChange({ step_2_daily_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Maximum Drawdown</label>
          <input
            type="text"
            placeholder="e.g., 5%"
            value={data.step_2_max_dd || ""}
            onChange={(e) => onChange({ step_2_max_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Step 2 Profit Target</label>
          <input
            type="text"
            placeholder="e.g., $16,000"
            value={data.step_2_profit_target || ""}
            onChange={(e) => onChange({ step_2_profit_target: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Final goal to complete challenge</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EDIT ACCOUNT MODAL
// ============================================================================
function EditAccountModal({ account, settings, onSave, onCancel }) {
  const limits = settings?.account_limits?.[account.id] || {};
  const initialData = {
    name: account.name,
    broker: account.broker || "",
    balance: account.balance,
    prop_firm_type: limits.prop_firm_type || "",
    daily_dd: limits.daily_dd || "",
    weekly_dd: limits.weekly_dd || "",
    max_dd: limits.max_dd || "",
    profit_target: limits.profit_target || "",
    step_1_daily_dd: limits.step_1_daily_dd || "",
    step_1_max_dd: limits.step_1_max_dd || "",
    step_1_profit_target: limits.step_1_profit_target || "",
    step_2_daily_dd: limits.step_2_daily_dd || "",
    step_2_max_dd: limits.step_2_max_dd || "",
    step_2_profit_target: limits.step_2_profit_target || "",
  };

  const { data, hasChanges, isSaving, handleChange } = useAutoSave(
    initialData,
    async (newData) => {
      await onSave(account.id, newData);
    }
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <h2 className="font-display text-xl font-bold">Edit Account</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Account Name</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Broker</label>
            <input
              type="text"
              value={data.broker}
              onChange={(e) => handleChange({ broker: e.target.value })}
              placeholder="e.g., XAUBOT, Topstep"
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Account Balance</label>
            <input
              type="number"
              value={data.balance}
              onChange={(e) => handleChange({ balance: parseFloat(e.target.value) })}
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Account Type</label>
          <PropFirmTypeSelector
            value={data.prop_firm_type}
            onChange={(type) => handleChange({ prop_firm_type: type })}
          />
        </div>

        {data.prop_firm_type === "TWO_STEP" ? (
          <TwoStepFields data={data} onChange={handleChange} />
        ) : data.prop_firm_type ? (
          <SingleStepFields data={data} onChange={handleChange} propFirmType={data.prop_firm_type} />
        ) : (
          <div className="p-4 bg-[#F9F9FF] rounded-xl text-center text-sm text-[#A1A1AA]">
            Select an account type to see drawdown fields
          </div>
        )}

        <div className="pt-4 border-t border-[#E8E8F1] space-y-3">
          {isSaving && <div className="text-xs text-[#7C3AED] text-center">Saving...</div>}
          {hasChanges && !isSaving && (
            <div className="text-xs text-[#A1A1AA] text-center">Auto-saving changes...</div>
          )}
          {!hasChanges && !isSaving && (
            <div className="text-xs text-[#A1A1AA] text-center">✓ All changes saved</div>
          )}

          <button
            onClick={onCancel}
            className="w-full h-9 rounded-lg border border-[#E8E8F1] text-sm font-medium hover:bg-[#F9F9FF]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUPPORTING COMPONENTS
// ============================================================================

const Field = ({ label, children }) => (
  <div><label className="block text-[12px] font-medium text-[#6D6D82] mb-1.5">{label}</label>{children}</div>
);

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

function BiasPresetTabs() {
  const [sub, setSub] = useState("key_level_weekly");
  const BIAS_KINDS = [
    { kind: "key_level_weekly", label: "Weekly Key Levels" },
    { kind: "key_level_daily", label: "Daily Key Levels" },
  ];
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
      <PresetManager kind={active.kind} label={active.label} hint={`Preset names shown in Bias Center`}/>
    </div>
  );
}

function PresetManager({ kind, label, hint }) {
  const [items, setItems] = useState([]);
  const [val, setVal] = useState("");
  const [edit, setEdit] = useState({ id: null, val: "" });

  const load = () => prefsApi.list(kind).then(setItems).catch(()=>{});
  useEffect(() => { load(); }, [kind]);

  const add = async () => {
    if (!val.trim()) return;
    try {
      const created = await prefsApi.create(kind, val.trim());
      setItems(current => [...current, created]);
      setVal("");
      localStorage.removeItem("tjfx-preference-cache-v1");
      toast.success(`${label} added`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not add this item");
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

const PRESET_KINDS = [
  { kind: "strategy", label: "Strategies", hint: "Dropdown in Add Trade → Strategy" },
  { kind: "htf_poi_type", label: "HTF POI Types", hint: "Second dropdown in the HTF POI builder" },
  { kind: "htf_timeframe", label: "HTF Timeframes", hint: "First dropdown in the HTF POI builder" },
  { kind: "entry_confirmation_type", label: "Entry Confirmation Types", hint: "Second dropdown in the Entry Confirmation builder" },
  { kind: "entry_timeframe", label: "Entry Timeframes", hint: "First dropdown in the Entry Confirmation builder" },
  { kind: "mood", label: "Psychology Moods", hint: "Mood chips in Add Trade" },
  { kind: "setup_tag", label: "Tags", hint: "Optional setup tags in Add Trade" },
  { kind: "mistake", label: "Mistakes", hint: "Mistake tracker chips" },
  { kind: "strength", label: "Strengths", hint: "Strengths chips in Add Trade" },
  { kind: "session", label: "Sessions", hint: "Session dropdown" },
  { kind: "symbol", label: "Symbols", hint: "Symbol dropdown in Add Trade" },
];

const EMPTY_NEW_ACC = { name: "", broker: "", balance: 10000, currency: "USD" };

// ============================================================================
// MAIN SETTINGS COMPONENT
// ============================================================================
export default function Settings() {
  const { refresh } = useAuth();
  const [tab, setTab] = useState("Profile");
  const [settings, setSettings] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAcc, setNewAcc] = useState(EMPTY_NEW_ACC);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(()=>{});
    accountsApi.list().then(setAccounts).catch(()=>{});
  }, []);

  const savePrefs = async () => {
    const merged = await settingsApi.update(settings);
    setSettings(merged);
    await refresh();
  };

  const addAccount = async () => {
    if (!newAcc.name.trim()) {
      toast.error("Account name required");
      return;
    }

    try {
      const account = await accountsApi.create({
        name: newAcc.name,
        broker: newAcc.broker,
        balance: newAcc.balance,
      });

      setAccounts([...accounts, account]);
      setNewAcc(EMPTY_NEW_ACC);
      setShowAddForm(false);
      toast.success("Account added");
    } catch {
      toast.error("Failed to add account");
    }
  };

  const saveAccountLimits = async (accountId, data) => {
    try {
      const limits = { ...(settings?.account_limits || {}) };
      const clean = {};

      if (data.prop_firm_type) clean.prop_firm_type = data.prop_firm_type;
      if (data.daily_dd) clean.daily_dd = data.daily_dd;
      if (data.weekly_dd) clean.weekly_dd = data.weekly_dd;
      if (data.max_dd) clean.max_dd = data.max_dd;
      if (data.profit_target) clean.profit_target = data.profit_target;
      if (data.step_1_daily_dd) clean.step_1_daily_dd = data.step_1_daily_dd;
      if (data.step_1_max_dd) clean.step_1_max_dd = data.step_1_max_dd;
      if (data.step_1_profit_target) clean.step_1_profit_target = data.step_1_profit_target;
      if (data.step_2_daily_dd) clean.step_2_daily_dd = data.step_2_daily_dd;
      if (data.step_2_max_dd) clean.step_2_max_dd = data.step_2_max_dd;
      if (data.step_2_profit_target) clean.step_2_profit_target = data.step_2_profit_target;

      limits[accountId] = clean;
      const merged = await settingsApi.update({ account_limits: limits });
      setSettings(merged);
      await refresh();
      toast.success("Account settings saved");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save account settings");
      throw error;
    }
  };

  const deleteAccount = async (id) => {
    try {
      await accountsApi.delete(id);
      setAccounts(accounts.filter((a) => a.id !== id));
      toast.success("Account deleted");
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const editingAccount = accounts.find((a) => a.id === editingAccountId);

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
              <RiskSection settings={settings} setSettings={setSettings} savePrefs={savePrefs}/>
              <TimeSection settings={settings} setSettings={setSettings} savePrefs={savePrefs}/>
              <AppearanceTab/>

              {/* TRADING ACCOUNTS SECTION */}
              <div className="tjfx-card p-6 space-y-4">
                <div>
                  <h3 className="font-display text-lg font-bold">Trading Accounts</h3>
                  <p className="text-xs text-[#6D6D82] mt-1">Manage accounts and set prop firm challenge details. Auto-saves as you type.</p>
                </div>

                {showAddForm ? null : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Account
                  </button>
                )}

                {/* Add Account Form */}
                {showAddForm && (
                  <div className="p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1] space-y-3">
                    <input
                      type="text"
                      placeholder="Account Name *"
                      value={newAcc.name}
                      onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Broker (optional)"
                      value={newAcc.broker}
                      onChange={(e) => setNewAcc({ ...newAcc, broker: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Account Balance"
                      value={newAcc.balance}
                      onChange={(e) => setNewAcc({ ...newAcc, balance: parseFloat(e.target.value) })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addAccount}
                        className="flex-1 h-10 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold"
                      >
                        Create Account
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="flex-1 h-10 rounded-lg border border-[#E8E8F1] text-sm font-medium hover:bg-[#F9F9FF]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Accounts List */}
                <div className="space-y-2">
                  {accounts.length === 0 && !showAddForm ? (
                    <div className="text-sm text-[#6D6D82] p-4 text-center">No accounts yet</div>
                  ) : (
                    accounts.map((acc) => {
                      const limits = settings?.account_limits?.[acc.id] || {};
                      const propType = limits.prop_firm_type;
                      const propTypeLabel = propType ? PROP_FIRM_TYPES[propType]?.label : "Not set";

                      return (
                        <div
                          key={acc.id}
                          className="p-4 bg-white rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-sm">{acc.name}</div>
                              <div className="text-xs text-[#6D6D82] mt-1">
                                {acc.broker && `${acc.broker} • `}
                                Balance: ${acc.balance?.toLocaleString() || 0}
                                {propType && ` • Type: `}
                                {propType && <span className="text-[#7C3AED]">{propTypeLabel}</span>}
                              </div>
                              
                              {propType && (
                                <div className="text-xs text-[#A1A1AA] mt-2 space-y-1">
                                  {propType === "TWO_STEP" ? (
                                    <>
                                      <div>Step 1: DD {limits.step_1_daily_dd || "—"} / Max {limits.step_1_max_dd || "—"} / Target {limits.step_1_profit_target || "—"}</div>
                                      <div>Step 2: DD {limits.step_2_daily_dd || "—"} / Max {limits.step_2_max_dd || "—"} / Target {limits.step_2_profit_target || "—"}</div>
                                    </>
                                  ) : propType === "DEMO" || propType === "LIVE" ? (
                                    <div>Daily DD {limits.daily_dd || "—"} / Weekly DD {limits.weekly_dd || "—"}</div>
                                  ) : (
                                    <div>DD {limits.daily_dd || "—"} / Max {limits.max_dd || "—"} {limits.profit_target && `/ Target ${limits.profit_target}`}</div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => setEditingAccountId(acc.id)}
                                className="p-2 hover:bg-[#F9F9FF] rounded-lg"
                              >
                                <Pencil className="w-4 h-4 text-[#7C3AED]" />
                              </button>
                              <button
                                onClick={() => deleteAccount(acc.id)}
                                className="p-2 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
        </div>
      </div>

      {/* Edit Modal */}
      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          settings={settings}
          onSave={saveAccountLimits}
          onCancel={() => setEditingAccountId(null)}
        />
      )}

      <style>{`.inp{width:100%;height:40px;padding:0 12px;border:1px solid #E8E8F1;border-radius:12px;outline:none;font-size:14px;background:#fff}.inp:focus{border-color:#7C3AED}`}</style>
    </div>
  );
}
