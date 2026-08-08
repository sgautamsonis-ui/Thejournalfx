# TheJournalFX — Supabase + Render + Vercel Deploy

Kya badla:
- MongoDB -> Supabase Postgres (backend/server.py ab `supabase-py` use karta hai, service-role key se, aur khud user_id filter karta hai — tumhare existing tables/RLS/storage policies ke saath compatible)
- Emergent auth broker -> Supabase Auth (Google OAuth), frontend `@supabase/supabase-js` se login karta hai, backend sirf access token verify karta hai
- `emergentintegrations` / Claude -> Google Gemini (`google-generativeai`, model `gemini-2.5-flash`)

## 1) Backend -> Render

1. Naya **Web Service** banao Render pe, is repo/folder se, root = `backend/`
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Environment variables (Render dashboard -> Environment):
   - `SUPABASE_URL` — Project Settings -> API -> Project URL
   - `SUPABASE_ANON_KEY` — Project Settings -> API -> anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings -> API -> service_role key (secret, sirf backend mein use karo, kabhi frontend mein nahi)
   - `GEMINI_API_KEY` — Google AI Studio se
   - `CORS_ORIGINS` — tumhara Vercel URL (jab tak Vercel deploy nahi hota, `*` rakh sakte ho temporarily)
5. Deploy hone ke baad backend URL milega, jaisे `https://thejournalfx-api.onrender.com`

## 2) Frontend -> Vercel

1. Vercel pe naya project, root = `frontend/`
2. Environment variables:
   - `REACT_APP_BACKEND_URL` = tumhara Render backend URL (no trailing slash)
   - `REACT_APP_SUPABASE_URL` = same Supabase project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = Supabase anon public key
3. Deploy karo, Vercel URL milega — usko wapas Render ke `CORS_ORIGINS` mein daal do aur redeploy karo.

## 3) Supabase Auth redirect URLs

Supabase Dashboard -> Authentication -> URL Configuration mein:
- Site URL: tumhara Vercel URL
- Redirect URLs: `https://<vercel-url>/dashboard`, `https://<vercel-url>/auth/callback`, aur local dev ke liye `http://localhost:3000/dashboard`

Google Cloud Console (OAuth client) mein authorized redirect URI already Supabase ka hoga (`https://<project>.supabase.co/auth/v1/callback`) — vo tumne already kiya hoga jab Supabase mein Google enable kiya.

## 4) Local run

Backend:
```
cd backend
cp .env.example .env   # fill in real values
pip install -r requirements.txt
uvicorn server:app --reload
```

Frontend:
```
cd frontend
cp .env.example .env   # fill in real values
yarn install   # or npm install
yarn start
```

## Notes
- Trade screenshots: frontend seedha Supabase Storage (`trade-screenshots` bucket) mein upload karega, jo URL milega wahi `trades.screenshots` array mein save hoga — backend ka isme koi role nahi, tumhari existing storage policies (select/insert/delete by `auth.uid()`) already sahi hain.
- Agar koi table missing column error de, `information_schema.columns` query dobara chala ke check karo — schema backend ke saath match hona chahiye.
