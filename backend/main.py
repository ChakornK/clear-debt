from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from models import (ExchangeTokenRequest, SaveDebtsRequest, GeneratePlanRequest,
                    ChatRequest, CalendarEvent, DashboardResponse, PredictEventRequest)
from plaid_client import create_link_token, exchange_public_token, get_accounts, get_transactions, get_liabilities
from snowflake_client import (get_cached_category_mappings, get_transactions_raw, save_access_token, get_access_token,
    save_debts, get_debts, save_transactions, get_spending_summary,
    save_calendar_events, get_calendar_events, save_plan, get_connection,
    get_cached_milestone, save_milestone, save_category_mappings,
    get_dashboard_data, save_user_preferences, get_user_preferences)
import time
from cortex import generate_plan, chat, generate_milestone, classify_transactions, predict_event_spend, predict_events_batch
from google_calendar_client import get_google_calendar_events
from math_engine import calc_all_strategies
from pydantic import BaseModel
from typing import List
from datetime import datetime, timedelta, date
from concurrent.futures import ThreadPoolExecutor
import asyncio, os, json
from auth import router as auth_router, get_current_user

app = FastAPI(title="ClearDebt API")

# ── MIDDLEWARE ─────────────────────────────────────────
app.add_middleware(CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True)

app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "fallback_secret"))

app.include_router(auth_router)

# ── CACHE ──────────────────────────────────────────────
DASHBOARD_CACHE: dict = {}
CACHE_TTL = 300  # 5 minutes

def _invalidate_dashboard(user_id: str):
    DASHBOARD_CACHE.pop(user_id, None)

# ── PLAID ROUTES ───────────────────────────────────────

@app.get("/api/plaid/link-token")
def get_link_token(user: dict = Depends(get_current_user)):
    try:
        return {"link_token": create_link_token(user['sub'])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/plaid/exchange")
def exchange_token(req: ExchangeTokenRequest, user: dict = Depends(get_current_user)):
    try:
        access_token, item_id = exchange_public_token(req.public_token)
        save_access_token(user['sub'], access_token, item_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/plaid/sync")
def sync_plaid(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        access_token = get_access_token(user_id)
        if not access_token:
            raise HTTPException(status_code=404, detail="No linked account found")

        # Fetch accounts, transactions, liabilities in parallel
        with ThreadPoolExecutor(max_workers=3) as ex:
            f_accounts = ex.submit(get_accounts, access_token)
            f_txns     = ex.submit(get_transactions, access_token)
            f_liab     = ex.submit(get_liabilities, access_token)

        accounts     = f_accounts.result()
        transactions, _ = f_txns.result()
        liabilities  = f_liab.result()

        # Save in parallel
        with ThreadPoolExecutor(max_workers=2) as ex:
            ex.submit(save_transactions, user_id, transactions)
            ex.submit(save_debts, user_id, liabilities)

        _invalidate_dashboard(user_id)
        return {"accounts": accounts, "debts": liabilities, "transactions_synced": len(transactions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/plaid/sync-history")
async def sync_history(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        access_token = get_access_token(user_id)
        if not access_token:
            raise HTTPException(status_code=404, detail="No linked account found")

        days, batch_size, offset, total_synced = 60, 100, 0, 0

        while True:
            transactions, total_count = get_transactions(access_token, days=days, offset=offset, count=batch_size)
            if not transactions:
                break
            save_transactions(user_id, transactions)
            total_synced += len(transactions)
            offset += len(transactions)
            if offset >= total_count:
                break

        _invalidate_dashboard(user_id)
        return {"success": True, "total_synced": total_synced}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── DEBT ROUTES ────────────────────────────────────────

@app.post("/api/debts/save")
def save_debts_route(req: SaveDebtsRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        debts  = [d.model_dump() for d in req.debts]
        events = [e.model_dump() for e in req.calendar_events]

        # All three writes in parallel
        with ThreadPoolExecutor(max_workers=3) as ex:
            ex.submit(save_debts, user_id, debts)
            ex.submit(save_calendar_events, user_id, events) if events else None
            ex.submit(save_user_preferences, user_id, req.monthly_income, req.monthly_limit, req.savings_pct)

        _invalidate_dashboard(user_id)
        return {"saved": len(debts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/setup")
def get_user_setup_route(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']

        with ThreadPoolExecutor(max_workers=3) as ex:
            f_prefs  = ex.submit(get_user_preferences, user_id)
            f_debts  = ex.submit(get_debts, user_id)
            f_events = ex.submit(get_calendar_events, user_id)

        prefs, debts, events = f_prefs.result(), f_debts.result(), f_events.result()

        activities = [
            {"id": i + 1, "name": e['label'], "category": e['type'], "estimatedCost": e['amount']}
            for i, e in enumerate(events)
        ]

        return {
            "has_completed_setup": bool(prefs or debts or events),
            "debts": debts,
            "activities": activities,
            "monthly_income": prefs['monthly_income'] if prefs else 0,
            "monthly_limit":  prefs['monthly_limit']  if prefs else 0,
            "savings_pct":    prefs['savings_pct']     if prefs else 20,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debts")
def get_debts_route(user: dict = Depends(get_current_user)):
    try:
        return {"debts": get_debts(user['sub'])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── CALENDAR ROUTES ────────────────────────────────────

class CalendarResponse(BaseModel):
    events: List[CalendarEvent]

@app.get("/api/calendar", response_model=CalendarResponse)
def get_events(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']

        # Fetch DB data and category map in parallel
        with ThreadPoolExecutor(max_workers=3) as ex:
            f_manual = ex.submit(get_calendar_events, user_id)
            f_txns   = ex.submit(get_transactions_raw, user_id)
            f_prefs  = ex.submit(get_user_preferences, user_id)

        manual_events = f_manual.result()
        txns          = f_txns.result()
        prefs         = f_prefs.result()
        cat_map       = get_cached_category_mappings()

        # Generate income events
        income_events = []
        if prefs and prefs.get('monthly_income', 0) > 0:
            now = datetime.now()
            for year in [now.year, now.year + 1]:
                for month in range(1, 13):
                    income_events.append({
                        "date": datetime(year, month, 1).strftime("%Y-%m-%d"),
                        "type": "Income",
                        "label": "Monthly Income",
                        "amount": float(prefs['monthly_income']),
                        "is_income": True,
                    })

        # Classify any unknown categories in one batch call
        unknown = list({t['category'] for t in txns if t['category'] not in cat_map})
        if unknown:
            new_mappings = classify_transactions(unknown)
            save_category_mappings(new_mappings)
            cat_map.update(new_mappings)

        final_txn_events = [
            {
                "date": t['date'],
                "type": cat_map.get(t['category'], "Other"),
                "label": t['description'],
                "amount": float(t['amount']),
                "is_income": t.get('is_income', False),
            }
            for t in txns
        ]

        return {"events": manual_events + final_txn_events + income_events}
    except Exception as e:
        print(f"Error in get_events: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calendar")
def save_events(events: List[CalendarEvent], user: dict = Depends(get_current_user)):
    try:
        save_calendar_events(user['sub'], [e.model_dump() for e in events])
        return {"saved": len(events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calendar/predict")
async def predict_event_cost(req: PredictEventRequest, user: dict = Depends(get_current_user)):
    try:
        return predict_event_spend(req.label, req.date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/google-calendar/sync")
async def sync_google_calendar(request: Request, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        access_token = user.get('access_token')
        if not access_token:
            raise HTTPException(status_code=401, detail="Google access token not found. Please log in again.")

        google_events = await get_google_calendar_events(access_token, days=30)
        if not google_events:
            return {"synced": 0, "events": []}

        existing_events = get_calendar_events(user_id)
        cache_lookup = {(e['label'], e['date'].split('T')[0]) for e in existing_events if e.get('amount', 0) > 0}
        existing_map  = {(e['label'], e['date'].split('T')[0]): e for e in existing_events}

        to_predict, already_predicted = [], []
        for e in google_events:
            e_date = e['date'].split('T')[0]
            if (e['label'], e_date) in cache_lookup:
                ex = existing_map.get((e['label'], e_date))
                if ex:
                    already_predicted.append({"date": e_date, "type": ex['type'], "label": e['label'], "amount": ex['amount']})
            else:
                to_predict.append(e)

        new_estimated = []
        if to_predict:
            try:
                predictions = predict_events_batch(to_predict)
                new_estimated = [
                    {
                        "date": e['date'],
                        "type": predictions[i].get('type', "Other") if i < len(predictions) else "Other",
                        "label": e['label'],
                        "amount": predictions[i].get('predictedAmount', 0) if i < len(predictions) else 0,
                    }
                    for i, e in enumerate(to_predict)
                ]
            except Exception as ai_e:
                print(f"Batch AI estimation failed: {ai_e}")
                new_estimated = [{"date": e['date'], "type": "Other", "label": e['label'], "amount": 0} for e in to_predict]

        if new_estimated:
            save_calendar_events(user_id, new_estimated)

        all_synced = sorted(already_predicted + new_estimated, key=lambda x: x['date'])
        return {"synced": len(new_estimated), "total": len(all_synced), "events": all_synced}
    except Exception as e:
        print(f"Sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ── PLAN ROUTES ────────────────────────────────────────

@app.post("/api/plan/generate")
async def generate_plan_route(req: GeneratePlanRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        debts = get_debts(user_id)
        if not debts:
            raise HTTPException(status_code=400, detail="No debts found. Sync or add debts first.")

        with ThreadPoolExecutor(max_workers=2) as ex:
            f_events  = ex.submit(get_calendar_events, user_id, False)
            f_spending = ex.submit(get_spending_summary, user_id)

        events   = f_events.result()
        spending = f_spending.result()
        strategies = calc_all_strategies(debts, req.extra_payment)
        ai_plan = generate_plan(debts, events, spending, strategies)
        ai_plan['strategies'] = strategies
        save_plan(user_id, ai_plan)
        return {"plan": ai_plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── CHAT ROUTES ────────────────────────────────────────

@app.post("/api/chat")
async def chat_route(req: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        debts = get_debts(user_id)
        if not debts:
            return {"reply": "No debts found. Please add your debts first so I can give you specific advice."}

        plan = {}
        try:
            with get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT PLAN_JSON FROM REPAYMENT_PLANS
                    WHERE USER_ID = %s
                    ORDER BY CREATED_AT DESC LIMIT 1
                """, (user_id,))
                row = cur.fetchone()
                if row:
                    plan = json.loads(row[0])
        except:
            pass

        history = [m.dict() for m in req.history]
        history.append({"role": "user", "content": req.message})

        try:
            reply = chat(debts, plan, history)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

        return {"reply": reply}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── DASHBOARD ──────────────────────────────────────────

# Pre-built color map to avoid repeated dict lookups
_CATEGORY_COLORS = {
    "Housing": "bg-emerald-400",
    "Food & Dining": "bg-orange-400",
    "Transportation": "bg-blue-400",
    "Healthcare": "bg-rose-400",
    "Entertainment": "bg-purple-400",
    "Shopping": "bg-amber-400",
    "Debt Payments": "bg-red-400",
    "Other": "bg-slate-400",
}

@app.get("/api/dashboard", response_model=DashboardResponse)
async def get_dashboard(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']

        # ── CACHE CHECK ────────────────────────────────
        now_ts = time.time()
        cached = DASHBOARD_CACHE.get(user_id)
        if cached and now_ts - cached['timestamp'] < CACHE_TTL:
            return cached['data']

        # ── FETCH DATA ─────────────────────────────────
        db_data       = get_dashboard_data(user_id)  # already runs 6 parallel queries
        debts         = db_data['debts']
        spending      = db_data['spending']
        events        = db_data['events']
        raw_txns      = db_data['raw_txns']
        cat_map       = db_data['cat_map']
        monthly_budget = db_data.get('monthly_limit', 500)
        weekly_budget  = round(monthly_budget / 4.33, 2)
        period_budget  = monthly_budget * 3

        today_date = datetime.now().date()
        now        = datetime.now()

        # ── CLASSIFY UNKNOWN CATEGORIES (one batch) ────
        unknown = list({
            label
            for source in (spending, raw_txns, events)
            for label in ([s['category'] for s in source] if source and 'category' in (source[0] if source else {}) else [e['label'] for e in source])
            if label not in cat_map
        })
        # Simpler version: gather all unknown from each source separately
        unknown_cats = list({
            c for c in
                [s['category'] for s in spending] +
                [t['category'] for t in raw_txns] +
                [e['label'] for e in events if datetime.fromisoformat(e['date']) >= now]
            if c not in cat_map
        })
        if unknown_cats:
            new_mappings = classify_transactions(unknown_cats)
            save_category_mappings(new_mappings)
            cat_map.update(new_mappings)

        # ── DEBT PROGRESS ──────────────────────────────
        total_debt = sum(d['balance'] for d in debts) if debts else 0
        cutoff_30d = now - timedelta(days=30)
        paid_this_month = sum(
            abs(t['amount']) for t in raw_txns
            if 'Payment' in t['category'] and datetime.fromisoformat(t['date']) >= cutoff_30d
        )

        target_date_str = ""
        if debts:
            total_min = sum(d['minimum'] for d in debts)
            if total_min > 0:
                months = int(total_debt / (total_min + 200))
                target_date_str = (now + timedelta(days=months * 30)).strftime("%B %Y")

        # ── STREAK — O(N) pre-aggregation ─────────────
        # Build week-bucket sums once, then scan
        week_sums = [0.0] * 13
        for t in raw_txns:
            if t.get('is_income', False):
                continue
            if cat_map.get(t['category'], "Other") == "Debt Payments":
                continue
            delta = (today_date - datetime.fromisoformat(t['date']).date()).days
            week_idx = delta // 7
            if 0 <= week_idx <= 12:
                week_sums[week_idx] += t['amount']

        streak = 0
        for w in week_sums[:12]:
            if w < weekly_budget:
                streak += 1
            else:
                break

        achievement = {
            "label": "Underbudget Streak",
            "value": f"{streak} weeks!" if streak > 0 else "New Start!",
        }

        # ── UPCOMING EVENTS ────────────────────────────
        upcoming = [
            {
                "time": (lambda dt: dt.strftime("%a, %b %d, %H:%M") if dt.hour > 0 else dt.strftime("%a, %b %d"))(
                    datetime.fromisoformat(e['date'])
                ),
                "cost": e['amount'],
                "name": e['label'],
                "location": "Remote",
                "category": e.get('type', "Other"),
            }
            for e in events
            if datetime.fromisoformat(e['date']) >= now
        ][:3]

        # ── WEEKLY SPENDING — reuse week_sums ──────────
        weeks = [
            {
                "week": f"W{5 - i}",
                "spent": round(week_sums[i], 2),
                "active": i == 0,
            }
            for i in range(4, -1, -1)
        ]

        # ── DAILY DISTRIBUTION — O(N) ──────────────────
        daily_buckets = {}
        for i in range(7):
            daily_buckets[today_date - timedelta(days=i)] = 0.0

        for t in raw_txns:
            if t.get('is_income', False):
                continue
            if cat_map.get(t['category'], "Other") == "Debt Payments":
                continue
            t_date = datetime.fromisoformat(t['date']).date()
            if t_date in daily_buckets:
                daily_buckets[t_date] += t['amount']

        _days_map = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        daily = [
            {
                "day": _days_map[(today_date - timedelta(days=i)).weekday()],
                "spent": round(daily_buckets[today_date - timedelta(days=i)], 2),
                "active": i == 0,
            }
            for i in range(6, -1, -1)
        ]

        # ── SPENDING CATEGORIES ────────────────────────
        buckets: dict = {}
        for s in spending:
            b_name = cat_map.get(s['category'], "Other")
            buckets[b_name] = buckets.get(b_name, 0) + s['total']

        total_sum = sum(buckets.values()) or 1
        categories = sorted(
            [
                {
                    "color": _CATEGORY_COLORS.get(label, "bg-slate-200"),
                    "label": label,
                    "pct": int(val / total_sum * 100),
                }
                for label, val in buckets.items() if val > 0
            ],
            key=lambda x: x['pct'],
            reverse=True,
        )

        # ── AI MILESTONE ───────────────────────────────
        milestone = get_cached_milestone(user_id)
        if not milestone:
            try:
                milestone = generate_milestone(debts, spending, events)
                save_milestone(user_id, milestone)
            except:
                milestone = {
                    "tag": "Milestone Alert",
                    "title": "You're making great progress!",
                    "description": "Keep staying under your weekly budget to clear your debts faster.",
                    "primaryCTA": "View Plan",
                    "secondaryCTA": "Got it",
                }

        # ── ASSEMBLE RESPONSE ──────────────────────────
        response_payload = {
            "debtProgress": {
                "paid": round(paid_this_month, 2),
                "total": round(total_debt, 2),
                "targetDate": target_date_str,
            },
            "achievement": achievement,
            "upcomingEvents": upcoming,
            "weeklySpending": {"budgetLimit": weekly_budget, "weeks": weeks},
            "dailyDistribution": daily,
            "spendingCategories": {
                "total": round(total_sum, 2),
                "categories": categories,
                "periodLimit": period_budget,
            },
            "milestone": milestone,
        }

        DASHBOARD_CACHE[user_id] = {"data": response_payload, "timestamp": time.time()}
        return response_payload

    except Exception as e:
        print(f"Error in get_dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))