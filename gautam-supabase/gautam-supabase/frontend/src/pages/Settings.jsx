import React, { useEffect, useState } from "react";
import { settingsApi, accountsApi, prefsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, ChevronDown, CheckCircle2 } from "lucide-react";

const TABS = ["Profile", "Trade Presets", "Bias Presets"];

// ============================================================================
// PROP FIRM TYPES CONFIGURATION
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
// EDIT MODAL
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
      toast.error("Failed to load accounts");
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
              Create
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
                            <div>Step 1: DD {limits.step_1_daily_dd || "—"} / Max {limits.step_1_max_dd || "—"}</div>
                            <div>Step 2: DD {limits.step_2_daily_dd || "—"} / Max {limits.step_2_max_dd || "—"}</div>
                          </>
                        ) : type === "DEMO" || type === "LIVE" ? (
                          <div>Daily {limits.daily_dd || "—"} / Weekly {limits.weekly_dd || "—"}</div>
                        ) : (
                          <div>DD {limits.daily_dd || "—"} / Max {limits.max_dd || "—"}</div>
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
// SUPPORTING COMPONENTS
// ============================================================================

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[12px] font-medium text-[#6D6D82] mb-1.5">{label}</label>
    {children}
  </div>
);

// Main Settings Component
export default function Settings() {
  const { refresh, user } = useAuth();
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
          {tab === "Profile" && (
            <div className="space-y-5">
              <TradingAccounts settings={settings} />
            </div>
          )}

          {tab === "Trade Presets" && (
            <div className="tjfx-card p-6">
              <h3 className="font-display text-lg font-bold">Trade Presets</h3>
              <p className="text-sm text-[#6D6D82] mt-2">Coming soon...</p>
            </div>
          )}

          {tab === "Bias Presets" && (
            <div className="tjfx-card p-6">
              <h3 className="font-display text-lg font-bold">Bias Presets</h3>
              <p className="text-sm text-[#6D6D82] mt-2">Coming soon...</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .inp {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 1px solid #E8E8F1;
          border-radius: 12px;
          outline: none;
          font-size: 14px;
          background: #fff;
        }
        .inp:focus {
          border-color: #7C3AED;
        }
      `}</style>
    </div>
  );
}
