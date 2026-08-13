import React, { useEffect, useState } from "react";
import { accountsApi, settingsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Check, X, ChevronDown } from "lucide-react";

// ============================================================================
// PROP FIRM TYPES WITH THEIR DD STRUCTURES
// ============================================================================
const PROP_FIRM_TYPES = {
  INSTANT: {
    label: "Instant",
    fields: ["daily_dd", "max_dd"],
    description: "Daily DD + Max Drawdown"
  },
  ONE_STEP: {
    label: "1 Step",
    fields: ["daily_dd", "max_dd", "profit_target"],
    description: "Daily DD + Max DD + Profit Target"
  },
  TWO_STEP: {
    label: "2 Step",
    fields: ["step_1", "step_2"],
    description: "Two milestone goals with separate limits"
  }
};

// ============================================================================
// AUTO-SAVE HOOK - Track unsaved changes
// ============================================================================
function useAutoSave(initialData, onSave, debounceMs = 1000) {
  const [data, setData] = useState(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = React.useRef(null);

  // Detect changes
  const handleChange = (updates) => {
    const newData = { ...data, ...updates };
    setData(newData);
    setHasChanges(JSON.stringify(newData) !== JSON.stringify(initialData));
    
    // Debounce auto-save
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (JSON.stringify(newData) !== JSON.stringify(initialData)) {
        setIsSaving(true);
        try {
          await onSave(newData);
          setHasChanges(false);
        } catch (error) {
          toast.error("Save failed - will retry");
        }
        setIsSaving(false);
      }
    }, debounceMs);
  };

  return { data, setData, hasChanges, isSaving, handleChange };
}

// ============================================================================
// PROP FIRM TYPE SELECTOR
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
        <span>{value ? PROP_FIRM_TYPES[value].label : "Select type"}</span>
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
// SINGLE STEP FIELDS (For INSTANT & 1 STEP)
// ============================================================================
function SingleStepFields({ data, onChange, propFirmType }) {
  const fields = PROP_FIRM_TYPES[propFirmType]?.fields || [];

  return (
    <div className="space-y-3 p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1]">
      <div className="text-xs font-semibold text-[#7C3AED] uppercase">Drawdown Limits & Target</div>

      {fields.includes("daily_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Daily Drawdown Limit</label>
          <input
            type="text"
            placeholder="e.g., 2%"
            value={data.daily_dd || ""}
            onChange={(e) => onChange({ daily_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Max daily loss before trading stops</p>
        </div>
      )}

      {fields.includes("max_dd") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Maximum Drawdown</label>
          <input
            type="text"
            placeholder="e.g., 5%"
            value={data.max_dd || ""}
            onChange={(e) => onChange({ max_dd: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Total account loss limit</p>
        </div>
      )}

      {fields.includes("profit_target") && (
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Profit Target</label>
          <input
            type="text"
            placeholder="e.g., $10,000"
            value={data.profit_target || ""}
            onChange={(e) => onChange({ profit_target: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
          />
          <p className="text-xs text-[#A1A1AA] mt-1">Goal to complete this step</p>
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
// EDIT ACCOUNT FORM
// ============================================================================
function EditAccountForm({ account, settings, onSave, onCancel }) {
  const limits = settings?.account_limits?.[account.id] || {};
  const initialData = {
    name: account.name,
    broker: account.broker || "",
    balance: account.balance,
    prop_firm_type: limits.prop_firm_type || "",
    daily_dd: limits.daily_dd || "",
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

        {/* Basic Info */}
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

        {/* Prop Firm Type Selector */}
        <div>
          <label className="block text-xs font-medium text-[#6D6D82] mb-1.5">Prop Firm Type</label>
          <PropFirmTypeSelector
            value={data.prop_firm_type}
            onChange={(type) => handleChange({ prop_firm_type: type })}
          />
        </div>

        {/* Dynamic Fields Based on Type */}
        {data.prop_firm_type === "TWO_STEP" ? (
          <TwoStepFields data={data} onChange={handleChange} />
        ) : data.prop_firm_type ? (
          <SingleStepFields data={data} onChange={handleChange} propFirmType={data.prop_firm_type} />
        ) : (
          <div className="p-4 bg-[#F9F9FF] rounded-xl text-center text-sm text-[#A1A1AA]">
            Select a prop firm type to see required fields
          </div>
        )}

        {/* Save Status + Buttons */}
        <div className="pt-4 border-t border-[#E8E8F1] space-y-3">
          {isSaving && <div className="text-xs text-[#7C3AED] text-center">Saving...</div>}
          {hasChanges && !isSaving && (
            <div className="text-xs text-[#A1A1AA] text-center">Auto-saving changes...</div>
          )}
          {!hasChanges && !isSaving && (
            <div className="text-xs text-[#A1A1AA] text-center">✓ All changes saved</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 h-9 rounded-lg border border-[#E8E8F1] text-sm font-medium hover:bg-[#F9F9FF]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TRADING ACCOUNTS COMPONENT
// ============================================================================
export default function TradingAccounts({ settings }) {
  const { refresh } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAcc, setNewAcc] = useState({
    name: "",
    broker: "",
    balance: 10000,
    prop_firm_type: "",
  });

  useEffect(() => {
    accountsApi.list().then(setAccounts).catch(() => {});
  }, []);

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
      setNewAcc({ name: "", broker: "", balance: 10000, prop_firm_type: "" });
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

      // Map fields to storage keys
      if (data.prop_firm_type) clean.prop_firm_type = data.prop_firm_type;
      if (data.daily_dd) clean.daily_dd = data.daily_dd;
      if (data.max_dd) clean.max_dd = data.max_dd;
      if (data.profit_target) clean.profit_target = data.profit_target;
      if (data.step_1_daily_dd) clean.step_1_daily_dd = data.step_1_daily_dd;
      if (data.step_1_max_dd) clean.step_1_max_dd = data.step_1_max_dd;
      if (data.step_1_profit_target) clean.step_1_profit_target = data.step_1_profit_target;
      if (data.step_2_daily_dd) clean.step_2_daily_dd = data.step_2_daily_dd;
      if (data.step_2_max_dd) clean.step_2_max_dd = data.step_2_max_dd;
      if (data.step_2_profit_target) clean.step_2_profit_target = data.step_2_profit_target;

      limits[accountId] = clean;
      await settingsApi.update({ account_limits: limits });
      await refresh();
    } catch (error) {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Trading Accounts</h3>
          <p className="text-xs text-[#6D6D82] mt-1">
            Set Daily/Weekly Drawdown limits and Prop Firm challenge details per account
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="h-10 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {/* Add Account Form */}
      {showAddForm && (
        <div className="p-4 bg-[#F9F9FF] rounded-xl border border-[#E8E8F1] space-y-3">
          <input
            type="text"
            placeholder="Account Name"
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
        {accounts.length === 0 ? (
          <div className="text-sm text-[#6D6D82] p-4 text-center">No accounts yet</div>
        ) : (
          accounts.map((acc) => {
            const limits = settings?.account_limits?.[acc.id] || {};
            const propType = limits.prop_firm_type;
            const propTypeLabel = propType ? PROP_FIRM_TYPES[propType]?.label : "Not set";

            return (
              <div
                key={acc.id}
                className="p-4 bg-white rounded-xl border border-[#E8E8F1] hover:border-[#7C3AED] transition flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-semibold text-sm">{acc.name}</div>
                  <div className="text-xs text-[#6D6D82] mt-1">
                    {acc.broker && `${acc.broker} • `}
                    Balance: ${acc.balance.toLocaleString()} • Type: <span className="text-[#7C3AED]">{propTypeLabel}</span>
                  </div>
                  {propType && (
                    <div className="text-xs text-[#A1A1AA] mt-2">
                      {propType === "TWO_STEP" && (
                        <>
                          Step 1: DD {limits.step_1_daily_dd || "—"} / Max {limits.step_1_max_dd || "—"} / Target {limits.step_1_profit_target || "—"}
                          <br />
                          Step 2: DD {limits.step_2_daily_dd || "—"} / Max {limits.step_2_max_dd || "—"} / Target {limits.step_2_profit_target || "—"}
                        </>
                      ) : (
                        <>
                          DD {limits.daily_dd || "—"} / Max {limits.max_dd || "—"} {limits.profit_target && `/ Target ${limits.profit_target}`}
                        </>
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
            );
          })
        )}
      </div>

      {/* Edit Modal */}
      {editingAccount && (
        <EditAccountForm
          account={editingAccount}
          settings={settings}
          onSave={saveAccountLimits}
          onCancel={() => setEditingAccountId(null)}
        />
      )}
    </div>
  );
}
