// A short-lived handoff between Add Trade and Trade View. It makes a newly
// submitted row visible immediately, while the server request finishes.
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
