# Performance update

Changed files:

- `frontend/src/App.js` — route-level code splitting.
- `frontend/src/context/AccountContext.jsx` — wait for restored Supabase session before loading accounts.
- `frontend/src/pages/AddTrade.jsx` — optimistic trade row while the API save completes.
- `frontend/src/pages/TradeView.jsx` — reconcile the optimistic row and fetch screenshots only when one trade is opened.
- `frontend/src/lib/pendingTrade.js` — new helper used by the optimistic flow.
- `backend/server.py` — compact trade/dashboard queries and non-blocking Gemini calls.

## Required one-time Supabase step

Open **Supabase Dashboard -> SQL Editor -> New query**, paste the contents of
`SUPABASE_PERFORMANCE_INDEXES.sql`, and run it. The statements only create
indexes; they do not delete or modify existing data.

## Deployment

Keep all existing Render and frontend environment variables unchanged. Deploy
this code to the `PERFORMANCE-FIX` branch first, confirm login, a trade save,
trade screenshots and AI responses, then merge that branch into `main`.
