from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os, logging, uuid, asyncio, calendar, base64
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from supabase import create_client, Client
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Service-role client: full DB access, bypasses RLS. Backend enforces user_id
# filtering itself on every query below (same pattern the old Mongo code used).
sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
# Anon client: only used to validate a user's access token against Supabase Auth.
sb_auth: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="TheJournalFX API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {"currency": "USD", "risk_percent": 1.0, "timezone": "UTC", "markets": ["Forex", "Gold"]}


# ---------- Auth helpers ----------
async def get_current_user(request: Request) -> Dict[str, Any]:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        resp = sb_auth.auth.get_user(token)
        auth_user = resp.user
    except Exception:
        auth_user = None
    if not auth_user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = auth_user.id
    email = auth_user.email
    meta = auth_user.user_metadata or {}

    prof = sb.table("profiles").select("*").eq("user_id", user_id).limit(1).execute()
    if prof.data:
        profile = prof.data[0]
    else:
        # First login via Google -> auto-provision the profile row.
        profile = {
            "user_id": user_id,
            "name": meta.get("full_name") or meta.get("name") or email,
            "picture": meta.get("avatar_url") or meta.get("picture"),
            "onboarding_done": False,
            "settings": DEFAULT_SETTINGS,
        }
        sb.table("profiles").insert(profile).execute()

    profile["email"] = email
    profile.setdefault("settings", DEFAULT_SETTINGS)
    return profile


# ---------- Auth endpoints ----------
# NOTE: Google sign-in itself is handled entirely by Supabase Auth on the
# frontend (supabase.auth.signInWithOAuth). The backend just needs the
# resulting access token on every request (Authorization: Bearer <token>).

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api_router.post("/auth/onboarding")
async def onboarding(payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    merged = {**(user.get("settings") or {}), **payload}
    sb.table("profiles").update({"onboarding_done": True, "settings": merged}).eq("user_id", user["user_id"]).execute()
    updated = sb.table("profiles").select("*").eq("user_id", user["user_id"]).limit(1).execute()
    row = updated.data[0]
    row["email"] = user.get("email")
    return row

# ---------- Settings ----------
@api_router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    return user.get("settings", {})

@api_router.put("/settings")
async def update_settings(payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    merged = {**(user.get("settings") or {}), **payload}
    sb.table("profiles").update({"settings": merged}).eq("user_id", user["user_id"]).execute()
    return merged

# ---------- Accounts ----------
class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    broker: Optional[str] = ""
    account_type: str = "Live"
    currency: str = "USD"
    balance: float = 10000.0
    starting_balance: float = 10000.0
    is_active: bool = True

@api_router.get("/accounts")
async def list_accounts(user=Depends(get_current_user)):
    r = sb.table("accounts").select("*").eq("user_id", user["user_id"]).execute()
    return [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

@api_router.post("/accounts")
async def create_account(acc: Account, user=Depends(get_current_user)):
    doc = acc.model_dump()
    doc["user_id"] = user["user_id"]
    if not doc.get("starting_balance"):
        doc["starting_balance"] = doc.get("balance", 0.0)
    sb.table("accounts").insert(doc).execute()
    doc.pop("user_id", None)
    return doc

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    broker: Optional[str] = None
    account_type: Optional[str] = None
    currency: Optional[str] = None
    balance: Optional[float] = None

@api_router.put("/accounts/{account_id}")
async def update_account(account_id: str, payload: AccountUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        sb.table("accounts").update(updates).eq("id", account_id).eq("user_id", user["user_id"]).execute()
    row = sb.table("accounts").select("*").eq("id", account_id).eq("user_id", user["user_id"]).limit(1).execute()
    if not row.data:
        return {"ok": False}
    doc = row.data[0]
    doc.pop("user_id", None)
    return doc

@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user=Depends(get_current_user)):
    sb.table("accounts").delete().eq("id", account_id).eq("user_id", user["user_id"]).execute()
    return {"ok": True}

# ---------- Trades ----------
async def apply_pnl_to_account(user_id: str, account_id: Optional[str], delta: float):
    if not account_id or not delta:
        return
    row = sb.table("accounts").select("balance").eq("id", account_id).eq("user_id", user_id).limit(1).execute()
    if not row.data:
        return
    new_balance = float(row.data[0].get("balance") or 0) + float(delta)
    sb.table("accounts").update({"balance": new_balance}).eq("id", account_id).eq("user_id", user_id).execute()

class Trade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: Optional[str] = None
    symbol: str
    direction: str
    order_type: str = "Market"
    entry_price: float
    exit_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    lot_size: float = 1.0
    risk_percent: float = 1.0
    commission: float = 0.0
    swap: float = 0.0
    net_pnl: Optional[float] = None
    r_multiple: Optional[float] = None
    session: Optional[str] = "London"
    strategy: Optional[str] = ""
    status: str = "closed"
    date: str
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    htf_poi: List[str] = []
    entry_tags: List[str] = []
    setup_tags: List[str] = []
    mood_before: List[str] = []
    mood_after: List[str] = []
    mistakes: List[str] = []
    strengths: List[str] = []
    rating: int = 0
    notes: str = ""
    screenshots: List[str] = []

@api_router.get("/trades")
async def list_trades(account_id: Optional[str] = None, user=Depends(get_current_user)):
    q = sb.table("trades").select("*").eq("user_id", user["user_id"])
    if account_id and account_id != "all":
        q = q.eq("account_id", account_id)
    r = q.order("date", desc=True).execute()
    return [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

@api_router.get("/trades/{trade_id}")
async def get_trade(trade_id: str, user=Depends(get_current_user)):
    r = sb.table("trades").select("*").eq("id", trade_id).eq("user_id", user["user_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    doc = r.data[0]
    doc.pop("user_id", None)
    return doc

@api_router.post("/trades")
async def create_trade(trade: Trade, user=Depends(get_current_user)):
    doc = trade.model_dump()
    doc["user_id"] = user["user_id"]
    sb.table("trades").insert(doc).execute()
    if doc.get("status") == "closed" and doc.get("net_pnl") is not None:
        await apply_pnl_to_account(user["user_id"], doc.get("account_id"), doc.get("net_pnl") or 0)
    doc.pop("user_id", None)
    return doc

@api_router.put("/trades/{trade_id}")
async def update_trade(trade_id: str, payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    payload.pop("user_id", None); payload.pop("id", None)
    existing_r = sb.table("trades").select("*").eq("id", trade_id).eq("user_id", user["user_id"]).limit(1).execute()
    if not existing_r.data:
        raise HTTPException(404, "Not found")
    existing = existing_r.data[0]

    def effective(t):
        if (t.get("status") == "closed") and (t.get("net_pnl") is not None):
            return float(t.get("net_pnl") or 0)
        return 0.0

    new_state = {**existing, **payload}
    old_acc = existing.get("account_id")
    new_acc = new_state.get("account_id")
    if old_acc != new_acc:
        if effective(existing):
            await apply_pnl_to_account(user["user_id"], old_acc, -effective(existing))
        if effective(new_state):
            await apply_pnl_to_account(user["user_id"], new_acc, effective(new_state))
    else:
        delta = effective(new_state) - effective(existing)
        await apply_pnl_to_account(user["user_id"], new_acc, delta)

    sb.table("trades").update(payload).eq("id", trade_id).eq("user_id", user["user_id"]).execute()
    doc = sb.table("trades").select("*").eq("id", trade_id).eq("user_id", user["user_id"]).limit(1).execute().data[0]
    doc.pop("user_id", None)
    return doc

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, user=Depends(get_current_user)):
    existing_r = sb.table("trades").select("*").eq("id", trade_id).eq("user_id", user["user_id"]).limit(1).execute()
    if existing_r.data:
        existing = existing_r.data[0]
        if existing.get("status") == "closed" and existing.get("net_pnl") is not None:
            await apply_pnl_to_account(user["user_id"], existing.get("account_id"), -(existing.get("net_pnl") or 0))
    sb.table("trades").delete().eq("id", trade_id).eq("user_id", user["user_id"]).execute()
    return {"ok": True}

# ---------- Bias ----------
class Bias(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    date: str
    direction: str = "neutral"
    confidence: int = 50
    narrative: str = ""
    poi_tags: List[str] = []
    setup_tags: List[str] = []
    key_levels: List[Dict[str, Any]] = []
    targets: List[Dict[str, Any]] = []
    invalidation: Optional[float] = None
    session: Optional[str] = None
    notes: List[str] = []
    images: List[str] = []
    ai_summary: Optional[str] = None
    ai_confidence: Optional[int] = None

@api_router.get("/bias")
async def list_bias(type: Optional[str] = None, user=Depends(get_current_user)):
    q = sb.table("bias").select("*").eq("user_id", user["user_id"])
    if type:
        q = q.eq("type", type)
    r = q.order("date", desc=True).execute()
    return [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

@api_router.get("/bias/latest")
async def latest_bias(type: str, user=Depends(get_current_user)):
    r = sb.table("bias").select("*").eq("user_id", user["user_id"]).eq("type", type).order("date", desc=True).limit(1).execute()
    if not r.data:
        return None
    doc = r.data[0]
    doc.pop("user_id", None)
    return doc

@api_router.post("/bias")
async def create_bias(b: Bias, user=Depends(get_current_user)):
    doc = b.model_dump()
    doc["user_id"] = user["user_id"]
    # Safety net: one bias per user+type+period(date). If a record already exists
    # for this exact period, update it instead of inserting a duplicate — this
    # guards against stale/out-of-sync frontend state creating extra entries.
    existing = sb.table("bias").select("id").eq("user_id", user["user_id"]).eq("type", doc["type"]).eq("date", doc["date"]).limit(1).execute()
    if existing.data:
        existing_id = existing.data[0]["id"]
        update_doc = {k: v for k, v in doc.items() if k not in ("id", "user_id")}
        sb.table("bias").update(update_doc).eq("id", existing_id).eq("user_id", user["user_id"]).execute()
        r = sb.table("bias").select("*").eq("id", existing_id).eq("user_id", user["user_id"]).limit(1).execute()
        result = r.data[0]
        result.pop("user_id", None)
        return result
    sb.table("bias").insert(doc).execute()
    doc.pop("user_id", None)
    return doc

@api_router.put("/bias/{bias_id}")
async def update_bias(bias_id: str, payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    payload.pop("user_id", None); payload.pop("id", None)
    sb.table("bias").update(payload).eq("id", bias_id).eq("user_id", user["user_id"]).execute()
    r = sb.table("bias").select("*").eq("id", bias_id).eq("user_id", user["user_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    doc = r.data[0]
    doc.pop("user_id", None)
    return doc

@api_router.delete("/bias/{bias_id}")
async def delete_bias(bias_id: str, user=Depends(get_current_user)):
    sb.table("bias").delete().eq("id", bias_id).eq("user_id", user["user_id"]).execute()
    return {"ok": True}

# ---------- Preferences (user-managed dropdowns) ----------
DEFAULT_PREFS = {
    "strategy": ["MSS + FVG","BOS + OB","Judas Swing","Silver Bullet","Turtle Soup","Liquidity Sweep + MSS","IFVG Reversal","OB Retest"],
    "htf_poi": ["Weekly Demand","Weekly Supply","Weekly OB","Weekly FVG","Daily Demand","Daily Supply","Daily OB","Daily FVG","H4 OB","H4 FVG","Liquidity Sweep","Premium","Discount"],
    "entry_tag": ["MSS","BOS","CHOCH","FVG","IFVG","Order Block","Breaker","Displacement","Equal Highs","Equal Lows","SMT"],
    "mood": ["Focused","Calm","Confident","Patient","FOMO","Greedy","Frustrated","Fearful","Neutral","Revenge","Tired"],
    "mistake": ["Moved SL","Entered Early","Entered Late","Ignored Bias","No MSS","Over Risk","Revenge","FOMO","Overtrading","Wrong Session","Closed Early"],
    "strength": ["Followed Plan","Waited Patiently","Good Risk Mgmt","Perfect Entry","Great Exit","Bias Aligned","Rule Compliance","Excellent RR"],
    "session": ["Asian","London","New York","Overlap"],
    "symbol": ["XAUUSD","EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","NZDUSD","USDCAD","EURJPY","GBPJPY","BTCUSD","ETHUSD","US30","NAS100","SPX500"],
    "key_level_weekly": ["Previous Week High (PWH)","Previous Week Low (PWL)","Weekly Open","Weekly Mid (EQ)","Weekly FVG High","Weekly FVG Low","Weekly OB High","Weekly OB Low","Monthly High","Monthly Low","BSL (Buy-Side Liquidity)","SSL (Sell-Side Liquidity)"],
    "key_level_daily": ["Previous Day High (PDH)","Previous Day Low (PDL)","Daily Open","Asia High","Asia Low","London High","London Low","NY High","NY Low","EQH (Equal High)","EQL (Equal Low)","Daily FVG High","Daily FVG Low","Daily OB High","Daily OB Low"],
    # Used by the Add Trade HTF POI / Entry Confirmation builders and Settings > Trade Presets.
    "htf_poi_type": ["Bullish OB","Bearish OB","Bullish FVG","Bearish FVG","Demand","Supply","Liquidity","Breaker","IFVG"],
    "htf_timeframe": ["Monthly","Weekly","Daily","4H","1H"],
    "entry_confirmation_type": ["MSS","BOS","CHOCH","FVG","IFVG","SMT","Breaker","Displacement","Order Block","Equal High","Equal Low"],
    "entry_timeframe": ["4H","1H","15M","5M","1M"],
    "setup_tag": ["Breakout","Reversal","Continuation","News Play","Scalp"],
}
VALID_KINDS = set(DEFAULT_PREFS.keys())

# In-process memory of which (user_id, kind) pairs are already known to be
# seeded. Seeding only ever needs to happen once per user per kind, so after
# the first successful check we skip the extra existence-check query on every
# later request. This is safe to lose on a backend restart (worst case it just
# re-checks once), and it removes ~half of the DB round trips preferences
# calls were making.
_SEEDED_CACHE: set = set()

def _ensure_prefs_seeded_sync(user_id: str, kind: str):
    cache_key = (user_id, kind)
    if cache_key in _SEEDED_CACHE:
        return
    existing = sb.table("preferences").select("id").eq("user_id", user_id).eq("kind", kind).execute()
    if not existing.data:
        rows = [{"id": str(uuid.uuid4()), "user_id": user_id, "kind": kind, "value": v, "order": i}
                for i, v in enumerate(DEFAULT_PREFS.get(kind, []))]
        if rows:
            sb.table("preferences").insert(rows).execute()
    _SEEDED_CACHE.add(cache_key)

async def ensure_prefs_seeded(user_id: str, kind: str):
    # The Supabase client here is synchronous, so run it off the event loop
    # thread to avoid blocking other requests while this one waits on the DB.
    await asyncio.to_thread(_ensure_prefs_seeded_sync, user_id, kind)

def _fetch_pref_kind_sync(user_id: str, kind: str):
    if kind not in VALID_KINDS:
        return kind, []
    _ensure_prefs_seeded_sync(user_id, kind)
    r = sb.table("preferences").select("*").eq("user_id", user_id).eq("kind", kind).order("order").execute()
    return kind, [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

async def _fetch_pref_kind(user_id: str, kind: str):
    # Each kind's DB round trip runs in its own thread, so N kinds cost
    # roughly one round trip's worth of wall-clock time instead of N.
    return await asyncio.to_thread(_fetch_pref_kind_sync, user_id, kind)

@api_router.get("/preferences/batch")
async def list_prefs_batch(kinds: str, user=Depends(get_current_user)):
    """Fetch multiple preference kinds in a single request (used by the
    batched/cached preference loads on Add Trade, Trade View, Bias Center,
    Psychology, and Records). `kinds` is a comma-separated list.
    All kinds are fetched concurrently instead of one-by-one, so a page that
    needs 10 kinds pays for one round trip's worth of latency, not ten.
    Unknown kinds come back as an empty list instead of erroring out, so one
    bad/renamed kind can't break the whole batch."""
    kind_list = [k.strip() for k in kinds.split(",") if k.strip()]
    pairs = await asyncio.gather(*[_fetch_pref_kind(user["user_id"], kind) for kind in kind_list])
    return dict(pairs)

@api_router.get("/preferences/{kind}")
async def list_prefs(kind: str, user=Depends(get_current_user)):
    if kind not in VALID_KINDS:
        raise HTTPException(400, "Invalid kind")
    await ensure_prefs_seeded(user["user_id"], kind)
    r = sb.table("preferences").select("*").eq("user_id", user["user_id"]).eq("kind", kind).order("order").execute()
    return [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

@api_router.post("/preferences/{kind}")
async def create_pref(kind: str, payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    if kind not in VALID_KINDS:
        raise HTTPException(400, "Invalid kind")
    value = (payload.get("value") or "").strip()
    if not value:
        raise HTTPException(400, "Value required")
    count_r = sb.table("preferences").select("id").eq("user_id", user["user_id"]).eq("kind", kind).execute()
    item = {"id": str(uuid.uuid4()), "user_id": user["user_id"], "kind": kind, "value": value, "order": len(count_r.data)}
    sb.table("preferences").insert(item).execute()
    item.pop("user_id", None)
    return item

@api_router.put("/preferences/{kind}/{pref_id}")
async def update_pref(kind: str, pref_id: str, payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    upd = {}
    if "value" in payload: upd["value"] = (payload["value"] or "").strip()
    if "order" in payload: upd["order"] = int(payload["order"])
    if upd:
        sb.table("preferences").update(upd).eq("id", pref_id).eq("user_id", user["user_id"]).eq("kind", kind).execute()
    r = sb.table("preferences").select("*").eq("id", pref_id).eq("user_id", user["user_id"]).eq("kind", kind).limit(1).execute()
    if not r.data:
        return None
    doc = r.data[0]
    doc.pop("user_id", None)
    return doc

@api_router.delete("/preferences/{kind}/{pref_id}")
async def delete_pref(kind: str, pref_id: str, user=Depends(get_current_user)):
    sb.table("preferences").delete().eq("id", pref_id).eq("user_id", user["user_id"]).eq("kind", kind).execute()
    return {"ok": True}

# ---------- Setup Tags ----------
DEFAULT_TAGS = [
    {"name": "MSS", "category": "Market Structure", "color": "purple"},
    {"name": "CHOCH", "category": "Market Structure", "color": "purple"},
    {"name": "BOS", "category": "Market Structure", "color": "purple"},
    {"name": "FVG", "category": "Entry", "color": "blue"},
    {"name": "IFVG", "category": "Entry", "color": "blue"},
    {"name": "Order Block", "category": "Entry", "color": "blue"},
    {"name": "Breaker", "category": "Entry", "color": "blue"},
    {"name": "Liquidity Sweep", "category": "Liquidity", "color": "orange"},
    {"name": "SMT Divergence", "category": "Liquidity", "color": "orange"},
    {"name": "Judas Swing", "category": "Execution", "color": "green"},
    {"name": "Silver Bullet", "category": "Execution", "color": "green"},
    {"name": "London Killzone", "category": "Execution", "color": "green"},
    {"name": "NY Killzone", "category": "Execution", "color": "green"},
    {"name": "Premium", "category": "Market Structure", "color": "pink"},
    {"name": "Discount", "category": "Market Structure", "color": "pink"},
]

@api_router.get("/tags")
async def get_tags(user=Depends(get_current_user)):
    r = sb.table("tags").select("*").eq("user_id", user["user_id"]).execute()
    if not r.data:
        seeded = [{"id": str(uuid.uuid4()), "user_id": user["user_id"], "enabled": True, **t} for t in DEFAULT_TAGS]
        sb.table("tags").insert(seeded).execute()
        return [{k: v for k, v in d.items() if k != "user_id"} for d in seeded]
    return [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

@api_router.post("/tags")
async def create_tag(payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    item = {"id": str(uuid.uuid4()), "user_id": user["user_id"], "enabled": True, **payload}
    sb.table("tags").insert(item).execute()
    item.pop("user_id", None)
    return item

@api_router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: str, user=Depends(get_current_user)):
    sb.table("tags").delete().eq("id", tag_id).eq("user_id", user["user_id"]).execute()
    return {"ok": True}

# ---------- AI (Google Gemini) ----------
# House style for every AI feature in the app: Roman Hindi (Hinglish), short bullet
# points only, never a wall of English paragraph text. Trading terms (FVG, POI,
# liquidity, displacement, MSS, etc.) stay in English since that's how the trader
# actually thinks in them — only the connecting words are Hindi.
HINGLISH_POINTS_SYSTEM = (
    "Tum ek expert ICT/SMC trading coach ho. HAMESHA Roman Hindi (Hinglish) mein jawab do — "
    "trading terms (FVG, POI, liquidity, displacement, MSS, OB, BSL/SSL, etc.) English mein hi "
    "rakhna, baaki sentence Hindi mein likhna. KABHI paragraph mat likho — hamesha short bullet "
    "points (each point starting with '- ') mein likho, ek point ek chhoti line. Koi markdown "
    "bold (**) use mat karo, sirf plain bullet points aur simple headers."
)

def _data_url_to_gemini_part(data_url: str):
    """Turn a stored `data:image/...;base64,XXXX` screenshot into a Gemini image part.
    Returns None (and is skipped) if the string isn't a valid data URL."""
    try:
        header, b64data = data_url.split(",", 1)
        mime = header.split(":")[1].split(";")[0] if ":" in header else "image/png"
        return {"mime_type": mime, "data": base64.b64decode(b64data)}
    except Exception:
        return None

# Cap how many screenshots get sent to Gemini per call. Sending all 15 possible
# chart images every time is what makes "AI Summary" feel slow — 6 recent, full-size
# charts is plenty of visual context and keeps the round-trip fast.
MAX_AI_IMAGES = 6

async def call_ai(prompt: str, system: str = HINGLISH_POINTS_SYSTEM, images: Optional[List[str]] = None) -> str:
    if not GEMINI_API_KEY:
        return "AI unavailable: GEMINI_API_KEY is not configured on the server."
    try:
        model = genai.GenerativeModel("gemini-3.6-flash", system_instruction=system)
        parts: List[Any] = [prompt]
        for img in (images or [])[:MAX_AI_IMAGES]:
            part = _data_url_to_gemini_part(img)
            if part:
                parts.append(part)
        resp = model.generate_content(parts)
        return (resp.text or "").strip()
    except Exception as e:
        logger.exception("AI error")
        return f"AI unavailable right now: {e}"

@api_router.post("/ai/bias-summary")
async def ai_bias_summary(payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    images = payload.get("images", []) or []
    narrative = (payload.get("narrative") or "").strip()
    prompt = f"""Yeh trader ka {payload.get('type','weekly')} bias hai. Pehle neeche attach kiye gaye chart \
screenshots (HTF / POI / key-level charts) ko dekho aur analyze karo.

Bias Data:
- Direction: {payload.get('direction')}
- Confidence: {payload.get('confidence')}%
- Session: {payload.get('session','')}
- POI Tags: {', '.join(payload.get('poi_tags',[])) or 'none'}
- Key Levels: {payload.get('key_levels',[])}
- Targets: {payload.get('targets',[])}

Trader ka apna likha hua market narrative (SIRF background context ke liye hai — ISKO SUMMARIZE \
YA DOBARA WORD MEIN MAT LIKHNA, wo already saved hai apni jagah):
\"\"\"{narrative or '(khaali — sirf charts se judge karo)'}\"\"\"

Ab do sections mein jawab do, dono bullet points ('- ') mein:

Chart Summary
(screenshots mein jo dikh raha hai — structure, liquidity, POIs — uska summary, 4-6 points)

Mera View
(tumhara khud ka analysis is bias par + agla step kya hona chahiye — 3-5 points, last point ek focus tip ho)"""
    text = await call_ai(prompt, images=images)
    return {"summary": text}

@api_router.post("/ai/trade-review")
async def ai_trade_review(payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    prompt = f"""Review this trade briefly:
Symbol: {payload.get('symbol')}, Direction: {payload.get('direction')}
Entry: {payload.get('entry_price')}, Exit: {payload.get('exit_price')}, SL: {payload.get('stop_loss')}, TP: {payload.get('take_profit')}
Net P&L: {payload.get('net_pnl')}, Strategy: {payload.get('strategy','')}
HTF POI: {payload.get('htf_poi',[])}, Entry Tags: {payload.get('entry_tags',[])}
Mistakes: {payload.get('mistakes',[])}, Strengths: {payload.get('strengths',[])}
Give: 1) Summary  2) Strengths  3) Weaknesses  4) One suggestion. Max 120 words."""
    text = await call_ai(prompt)
    return {"review": text}

@api_router.post("/ai/psychology-coach")
async def ai_psychology(payload: Dict[str, Any] = Body(default={}), user=Depends(get_current_user)):
    r = sb.table("trades").select("*").eq("user_id", user["user_id"]).order("date", desc=True).limit(300).execute()
    trades_all = [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]
    filters = (payload or {})

    def passes(t):
        if filters.get("sessions") and t.get("session") not in filters["sessions"]: return False
        if filters.get("strategies") and t.get("strategy") not in filters["strategies"]: return False
        if filters.get("moods"):
            m = set((t.get("mood_before") or []) + (t.get("mood_after") or []))
            if not m & set(filters["moods"]): return False
        if filters.get("days"):
            try:
                dow = datetime.strptime(t.get("date", "1970-01-01"), "%Y-%m-%d").strftime("%A")
                if dow not in filters["days"]: return False
            except Exception:
                return False
        if filters.get("symbols") and t.get("symbol") not in filters["symbols"]: return False
        if filters.get("date_from") and (t.get("date", "") < filters["date_from"]): return False
        if filters.get("date_to") and (t.get("date", "") > filters["date_to"]): return False
        return True

    trades = [t for t in trades_all if passes(t)]
    win = sum(1 for t in trades if (t.get("net_pnl") or 0) > 0)
    total = len(trades)
    wr = round((win/total)*100, 1) if total else 0
    pnl_sum = round(sum((t.get("net_pnl") or 0) for t in trades), 2)
    mistakes = {}
    for t in trades:
        for m in (t.get("mistakes") or []):
            mistakes[m] = mistakes.get(m, 0) + 1
    top_mistakes = sorted(mistakes.items(), key=lambda x: -x[1])[:5]

    def group_stats(key_fn):
        agg = {}
        for t in trades:
            k = key_fn(t)
            if not k: continue
            v = agg.setdefault(k, {"pnl": 0.0, "wins": 0, "total": 0})
            v["pnl"] += (t.get("net_pnl") or 0)
            v["total"] += 1
            if (t.get("net_pnl") or 0) > 0: v["wins"] += 1
        return [{"key": k, "pnl": round(v["pnl"], 2), "trades": v["total"], "wr": round(v["wins"]/v["total"]*100, 1) if v["total"] else 0} for k, v in agg.items()]

    by_session = sorted(group_stats(lambda t: t.get("session")), key=lambda x: -x["pnl"])
    by_strategy = sorted(group_stats(lambda t: t.get("strategy")), key=lambda x: -x["pnl"])
    by_symbol = sorted(group_stats(lambda t: t.get("symbol")), key=lambda x: -x["pnl"])

    def dow(t):
        try:
            return datetime.strptime(t.get("date", "1970-01-01"), "%Y-%m-%d").strftime("%A")
        except Exception:
            return None
    by_day = sorted(group_stats(dow), key=lambda x: -x["pnl"])

    def mood_key(t):
        mb = t.get("mood_before") or []
        return mb[0] if mb else None
    by_mood = sorted(group_stats(mood_key), key=lambda x: -x["pnl"])

    question = (payload.get("question") or "").strip()
    if question:
        prompt = f"""User question: {question}

Data summary for {total} trades (win rate {wr}%, net P&L {pnl_sum}):
Sessions: {by_session[:5]}
Strategies: {by_strategy[:5]}
Symbols: {by_symbol[:5]}
Best days: {by_day[:5]}
Moods: {by_mood[:5]}
Top mistakes: {top_mistakes}

Answer the user's question directly using the data. Be specific and actionable. Under 160 words."""
    else:
        prompt = f"""Trader has {total} trades (win rate {wr}%, net {pnl_sum}).
Best sessions: {by_session[:3]}
Best strategies: {by_strategy[:3]}
Best/worst days: {by_day[:3]}
Top mistakes: {top_mistakes}
Best/worst moods: {by_mood[:3]}

Give a diagnostic:
1) Where the trader is winning (best session, day, strategy, mood).
2) Where the biggest leak is (worst dimension + top mistake).
3) One specific action for this week.
Keep under 160 words."""
    text = await call_ai(prompt)
    return {
        "insight": text, "win_rate": wr, "total": total, "pnl": pnl_sum,
        "top_mistakes": top_mistakes, "by_session": by_session, "by_strategy": by_strategy,
        "by_symbol": by_symbol, "by_day": by_day, "by_mood": by_mood,
    }

# ---------- Notebook (Rules, Lessons, Checklists) ----------
class NotebookEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str
    title: str
    body: Optional[str] = ""
    items: List[Dict[str, Any]] = []
    tags: List[str] = []
    pinned: bool = False

@api_router.get("/notebook")
async def list_notebook(kind: Optional[str] = None, user=Depends(get_current_user)):
    q = sb.table("notebook").select("*").eq("user_id", user["user_id"])
    if kind:
        q = q.eq("kind", kind)
    r = q.order("created_at", desc=True).execute()
    return [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

@api_router.post("/notebook")
async def create_notebook(entry: NotebookEntry, user=Depends(get_current_user)):
    doc = entry.model_dump()
    doc["user_id"] = user["user_id"]
    sb.table("notebook").insert(doc).execute()
    doc.pop("user_id", None)
    return doc

@api_router.put("/notebook/{entry_id}")
async def update_notebook(entry_id: str, payload: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    payload.pop("user_id", None); payload.pop("id", None)
    sb.table("notebook").update(payload).eq("id", entry_id).eq("user_id", user["user_id"]).execute()
    r = sb.table("notebook").select("*").eq("id", entry_id).eq("user_id", user["user_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    doc = r.data[0]
    doc.pop("user_id", None)
    return doc

@api_router.delete("/notebook/{entry_id}")
async def delete_notebook(entry_id: str, user=Depends(get_current_user)):
    sb.table("notebook").delete().eq("id", entry_id).eq("user_id", user["user_id"]).execute()
    return {"ok": True}

# ---------- Discipline Streak ----------
@api_router.get("/stats/discipline")
async def discipline_stats(user=Depends(get_current_user)):
    r = sb.table("trades").select("*").eq("user_id", user["user_id"]).order("date", desc=True).execute()
    trades = [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]
    settings = user.get("settings", {}) or {}
    max_risk = float(settings.get("risk_percent", 1.0))

    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for t in trades:
        by_date.setdefault(t.get("date", ""), []).append(t)

    def is_disciplined_day(day_trades):
        if not day_trades:
            return None
        for t in day_trades:
            if (t.get("mistakes") or []):
                return False
            if float(t.get("risk_percent", 0) or 0) > (max_risk + 0.001):
                return False
        return True

    dates_sorted = sorted(by_date.keys(), reverse=True)
    current_streak = 0
    for d in dates_sorted:
        ok = is_disciplined_day(by_date[d])
        if ok is True: current_streak += 1
        elif ok is False: break

    best = 0; run = 0
    for d in sorted(by_date.keys()):
        ok = is_disciplined_day(by_date[d])
        if ok is True:
            run += 1; best = max(best, run)
        elif ok is False:
            run = 0

    total_days = len([d for d in by_date if is_disciplined_day(by_date[d]) is not None])
    disciplined_days = len([d for d in by_date if is_disciplined_day(by_date[d]) is True])

    total_trades = len(trades)
    clean_trades = sum(1 for t in trades if not (t.get("mistakes") or []))
    rule_adherence = round((clean_trades/total_trades)*100, 1) if total_trades else 0

    from datetime import timedelta as _td
    today = datetime.now(timezone.utc).date()
    last7 = []
    for i in range(6, -1, -1):
        d = (today - _td(days=i)).isoformat()
        s = "none"
        if d in by_date:
            rr = is_disciplined_day(by_date[d])
            s = "good" if rr else "bad"
        last7.append({"date": d, "state": s})

    return {
        "current_streak": current_streak, "best_streak": best, "disciplined_days": disciplined_days,
        "total_trading_days": total_days, "rule_adherence": rule_adherence, "clean_trades": clean_trades,
        "total_trades": total_trades, "max_risk_setting": max_risk, "last7": last7,
    }

@api_router.post("/ai/rule-adherence")
async def ai_rule_adherence(user=Depends(get_current_user)):
    tr_r = sb.table("trades").select("*").eq("user_id", user["user_id"]).order("date", desc=True).limit(60).execute()
    trades = [{k: v for k, v in d.items() if k != "user_id"} for d in tr_r.data]
    ru_r = sb.table("notebook").select("*").eq("user_id", user["user_id"]).eq("kind", "rule").execute()
    rules = [{k: v for k, v in d.items() if k != "user_id"} for d in ru_r.data]

    rule_titles = [r["title"] for r in rules]
    followed_counts = {t: 0 for t in rule_titles}
    broken_counts = {t: 0 for t in rule_titles}
    losing_no_rules = 0
    for tr in trades:
        strengths = tr.get("strengths") or []
        pnl = tr.get("net_pnl") or 0
        for rt in rule_titles:
            if rt in strengths:
                followed_counts[rt] += 1
            elif tr.get("status") == "closed":
                broken_counts[rt] += 1
        if pnl < 0 and not any(r in strengths for r in rule_titles):
            losing_no_rules += 1

    top_broken = sorted(
        [(rt, broken_counts.get(rt, 0), followed_counts.get(rt, 0)) for rt in rule_titles],
        key=lambda x: -x[1]
    )[:5]

    prompt = f"""You are a trading discipline coach. Below is the trader's rule adherence data over the last {len(trades)} trades.

Rules and (times broken / times followed):
{chr(10).join([f"- {rt}: broken {br}, followed {fw}" for rt, br, fw in top_broken]) or 'No rules defined yet.'}

Losing trades where NO rule was followed: {losing_no_rules}

Task:
1. Identify the SINGLE most important rule to focus on next week.
2. Give a 2-line 'why this matters' reason tied to their data.
3. Give 3 quick daily habits to make this rule automatic.

Keep it under 120 words, punchy, motivational, no bullet numbering fluff."""

    text = await call_ai(prompt, system=HINGLISH_POINTS_SYSTEM + " Tum ek rigorous lekin supportive trading discipline coach ho.")
    return {
        "insight": text,
        "top_broken": [{"rule": rt, "broken": br, "followed": fw} for rt, br, fw in top_broken],
        "losing_no_rules": losing_no_rules,
        "total_trades_reviewed": len(trades),
        "total_rules": len(rule_titles),
    }

# ---------- Dashboard stats ----------
@api_router.get("/stats/dashboard")
async def dashboard_stats(account_id: Optional[str] = None, user=Depends(get_current_user)):
    q = sb.table("trades").select("*").eq("user_id", user["user_id"])
    if account_id and account_id != "all":
        q = q.eq("account_id", account_id)
    r = q.order("date").execute()
    trades = [{k: v for k, v in d.items() if k != "user_id"} for d in r.data]

    total = len(trades)
    closed = [t for t in trades if t.get("status") == "closed"]
    wins = [t for t in closed if (t.get("net_pnl") or 0) > 0]
    losses = [t for t in closed if (t.get("net_pnl") or 0) < 0]
    total_pnl = round(sum((t.get("net_pnl") or 0) for t in closed), 2)
    win_rate = round(len(wins)/len(closed)*100, 2) if closed else 0
    gross_win = sum((t.get("net_pnl") or 0) for t in wins)
    gross_loss = abs(sum((t.get("net_pnl") or 0) for t in losses)) or 1
    profit_factor = round(gross_win/gross_loss, 2) if gross_loss else 0
    avg_win = round(gross_win/len(wins), 2) if wins else 0
    avg_loss = round(-gross_loss/len(losses), 2) if losses else 0
    today = datetime.now(timezone.utc).date().isoformat()
    todays_trades = [t for t in closed if str(t.get("date", "")).startswith(today)]
    todays_pnl = round(sum((t.get("net_pnl") or 0) for t in todays_trades), 2)
    open_positions = sum(1 for t in trades if t.get("status") == "open")
    open_positions_list = [{k: v for k, v in t.items()} for t in trades if t.get("status") == "open"]

    equity = []
    running = 0
    for t in closed:
        running += (t.get("net_pnl") or 0)
        equity.append({"date": t.get("date"), "equity": round(running, 2)})
    peak = 0; max_dd = 0
    for pt in equity:
        peak = max(peak, pt["equity"])
        max_dd = min(max_dd, pt["equity"] - peak)

    by_day = defaultdict(float)
    for t in closed:
        by_day[t.get("date", "")] += (t.get("net_pnl") or 0)
    best_day = max(by_day.items(), key=lambda x: x[1]) if by_day else (None, 0)
    worst_day = min(by_day.items(), key=lambda x: x[1]) if by_day else (None, 0)
    daily_pnl = [{"date": d, "pnl": round(v, 2)} for d, v in sorted(by_day.items()) if d]

    by_session = defaultdict(lambda: {"pnl": 0, "wins": 0, "total": 0})
    for t in closed:
        s = t.get("session") or "—"
        by_session[s]["pnl"] += (t.get("net_pnl") or 0)
        by_session[s]["total"] += 1
        if (t.get("net_pnl") or 0) > 0:
            by_session[s]["wins"] += 1
    sessions_perf = [
        {"session": s, "pnl": round(v["pnl"], 2), "trades": v["total"], "win_rate": round(v["wins"]/v["total"]*100, 1) if v["total"] else 0}
        for s, v in by_session.items()
    ]
    sessions_perf.sort(key=lambda x: -x["pnl"])

    # Performance by hour of day (entry_time is stored as "HH:MM" local/IST time),
    # so a trader can see which hour of the day works best for them.
    by_hour = defaultdict(lambda: {"pnl": 0.0, "wins": 0, "total": 0})
    for t in closed:
        et = t.get("entry_time")
        if et and isinstance(et, str) and ":" in et:
            try:
                hr = int(et.split(":")[0]) % 24
            except ValueError:
                continue
            by_hour[hr]["pnl"] += (t.get("net_pnl") or 0)
            by_hour[hr]["total"] += 1
            if (t.get("net_pnl") or 0) > 0:
                by_hour[hr]["wins"] += 1
    hourly_performance = [
        {
            "hour": h, "label": f"{h:02d}:00",
            "pnl": round(v["pnl"], 2), "trades": v["total"],
            "win_rate": round(v["wins"] / v["total"] * 100, 1) if v["total"] else 0,
        }
        for h, v in sorted(by_hour.items())
    ]
    best_hour = max(hourly_performance, key=lambda x: x["pnl"]) if hourly_performance else None

    # Expectancy & average R
    win_prob = (len(wins) / len(closed)) if closed else 0
    loss_prob = (len(losses) / len(closed)) if closed else 0
    expectancy = round((win_prob * avg_win) + (loss_prob * avg_loss), 2)
    r_values = [t.get("r_multiple") for t in closed if t.get("r_multiple") is not None]
    avg_rr = round(sum(r_values) / len(r_values), 2) if r_values else 0

    # Daily candles (open/high/low/close of running equity, per day) — used for
    # the candlestick "Performance Overview" chart on the dashboard.
    equity_candles = []
    running_c = 0.0
    day_order = []
    day_map = {}
    for t in closed:
        d = t.get("date") or ""
        if d not in day_map:
            day_map[d] = {"open": running_c, "high": running_c, "low": running_c, "close": running_c, "trades": 0}
            day_order.append(d)
        running_c += (t.get("net_pnl") or 0)
        day_map[d]["close"] = running_c
        day_map[d]["high"] = max(day_map[d]["high"], running_c)
        day_map[d]["low"] = min(day_map[d]["low"], running_c)
        day_map[d]["trades"] += 1
    for d in day_order:
        v = day_map[d]
        equity_candles.append({
            "date": d, "open": round(v["open"], 2), "high": round(v["high"], 2),
            "low": round(v["low"], 2), "close": round(v["close"], 2), "trades": v["trades"],
        })

    # Daily / weekly drawdown (peak-to-trough of running equity, restricted to
    # today / the last 7 days) — surfaced in the sidebar so overtrading is visible fast.
    def drawdown_since(cutoff_date):
        pts = [pt["equity"] for pt in equity if str(pt["date"] or "") >= cutoff_date]
        if not pts:
            return 0.0
        peak_v = pts[0]
        dd = 0.0
        for v in pts:
            peak_v = max(peak_v, v)
            dd = min(dd, v - peak_v)
        return round(dd, 2)

    today_dt = datetime.now(timezone.utc).date()
    week_start = (today_dt - timedelta(days=today_dt.weekday())).isoformat()
    daily_drawdown = drawdown_since(today)
    weekly_drawdown = drawdown_since(week_start)

    # Monthly / weekly / daily performance buckets (for the "Performance Chart" widget)
    def bucket_key(date_str, mode):
        try:
            dt = datetime.fromisoformat(str(date_str)[:10])
        except ValueError:
            return str(date_str)
        if mode == "daily":
            return dt.strftime("%d %b")
        if mode == "weekly":
            wk = dt - timedelta(days=dt.weekday())
            return wk.strftime("%d %b")
        return dt.strftime("%b %Y")

    monthly_performance = []
    for mode in ("monthly",):
        buckets = defaultdict(float)
        for t in closed:
            buckets[bucket_key(t.get("date"), mode)] += (t.get("net_pnl") or 0)
        monthly_performance = [{"period": k, "pnl": round(v, 2)} for k, v in buckets.items()]

    # Strategy performance
    by_strategy = defaultdict(lambda: {"pnl": 0.0, "wins": 0, "total": 0, "gross_win": 0.0, "gross_loss": 0.0})
    for t in closed:
        s = t.get("strategy") or "Unnamed"
        d = by_strategy[s]
        pnl = t.get("net_pnl") or 0
        d["pnl"] += pnl
        d["total"] += 1
        if pnl > 0:
            d["wins"] += 1
            d["gross_win"] += pnl
        elif pnl < 0:
            d["gross_loss"] += abs(pnl)
    strategies = [
        {
            "id": s, "name": s, "trades": v["total"], "pnl": round(v["pnl"], 2),
            "win_rate": round(v["wins"] / v["total"] * 100, 1) if v["total"] else 0,
            "profit_factor": round(v["gross_win"] / v["gross_loss"], 2) if v["gross_loss"] else (v["gross_win"] and 999 or 0),
        }
        for s, v in by_strategy.items()
    ]
    strategies.sort(key=lambda x: -x["pnl"])

    # Long vs short direction stats
    longs = [t for t in closed if t.get("direction") == "long"]
    shorts = [t for t in closed if t.get("direction") == "short"]
    def dir_stats(lst):
        w = [t for t in lst if (t.get("net_pnl") or 0) > 0]
        return {
            "count": len(lst),
            "pnl": round(sum((t.get("net_pnl") or 0) for t in lst), 2),
            "wr": round(len(w) / len(lst) * 100, 1) if lst else 0,
        }
    ls, ss = dir_stats(longs), dir_stats(shorts)
    direction_stats = {
        "long_count": ls["count"], "long_pnl": ls["pnl"], "long_wr": ls["wr"],
        "short_count": ss["count"], "short_pnl": ss["pnl"], "short_wr": ss["wr"],
    } if closed else None

    # Win rate trend (rolling win rate as trades accumulate, sampled per day)
    winrate_trend = []
    running_wins = 0
    running_total = 0
    for i, t in enumerate(closed):
        running_total += 1
        if (t.get("net_pnl") or 0) > 0:
            running_wins += 1
        winrate_trend.append({"date": t.get("date"), "winrate": round(running_wins / running_total * 100, 1)})

    # P&L distribution buckets
    def pnl_bucket(v):
        if v <= -200: return "< -$200"
        if v <= -50: return "-$200 to -$50"
        if v < 0: return "-$50 to $0"
        if v == 0: return "$0"
        if v <= 50: return "$0 to $50"
        if v <= 200: return "$50 to $200"
        return "> $200"
    bucket_order = ["< -$200", "-$200 to -$50", "-$50 to $0", "$0", "$0 to $50", "$50 to $200", "> $200"]
    pnl_buckets = defaultdict(int)
    for t in closed:
        pnl_buckets[pnl_bucket(t.get("net_pnl") or 0)] += 1
    pnl_distribution = [{"range": b, "count": pnl_buckets[b]} for b in bucket_order if pnl_buckets[b] > 0]

    # Streaks
    current_streak = 0
    best_win_streak = 0
    worst_loss_streak = 0
    cur_win_run = 0
    cur_loss_run = 0
    for t in closed:
        pnl = t.get("net_pnl") or 0
        if pnl > 0:
            cur_win_run += 1
            cur_loss_run = 0
            best_win_streak = max(best_win_streak, cur_win_run)
        elif pnl < 0:
            cur_loss_run += 1
            cur_win_run = 0
            worst_loss_streak = max(worst_loss_streak, cur_loss_run)
        else:
            cur_win_run = 0
            cur_loss_run = 0
    current_winning_streak = cur_win_run
    current_losing_streak = cur_loss_run

    # Mood vs performance
    mood_map = defaultdict(lambda: {"pnl": 0.0, "count": 0, "wins": 0, "r_sum": 0.0, "r_count": 0})
    for t in closed:
        moods = set((t.get("mood_before") or []) + (t.get("mood_after") or []))
        pnl = t.get("net_pnl") or 0
        for m in moods:
            d = mood_map[m]
            d["pnl"] += pnl
            d["count"] += 1
            if pnl > 0: d["wins"] += 1
            if t.get("r_multiple") is not None:
                d["r_sum"] += t["r_multiple"]; d["r_count"] += 1
    mood_analytics = [
        {
            "mood": m, "count": v["count"], "avg_pnl": round(v["pnl"] / v["count"], 2) if v["count"] else 0,
            "wr": round(v["wins"] / v["count"] * 100, 1) if v["count"] else 0,
            "avg_r": round(v["r_sum"] / v["r_count"], 2) if v["r_count"] else 0,
        }
        for m, v in mood_map.items()
    ]
    mood_analytics.sort(key=lambda x: -x["avg_pnl"])

    # Trading calendar (current month, EVERY day 1..last-day so the grid always
    # renders — days without trades just show as neutral cells)
    cal_map = defaultdict(lambda: {"pnl": 0.0, "trades": 0})
    for t in closed:
        d = str(t.get("date") or "")[:10]
        if d:
            cal_map[d]["pnl"] += (t.get("net_pnl") or 0)
            cal_map[d]["trades"] += 1
    year_, month_ = today_dt.year, today_dt.month
    days_in_month = calendar.monthrange(year_, month_)[1]
    calendar_days = []
    for day_num in range(1, days_in_month + 1):
        d = f"{year_:04d}-{month_:02d}-{day_num:02d}"
        v = cal_map.get(d, {"pnl": 0.0, "trades": 0})
        calendar_days.append({"date": d, "pnl": round(v["pnl"], 2), "trades": v["trades"]})

    return {
        "total_trades": total, "closed_trades": len(closed), "wins": len(wins), "losses": len(losses),
        "win_rate": win_rate, "profit_factor": profit_factor, "total_pnl": total_pnl,
        "todays_pnl": todays_pnl, "todays_trades": len(todays_trades),
        "open_positions": open_positions, "open_positions_list": open_positions_list,
        "avg_win": avg_win, "avg_loss": avg_loss, "max_drawdown": round(max_dd, 2),
        "daily_drawdown": daily_drawdown, "weekly_drawdown": weekly_drawdown,
        "expectancy": expectancy, "avg_rr": avg_rr,
        "best_day": {"date": best_day[0], "pnl": round(best_day[1], 2)} if best_day[0] else None,
        "worst_day": {"date": worst_day[0], "pnl": round(worst_day[1], 2)} if worst_day[0] else None,
        "sessions": sessions_perf, "equity_curve": equity[-90:], "equity_candles": equity_candles[-60:],
        "hourly_performance": hourly_performance, "best_hour": best_hour,
        "monthly_performance": monthly_performance, "daily_pnl": daily_pnl,
        "strategies": strategies, "direction_stats": direction_stats,
        "winrate_trend": winrate_trend, "pnl_distribution": pnl_distribution,
        "current_winning_streak": current_winning_streak, "best_winning_streak": best_win_streak,
        "current_losing_streak": current_losing_streak, "worst_losing_streak": worst_loss_streak,
        "mood_analytics": mood_analytics, "calendar": calendar_days,
        "recent_trades": trades[-5:][::-1] if trades else [],
    }

# ---------- Root ----------
@api_router.get("/")
async def root():
    return {"message": "TheJournalFX API", "version": "3.0-supabase"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
