import React, { useEffect, useState } from "react";
import { settingsApi, accountsApi, prefsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Check, X, ChevronDown } from "lucide-react";

const TABS = ["Profile", "Trade Presets", "Bias Presets"];

// ============================================================================
// PROP FIRM TYPES
// ============================================================================
const PROP_FIRM_TYPES = {
  DEMO: {
    label: "Demo",
    fields: ["daily_dd", "weekly_dd"],
    description: "Demo account - Daily DD + Weekly DD"
  },
  LIVE: {
    label: "Live",
    fields: ["daily_dd", "weekly_dd"],
    description: "Live account - Daily DD + Weekly DD"
  },
  INSTANT: {
    label: "Instant",
    fields: ["daily_dd", "max_dd", "profit_target"],
    description: "Instant challenge"
  },
  ONE_STEP: {
    label: "1 Step",
    fields: ["daily_dd", "max_dd", "profit_target"],
    description: "1 Step challenge"
  },
  TWO_STEP: {
    label: "2 Step",
    fields: ["step_1", "step_2"],
    description: "2 Step challenge"
  }
};

const PRESET_KINDS = [
  { kind: "strategy", label: "Strategies", hint: "Dropdown in Add Trade → Strategy" },
  { kind: "htf_poi_type", label: "HTF POI Types", hint: "HTF POI builder" },
  { kind: "htf_timeframe", label: "HTF Timeframes", hint: "HTF POI builder" },
  { kind: "entry_confirmation_type", label: "Entry Confirmation Types", hint: "Entry Confirmation builder" },
  { kind: "entry_timeframe", label: "Entry Timeframes", hint: "Entry Confirmation builder" },
  { kind: "mood", label: "Psychology Moods", hint: "Mood chips in Add Trade" },
  { kind: "setup_tag", label: "Tags", hint: "Setup tags in Add Trade" },
  { kind: "mistake", label: "Mistakes", hint: "Mistake tracker chips" },
  { kind: "strength", label: "Strengths", hint: "Strengths chips in Add Trade" },
  { kind: "session", label: "Sessions", hint: "Session dropdown" },
  { kind: "symbol", label: "Symbols", hint: "Symbol dropdown in Add Trade" },
];

const BIAS_KINDS = [
  { kind: "key_level_weekly", label: "Weekly Key Levels", hint: "Preset names shown in Bias Center → Weekly tab" },
  { kind: "key_level_daily", label: "Daily Key Levels", hint: "Preset names shown in Bias Center → Daily tab" },
];

// ============================================================================
// PROP FIRM TYPE DROPDOWN
// ============================================================================
function PropFirmTypeSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm font-medium flex items-center justify-between bg-white hover:bg-[#F9F9FF]"
      >
        <span>{value ? PROP_FIRM_TYPES[value]?.label : "Select type"}</span>
        <ChevronDown className="w-4 h-4 text-[#A1A1AA]" />
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
              className="w-full text-left px-4 py-3 hover:bg-[#F9F9FF] border-b border-[#E8E8F1] last:border-b-0"
            >
              <div className="font-medium text-sm">{type.label}</div>
              <div className="text-xs text-[#A1A1AA]">{type.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SINGLE STEP FIELDS
// ============================================================================
function SingleStepFields({ data, onChange, propFirmType }) {
  const fields = PROP_FIRM_TYPES[propFirmType]?.fields || [];

  return (
    <div className="space-y-3 p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1]">
      {fields.includes("daily_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Daily Drawdown</label>
          <input
            type="text"
            placeholder="e.g., 2% or $150"
            value={data.daily_dd || ""}
            onChange={(e) => onChange({ daily_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
      )}

      {fields.includes("weekly_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Weekly Drawdown</label>
          <input
            type="text"
            placeholder="e.g., 5% or $300"
            value={data.weekly_dd || ""}
            onChange={(e) => onChange({ weekly_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
      )}

      {fields.includes("max_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Max Drawdown</label>
          <input
            type="text"
            placeholder="e.g., 6%"
            value={data.max_dd || ""}
            onChange={(e) => onChange({ max_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
      )}

      {fields.includes("profit_target") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Profit Target</label>
          <input
            type="text"
            placeholder="e.g., $8,000"
            value={data.profit_target || ""}
            onChange={(e) => onChange({ profit_target: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TWO-STEP FIELDS
// ============================================================================
function TwoStepFields({ data, onChange }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1] space-y-3">
        <div className="text-xs font-semibold text-[#7C3AED] uppercase">Step 1️⃣</div>
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Daily DD</label>
          <input
            type="text"
            placeholder="e.g., 4%"
            value={data.step_1_daily_dd || ""}
            onChange={(e) => onChange({ step_1_daily_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Max DD</label>
          <input
            type="text"
            placeholder="e.g., 6%"
            value={data.step_1_max_dd || ""}
            onChange={(e) => onChange({ step_1_max_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Profit Target</label>
          <input
            type="text"
            placeholder="e.g., $8,000"
            value={data.step_1_profit_target || ""}
            onChange={(e) => onChange({ step_1_profit_target: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
      </div>

      <div className="p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1] space-y-3">
        <div className="text-xs font-semibold text-[#7C3AED] uppercase">Step 2️⃣</div>
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Daily DD</label>
          <input
            type="text"
            placeholder="e.g., 4%"
            value={data.step_2_daily_dd || ""}
            onChange={(e) => onChange({ step_2_daily_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Max DD</label>
          <input
            type="text"
            placeholder="e.g., 6%"
            value={data.step_2_max_dd || ""}
            onChange={(e) => onChange({ step_2_max_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Profit Target</label>
          <input
            type="text"
            placeholder="e.g., $16,000"
            value={data.step_2_profit_target || ""}
            onChange={(e) => onChange({ step_2_profit_target: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
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
  const [formData, setFormData] = useState({
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
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(account.id, formData);
      toast.success("Account updated!");
      onCancel();
    } catch (error) {
      toast.error("Failed to save");
      console.error(error);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <h2 className="font-display text-xl font-bold">Edit Account</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Account Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Broker</label>
            <input
              type="text"
              value={formData.broker}
              onChange={(e) => handleChange({ broker: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
              placeholder="e.g., XAUBOT"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Balance</label>
            <input
              type="number"
              value={formData.balance}
              onChange={(e) => handleChange({ balance: parseFloat(e.target.value) })}
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Account Type</label>
          <PropFirmTypeSelector
            value={formData.prop_firm_type}
            onChange={(type) => handleChange({ prop_firm_type: type })}
          />
        </div>

        {formData.prop_firm_type === "TWO_STEP" ? (
          <TwoStepFields data={formData} onChange={handleChange} />
        ) : formData.prop_firm_type ? (
          <SingleStepFields data={formData} onChange={handleChange} propFirmType={formData.prop_firm_type} />
        ) : (
          <div className="p-4 bg-[#F9F9FF] rounded-xl text-center text-sm text-[#A1A1AA]">
            Select account type
          </div>
        )}

        <div className="pt-4 border-t border-[#E8E8F1] space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-10 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={onCancel}
            className="w-full h-10 rounded-lg border border-[#E8E8F1] text-sm font-medium hover:bg-[#F9F9FF]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TRADING ACCOUNTS SECTION
// ============================================================================
function TradingAccounts({ settings }) {
  const { refresh } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newAcc, setNewAcc] = useState({ name: "", broker: "", balance: 10000 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await accountsApi.list();
      setAccounts(data);
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
    setLoading(false);
  };

  const addAccount = async () => {
    if (!newAcc.name.trim()) {
      toast.error("Account name required");
      return;
    }
    try {
      const acc = await accountsApi.create(newAcc);
      setAccounts([...accounts, acc]);
      setNewAcc({ name: "", broker: "", balance: 10000 });
      setShowForm(false);
      toast.success("Account added");
      await refresh();
    } catch (error) {
      toast.error("Failed to add account");
      console.error(error);
    }
  };

  const saveAccount = async (id, data) => {
    try {
      const limits = { ...(settings?.account_limits || {}) };
      limits[id] = {};
      
      if (data.prop_firm_type) limits[id].prop_firm_type = data.prop_firm_type;
      if (data.daily_dd) limits[id].daily_dd = data.daily_dd;
      if (data.weekly_dd) limits[id].weekly_dd = data.weekly_dd;
      if (data.max_dd) limits[id].max_dd = data.max_dd;
      if (data.profit_target) limits[id].profit_target = data.profit_target;
      if (data.step_1_daily_dd) limits[id].step_1_daily_dd = data.step_1_daily_dd;
      if (data.step_1_max_dd) limits[id].step_1_max_dd = data.step_1_max_dd;
      if (data.step_1_profit_target) limits[id].step_1_profit_target = data.step_1_profit_target;
      if (data.step_2_daily_dd) limits[id].step_2_daily_dd = data.step_2_daily_dd;
      if (data.step_2_max_dd) limits[id].step_2_max_dd = data.step_2_max_dd;
      if (data.step_2_profit_target) limits[id].step_2_profit_target = data.step_2_profit_target;

      await settingsApi.update({ account_limits: limits });
      await refresh();
    } catch (error) {
      console.error("Save error:", error);
      throw error;
    }
  };

  const deleteAccount = async (id) => {
    try {
      await accountsApi.delete(id);
      setAccounts(accounts.filter(a => a.id !== id));
      toast.success("Account deleted");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const editingAccount = accounts.find(a => a.id === editingId);

  return (
    <div className="tjfx-card p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold">Trading Accounts</h3>
        <p className="text-xs text-[#6D6D82] mt-1">Manage accounts and prop firm settings</p>
      </div>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      )}

      {showForm && (
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
            placeholder="Balance"
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
              onClick={() => setShowForm(false)}
              className="flex-1 h-10 rounded-lg border border-[#E8E8F1] text-sm font-medium hover:bg-[#F9F9FF]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-[#999] text-center py-8">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="text-sm text-[#999] text-center py-8">No accounts yet</div>
        ) : (
          accounts.map(acc => {
            const limits = settings?.account_limits?.[acc.id] || {};
            const type = limits.prop_firm_type;
            const typeLabel = type ? PROP_FIRM_TYPES[type]?.label : "Not set";

            return (
              <div key={acc.id} className="p-4 bg-white rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{acc.name}</div>
                    <div className="text-xs text-[#6D6D82] mt-1">
                      {acc.broker && `${acc.broker} • `}
                      Balance: ${acc.balance?.toLocaleString()}
                      {type && ` • Type: `}
                      {type && <span className="text-[#7C3AED]">{typeLabel}</span>}
                    </div>
                    {type && (
                      <div className="text-xs text-[#A1A1AA] mt-2">
                        {type === "TWO_STEP" ? (
                          <>
                            <div>Step 1: DD {limits.step_1_daily_dd || "—"} / Max {limits.step_1_max_dd || "—"} / Target {limits.step_1_profit_target || "—"}</div>
                            <div>Step 2: DD {limits.step_2_daily_dd || "—"} / Max {limits.step_2_max_dd || "—"} / Target {limits.step_2_profit_target || "—"}</div>
                          </>
                        ) : type === "DEMO" || type === "LIVE" ? (
                          <div>Daily {limits.daily_dd || "—"} / Weekly {limits.weekly_dd || "—"}</div>
                        ) : (
                          <div>DD {limits.daily_dd || "—"} / Max {limits.max_dd || "—"} {limits.profit_target && `/ Target ${limits.profit_target}`}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setEditingId(acc.id)}
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

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          settings={settings}
          onSave={saveAccount}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// PROFILE TAB
// ============================================================================
function ProfileTab({ user, settings, onSettingsChange }) {
  const [name, setName] = React.useState(user?.settings?.display_name || user?.name || "");
  const { refresh } = useAuth();
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.update({ display_name: name.trim() });
      await refresh();
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Save failed");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="tjfx-card p-6 space-y-5">
        <div className="flex items-center gap-4">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-16 h-16 rounded-2xl border border-[#E8E8F1]" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#F3E8FF] flex items-center justify-center text-2xl font-bold text-[#7C3AED]">
              {(user?.name?.[0] || "T").toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-display text-xl font-bold">{user?.name}</div>
            <div className="text-sm text-[#6D6D82]">{user?.email}</div>
            <div className="text-[11px] text-[#A1A1AA] mt-1">Signed in with Google</div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Display Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
            placeholder="How would you like to be called?"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="h-10 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <TradingAccounts settings={settings} />
    </div>
  );
}

// ============================================================================
// PRESET MANAGER
// ============================================================================
function PresetManager({ kind, label, hint }) {
  const [items, setItems] = useState([]);
  const [val, setVal] = useState("");
  const [edit, setEdit] = useState({ id: null, val: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPresets();
  }, [kind]);

  const loadPresets = async () => {
    try {
      const data = await prefsApi.list(kind);
      setItems(data);
    } catch (error) {
      console.error("Error loading presets:", error);
    }
    setLoading(false);
  };

  const add = async () => {
    if (!val.trim()) return;
    try {
      const created = await prefsApi.create(kind, val.trim());
      setItems([...items, created]);
      setVal("");
      localStorage.removeItem("tjfx-preference-cache-v1");
      toast.success(`${label} added`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not add");
    }
  };

  const startEdit = (item) => setEdit({ id: item.id, val: item.value });

  const saveEdit = async () => {
    if (!edit.val.trim()) return;
    try {
      const updated = await prefsApi.update(kind, edit.id, edit.val.trim());
      setItems(items.map(item => (item.id === updated.id ? updated : item)));
      localStorage.removeItem("tjfx-preference-cache-v1");
      setEdit({ id: null, val: "" });
      toast.success(`${label} updated`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not update");
    }
  };

  const del = async (id) => {
    try {
      await prefsApi.delete(kind, id);
      setItems(items.filter(item => item.id !== id));
      localStorage.removeItem("tjfx-preference-cache-v1");
      toast.success(`${label} deleted`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not delete");
    }
  };

  return (
    <div className="tjfx-card p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-lg font-bold">{label}</h3>
        <span className="text-[11px] text-[#A1A1AA]">{items.length} items</span>
      </div>
      <p className="text-xs text-[#6D6D82] mb-4">{hint}</p>

      <div className="flex gap-2 mb-4">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`Add new ${label.toLowerCase().slice(0, -1)}`}
          className="flex-1 h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
        />
        <button
          onClick={add}
          className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {loading ? (
          <div className="text-sm text-[#999]">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[#6D6D82]">No items yet</div>
        ) : (
          items.map(item => (
            edit.id === item.id ? (
              <div key={item.id} className="flex items-center gap-1 h-8 rounded-full border border-[#7C3AED] bg-white px-2">
                <input
                  value={edit.val}
                  onChange={(e) => setEdit({ ...edit, val: e.target.value })}
                  className="text-sm outline-none w-32"
                />
                <button onClick={saveEdit} className="text-emerald-600">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEdit({ id: null, val: "" })} className="text-[#6D6D82]">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div key={item.id} className="chip active flex items-center gap-1.5 pr-1">
                <span>{item.value}</span>
                <button onClick={() => startEdit(item)} className="w-5 h-5 rounded-full hover:bg-white/60 flex items-center justify-center">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => del(item.id)} className="w-5 h-5 rounded-full hover:bg-red-100 hover:text-red-600 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BIAS PRESET TABS
// ============================================================================
function BiasPresetTabs() {
  const [sub, setSub] = useState("key_level_weekly");
  const active = BIAS_KINDS.find(k => k.kind === sub);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-[#F6F6FB] p-1 rounded-xl w-fit">
        {BIAS_KINDS.map(k => (
          <button
            key={k.kind}
            onClick={() => setSub(k.kind)}
            className={`px-4 h-9 text-sm rounded-lg font-medium ${
              sub === k.kind
                ? "bg-white shadow text-[#7C3AED]"
                : "text-[#6D6D82]"
            }`}
          >
            {k.label.replace(" Key Levels", "")}
          </button>
        ))}
      </div>
      <PresetManager kind={active.kind} label={active.label} hint={active.hint} />
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS COMPONENT
// ============================================================================
export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Profile");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-[1300px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <p className="text-[#6D6D82] mt-1 mb-6">Configure your preferences and trading accounts</p>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 md:col-span-3 tjfx-card p-3 h-fit">
          <div className="space-y-1">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium ${
                  tab === t
                    ? "bg-[#F3E8FF] text-[#7C3AED]"
                    : "hover:bg-[#F6F6FB] text-[#6D6D82]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-9 space-y-4">
          {tab === "Profile" && <ProfileTab user={user} settings={settings} onSettingsChange={setSettings} />}
          {tab === "Trade Presets" && (
            <div className="space-y-5">
              {PRESET_KINDS.map(k => (
                <PresetManager key={k.kind} kind={k.kind} label={k.label} hint={k.hint} />
              ))}
            </div>
          )}
          {tab === "Bias Presets" && <BiasPresetTabs />}
        </div>
      </div>
    </div>
  );
}
