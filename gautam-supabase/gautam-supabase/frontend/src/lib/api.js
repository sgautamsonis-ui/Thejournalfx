import axios from "axios";
import { supabase } from "@/lib/supabaseClient";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

// Keep the auth token in memory. Calling Supabase getSession for every API
// request becomes noticeable when a page loads several cards at once.
let accessToken = null;
let tokenReady = supabase.auth.getSession().then(({ data }) => {
  accessToken = data?.session?.access_token || null;
});
supabase.auth.onAuthStateChange((_event, session) => {
  accessToken = session?.access_token || null;
});

// Attach the current Supabase access token to every request without an extra
// storage/session lookup after the first request.
api.interceptors.request.use(async (config) => {
  await tokenReady;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ---------- In-memory GET cache (stale-while-revalidate) ----------
// Without this, every time you switch tabs (Dashboard -> Tracker -> Dashboard)
// the page refetches everything from scratch and sits on a loading spinner —
// even though nothing changed. Now: the first visit to a page fetches
// normally, but every visit after that in the same browser session shows the
// cached data instantly while quietly re-fetching in the background to keep
// it current for next time. Any create/update/delete call below invalidates
// the relevant cache entries immediately, so you never see stale data after
// your own edits.
const _cache = new Map();

function cacheKey(url, params) {
  return url + (params ? "?" + JSON.stringify(params) : "");
}

function cachedGet(url, config = {}) {
  const key = cacheKey(url, config.params);
  if (_cache.has(key)) {
    const cached = _cache.get(key);
    // Revalidate in the background for next time; don't block this render on it.
    api.get(url, config).then(r => _cache.set(key, r.data)).catch(() => {});
    return Promise.resolve({ data: cached });
  }
  return api.get(url, config).then(r => { _cache.set(key, r.data); return r; });
}

function invalidate(...prefixes) {
  for (const k of Array.from(_cache.keys())) {
    if (prefixes.some(p => k.startsWith(p))) _cache.delete(k);
  }
}

// Exposed in case a page wants to force a hard refresh (e.g. a manual "Refresh" button).
export const clearApiCache = () => _cache.clear();

export const authApi = {
  me: () => api.get("/auth/me").then(r => r.data),
  logout: () => { _cache.clear(); return supabase.auth.signOut(); },
  onboarding: (data) => api.post("/auth/onboarding", data).then(r => r.data),
};

export const tradesApi = {
  list: (account_id) => cachedGet("/trades", { params: account_id && account_id !== "all" ? { account_id } : {} }).then(r => r.data),
  get: (id) => api.get(`/trades/${id}`).then(r => r.data),
  create: (data) => api.post("/trades", data).then(r => { invalidate("/trades", "/stats", "/accounts"); return r.data; }),
  update: (id, data) => api.put(`/trades/${id}`, data).then(r => { invalidate("/trades", "/stats", "/accounts"); return r.data; }),
  delete: (id) => api.delete(`/trades/${id}`).then(r => { invalidate("/trades", "/stats", "/accounts"); return r.data; }),
};

export const uploadApi = {
  image: (dataUrl) => api.post("/uploads/image", { data_url: dataUrl }).then(r => r.data),
  deleteImage: (path) => api.delete("/uploads/image", { data: { path } }).then(r => r.data),
};

export const biasApi = {
  list: (type) => cachedGet("/bias", { params: type ? { type } : {} }).then(r => r.data),
  latest: (type) => cachedGet("/bias/latest", { params: { type } }).then(r => r.data),
  get: (id) => api.get(`/bias/${id}`).then(r => r.data),
  create: (data) => api.post("/bias", data).then(r => { invalidate("/bias"); return r.data; }),
  update: (id, data) => api.put(`/bias/${id}`, data).then(r => { invalidate("/bias"); return r.data; }),
  delete: (id) => api.delete(`/bias/${id}`).then(r => { invalidate("/bias"); return r.data; }),
};

export const tagsApi = {
  list: () => cachedGet("/tags").then(r => r.data),
  create: (data) => api.post("/tags", data).then(r => { invalidate("/tags"); return r.data; }),
  delete: (id) => api.delete(`/tags/${id}`).then(r => { invalidate("/tags"); return r.data; }),
};

export const accountsApi = {
  list: () => cachedGet("/accounts").then(r => r.data),
  create: (data) => api.post("/accounts", data).then(r => { invalidate("/accounts", "/stats", "/trades"); return r.data; }),
  update: (id, data) => api.put(`/accounts/${id}`, data).then(r => { invalidate("/accounts", "/stats", "/trades"); return r.data; }),
  delete: (id) => api.delete(`/accounts/${id}`).then(r => { invalidate("/accounts", "/stats", "/trades"); return r.data; }),
};

export const settingsApi = {
  get: () => cachedGet("/settings").then(r => r.data),
  update: (data) => api.put("/settings", data).then(r => { invalidate("/settings"); return r.data; }),
};

export const aiApi = {
  biasSummary: (data) => api.post("/ai/bias-summary", data).then(r => r.data),
  tradeReview: (data) => api.post("/ai/trade-review", data).then(r => r.data),
  psychology: (payload={}) => api.post("/ai/psychology-coach", payload).then(r => r.data),
  ruleAdherence: () => api.post("/ai/rule-adherence").then(r => r.data),
};

export const prefsApi = {
  list: (kind) => cachedGet(`/preferences/${kind}`).then(r => r.data),
  // Fetch several preference kinds in one round-trip (used by Add Trade's batched load).
  // Falls back to individual requests if the batch endpoint is ever unavailable,
  // so a backend that hasn't been redeployed yet still degrades gracefully instead of crashing the page.
  listMany: (kinds) => cachedGet("/preferences/batch", { params: { kinds: kinds.join(",") } })
    .then(r => r.data)
    .catch(() => Promise.all(kinds.map(k => api.get(`/preferences/${k}`).then(r => r.data).catch(() => [])))
      .then(lists => Object.fromEntries(kinds.map((k, i) => [k, lists[i]])))),
  create: (kind, value) => api.post(`/preferences/${kind}`, { value }).then(r => { invalidate("/preferences"); return r.data; }),
  update: (kind, id, value) => api.put(`/preferences/${kind}/${id}`, { value }).then(r => { invalidate("/preferences"); return r.data; }),
  delete: (kind, id) => api.delete(`/preferences/${kind}/${id}`).then(r => { invalidate("/preferences"); return r.data; }),
};

export const statsApi = {
  dashboard: (account_id) => cachedGet("/stats/dashboard", { params: account_id && account_id !== "all" ? { account_id } : {} }).then(r => r.data),
  discipline: () => cachedGet("/stats/discipline").then(r => r.data),
};

export const notebookApi = {
  list: (kind) => cachedGet("/notebook", { params: kind ? { kind } : {} }).then(r => r.data),
  create: (data) => api.post("/notebook", data).then(r => { invalidate("/notebook"); return r.data; }),
  update: (id, data) => api.put(`/notebook/${id}`, data).then(r => { invalidate("/notebook"); return r.data; }),
  delete: (id) => api.delete(`/notebook/${id}`).then(r => { invalidate("/notebook"); return r.data; }),
};
