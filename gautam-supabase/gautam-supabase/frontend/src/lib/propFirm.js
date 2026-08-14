// Shared helpers for Prop Firm account limits.
// `limits` here is exactly what's saved at settings.account_limits[accountId]
// by the Settings page (see pages/Settings.jsx).

export const PROP_FIRM_TYPES = ["1 Step", "2 Step", "Instant", "Prop Firm Live"];

export const PROP_FIRM_PRESETS = {
  "1 Step": { maxDrawdown: 10, dailyDrawdown: 5, profitTarget: 8 },
  "2 Step": {
    step1: { maxDrawdown: 10, dailyDrawdown: 5, profitTarget: 8 },
    step2: { maxDrawdown: 10, dailyDrawdown: 5, profitTarget: 5 },
  },
  Instant: { maxDrawdown: 6, dailyDrawdown: 3 },
  "Prop Firm Live": { maxDrawdown: 10, dailyDrawdown: 5 },
};

/**
 * Returns the % fields (maxDrawdown, dailyDrawdown, profitTarget) that are
 * currently "live" for this account. For a 2 Step account this means
 * whichever step (1 or 2) is currently active in limits.currentStep — once
 * step 1 is passed, the account moves to step 2 and only step 2's numbers
 * are shown/enforced, matching how prop firms actually work (you get a new
 * account id for step 2 after passing step 1).
 */
export function getActivePropFirmPhase(limits) {
  if (!limits?.propFirmType) return null;

  if (limits.propFirmType === "2 Step") {
    const step = limits.currentStep === 2 ? 2 : 1;
    const data = (step === 2 ? limits.step2 : limits.step1) || {};
    return {
      maxDrawdown: data.maxDrawdown,
      dailyDrawdown: data.dailyDrawdown,
      profitTarget: data.profitTarget,
      step,
      stepLabel: `Step ${step} of 2`,
      hasTarget: true,
    };
  }

  return {
    maxDrawdown: limits.maxDrawdown,
    dailyDrawdown: limits.dailyDrawdown,
    profitTarget: limits.profitTarget,
    step: null,
    stepLabel: limits.propFirmType,
    // Instant & Prop Firm Live are already-funded accounts — no eval target.
    hasTarget: limits.propFirmType === "1 Step",
  };
}

/**
 * Converts a % based daily-drawdown limit into a $ amount using the
 * account's starting balance, falling back to the older flat-$ `daily`
 * field so existing Live/Demo accounts keep working unchanged.
 */
export function getEffectiveDailyDollarLimit(limits, account) {
  if (!limits) return null;
  if (limits.daily) return Number(limits.daily);
  const phase = getActivePropFirmPhase(limits);
  const base = account?.starting_balance ?? account?.balance;
  if (phase?.dailyDrawdown && base) {
    return (Number(phase.dailyDrawdown) / 100) * Number(base);
  }
  return null;
}
