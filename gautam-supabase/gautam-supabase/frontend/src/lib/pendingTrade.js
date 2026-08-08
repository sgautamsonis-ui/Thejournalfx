// Short-lived handoff between Add Trade and Trade View. The row is visible
// immediately, then reconciled with the API response or removed on failure.
export const PENDING_TRADE_KEY = "tjfx.pendingTrade";

export function getPendingTrade() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_TRADE_KEY) || "null"); }
  catch { return null; }
}

export function setPendingTrade(trade) {
  sessionStorage.setItem(PENDING_TRADE_KEY, JSON.stringify(trade));
}

export function clearPendingTrade() {
  sessionStorage.removeItem(PENDING_TRADE_KEY);
}

export function notifyTradeSync(detail) {
  window.dispatchEvent(new CustomEvent("tjfx:trade-sync", { detail }));
}
