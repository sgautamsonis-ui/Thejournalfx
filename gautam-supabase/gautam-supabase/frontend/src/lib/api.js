import axios from "axios";
import { supabase } from "@/lib/supabaseClient";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

// Attach the current Supabase access token to every request.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  me: () => api.get("/auth/me").then(r => r.data),
  logout: () => supabase.auth.signOut(),
  onboarding: (data) => api.post("/auth/onboarding", data).then(r => r.data),
};

export const tradesApi = {
  list: (account_id) => api.get("/trades", { params: account_id && account_id !== "all" ? { account_id } : {} }).then(r => r.data),
  get: (id) => api.get(`/trades/${id}`).then(r => r.data),
  create: (data) => api.post("/trades", data).then(r => r.data),
  update: (id, data) => api.put(`/trades/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/trades/${id}`).then(r => r.data),
};

export const biasApi = {
  list: (type) => api.get("/bias", { params: type ? { type } : {} }).then(r => r.data),
  latest: (type) => api.get("/bias/latest", { params: { type } }).then(r => r.data),
  create: (data) => api.post("/bias", data).then(r => r.data),
  update: (id, data) => api.put(`/bias/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/bias/${id}`).then(r => r.data),
};

export const tagsApi = {
  list: () => api.get("/tags").then(r => r.data),
  create: (data) => api.post("/tags", data).then(r => r.data),
  delete: (id) => api.delete(`/tags/${id}`).then(r => r.data),
};

export const accountsApi = {
  list: () => api.get("/accounts").then(r => r.data),
  create: (data) => api.post("/accounts", data).then(r => r.data),
  delete: (id) => api.delete(`/accounts/${id}`).then(r => r.data),
};

export const settingsApi = {
  get: () => api.get("/settings").then(r => r.data),
  update: (data) => api.put("/settings", data).then(r => r.data),
};

export const aiApi = {
  biasSummary: (data) => api.post("/ai/bias-summary", data).then(r => r.data),
  tradeReview: (data) => api.post("/ai/trade-review", data).then(r => r.data),
  psychology: (payload={}) => api.post("/ai/psychology-coach", payload).then(r => r.data),
  ruleAdherence: () => api.post("/ai/rule-adherence").then(r => r.data),
};

export const prefsApi = {
  list: (kind) => api.get(`/preferences/${kind}`).then(r => r.data),
  // Fetch several preference kinds in one round-trip (used by Add Trade's batched load).
  // Falls back to individual requests if the batch endpoint is ever unavailable,
  // so a backend that hasn't been redeployed yet still degrades gracefully instead of crashing the page.
  listMany: (kinds) => api.get("/preferences/batch", { params: { kinds: kinds.join(",") } })
    .then(r => r.data)
    .catch(() => Promise.all(kinds.map(k => api.get(`/preferences/${k}`).then(r => r.data).catch(() => [])))
      .then(lists => Object.fromEntries(kinds.map((k, i) => [k, lists[i]])))),
  create: (kind, value) => api.post(`/preferences/${kind}`, { value }).then(r => r.data),
  update: (kind, id, value) => api.put(`/preferences/${kind}/${id}`, { value }).then(r => r.data),
  delete: (kind, id) => api.delete(`/preferences/${kind}/${id}`).then(r => r.data),
};

export const statsApi = {
  dashboard: (account_id) => api.get("/stats/dashboard", { params: account_id && account_id !== "all" ? { account_id } : {} }).then(r => r.data),
  discipline: () => api.get("/stats/discipline").then(r => r.data),
};

export const notebookApi = {
  list: (kind) => api.get("/notebook", { params: kind ? { kind } : {} }).then(r => r.data),
  create: (data) => api.post("/notebook", data).then(r => r.data),
  update: (id, data) => api.put(`/notebook/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/notebook/${id}`).then(r => r.data),
};
