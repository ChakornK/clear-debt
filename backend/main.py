from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from models import ExchangeTokenRequest, SaveDebtsRequest, GeneratePlanRequest, ChatRequest, CalendarEvent, PredictEventRequest
from plaid_client import create_link_token, exchange_public_token, get_accounts, get_transactions, get_liabilities
from snowflake_client import (save_access_token, get_access_token, save_debts,
    get_debts, save_transactions, get_transactions_raw, get_spending_summary,
    save_calendar_events, get_calendar_events, save_plan, get_connection)
from cortex import generate_plan, chat, predict_event_spend
from math_engine import calc_all_strategies
from pydantic import BaseModel
from typing import List
from datetime import datetime, timedelta
import random, os, json
from auth import router as auth_router, get_current_user

app = FastAPI(title="ClearDebt API")

# ── MIDDLEWARE ─────────────────────────────────────────
app.add_middleware(CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True)

app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "fallback_secret"))

# ── ROUTES ─────────────────────────────────────────────
app.include_router(auth_router)

# ── PLAID ROUTES ──────────────────────────────────────

@app.get("/api/plaid/link-token")
def get_link_token(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        token = create_link_token(user_id)
        return {"link_token": token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/plaid/exchange")
def exchange_token(req: ExchangeTokenRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        access_token, item_id = exchange_public_token(req.public_token)
        save_access_token(user_id, access_token, item_id)
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
        accounts = get_accounts(access_token)
        transactions = get_transactions(access_token)
        liabilities = get_liabilities(access_token)
        save_transactions(user_id, transactions)
        save_debts(user_id, liabilities)
        return {"accounts": accounts, "debts": liabilities, "transactions_synced": len(transactions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── DEBT ROUTES ───────────────────────────────────────

@app.post("/api/debts/save")
def save_debts_route(req: SaveDebtsRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        debts = [d.model_dump() for d in req.debts]
        events = [e.model_dump() for e in req.calendar_events]
        save_debts(user_id, debts)
        if events:
            save_calendar_events(user_id, events)
        return {"saved": len(debts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debts")
def get_debts_route(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        return {"debts": get_debts(user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── CALENDAR ROUTES ───────────────────────────────────

class CalendarResponse(BaseModel):
    events: List[CalendarEvent]

@app.get("/api/calendar", response_model=CalendarResponse)
def get_events(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        return {"events": get_calendar_events(user_id, future_only=True)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calendar")
def save_events(events: List[CalendarEvent], user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        save_calendar_events(user_id, [e.model_dump() for e in events])
        return {"saved": len(events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calendar/predict")
async def predict_event_cost(req: PredictEventRequest, user: dict = Depends(get_current_user)):
    try:
        prediction = predict_event_spend(req.label, req.date)
        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── PLAN ROUTES ───────────────────────────────────────

@app.post("/api/plan/generate")
async def generate_plan_route(req: GeneratePlanRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        debts = get_debts(user_id)
        if not debts:
            raise HTTPException(status_code=400, detail="No debts found. Sync or add debts first.")
        events = get_calendar_events(user_id, future_only=False)
        spending = get_spending_summary(user_id)
        strategies = calc_all_strategies(debts, req.extra_payment)
        ai_plan = generate_plan(debts, events, spending, strategies)
        ai_plan['strategies'] = strategies
        save_plan(user_id, ai_plan)
        return {"plan": ai_plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── CHAT ROUTES ───────────────────────────────────────

@app.post("/api/chat")
async def chat_route(req: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        debts = get_debts(user_id)
        if not debts:
            return {"reply": "No debts found. Please add your debts first so I can give you specific advice."}

        plan = {}
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("""
                SELECT PLAN_JSON FROM REPAYMENT_PLANS
                WHERE USER_ID = %s
                ORDER BY CREATED_AT DESC LIMIT 1
            """, (user_id,))
            row = cur.fetchone()
            cur.close(); conn.close()
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

# ── DASHBOARD ROUTES ──────────────────────────────────

@app.get("/api/dashboard")
async def get_dashboard(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        access_token = get_access_token(user_id)
        if not access_token:
            raise HTTPException(status_code=404, detail="No linked account found")

        debts = get_debts(user_id)
        spending = get_spending_summary(user_id)
        events = get_calendar_events(user_id)
        transactions = get_transactions(access_token, user_id)

        total_debt = sum(d['balance'] for d in debts)
        paid = round(total_debt * 0.34, 2)
        monthly_payment = sum(d['minimum'] for d in debts) + 200
        months_remaining = int(total_debt / monthly_payment) if monthly_payment else 60
        target_date = (datetime.now() + timedelta(days=months_remaining * 30)).strftime("%B %Y")

        weekly = []
        for i in range(4, -1, -1):
            week_start = datetime.now() - timedelta(weeks=i+1)
            week_end = datetime.now() - timedelta(weeks=i)
            week_txns = [
                t for t in transactions
                if week_start <= datetime.fromisoformat(t['date']) <= week_end
            ]
            spent = round(sum(t['amount'] for t in week_txns), 2)
            weekly.append({
                "week": f"W{5-i}",
                "spent": spent if spent > 0 else random.randint(150, 350),
                "active": i == 0
            })

        budget_limit = 500

        days = ["M", "T", "W", "T", "F", "S", "S"]
        today_weekday = datetime.now().weekday()
        daily = []
        for i, day in enumerate(days):
            day_date = datetime.now() - timedelta(days=(today_weekday - i) % 7)
            day_txns = [
                t for t in transactions
                if t['date'] == day_date.strftime('%Y-%m-%d')
            ]
            spent = round(sum(t['amount'] for t in day_txns), 2)
            daily.append({
                "day": day,
                "spent": spent if spent > 0 else random.randint(20, 70),
                "active": i >= today_weekday - 1
            })

        category_map = {
            "Groceries": "Essentials", "Utilities": "Essentials",
            "Transport": "Essentials", "Dining": "Leisure",
            "Entertainment": "Leisure", "Subscriptions": "Leisure"
        }
        buckets = {"Essentials": 0, "Leisure": 0, "Other": 0}
        for s in spending:
            bucket = category_map.get(s['category'], "Other")
            buckets[bucket] += s['total']

        total_spend = sum(buckets.values()) or 1
        categories = [
            {"color": "bg-green-400", "label": "Essentials", "pct": round(buckets["Essentials"] / total_spend * 100)},
            {"color": "bg-slate-400", "label": "Leisure",    "pct": round(buckets["Leisure"]    / total_spend * 100)},
            {"color": "bg-slate-200", "label": "Other",      "pct": round(buckets["Other"]       / total_spend * 100)},
        ]

        upcoming = []
        for e in events[:3]:
            event_dt = datetime.fromisoformat(e['date'])
            diff = (event_dt.date() - datetime.now().date()).days
            if diff == 1:
                time_str = f"Tomorrow, {event_dt.strftime('%H:%M') if 'T' in e['date'] else '09:00'}"
            elif diff == 0:
                time_str = "Today"
            else:
                time_str = event_dt.strftime("%a, %H:%M") if 'T' in e['date'] else event_dt.strftime("%a")
            upcoming.append({
                "time": time_str,
                "cost": e['amount'],
                "name": e['label'],
                "location": "—"
            })

        defaults = [
            {"time": "Tomorrow, 14:00", "cost": 15,  "name": "Study Group at Coffee Shop", "location": "Downtown Branch"},
            {"time": "Thu, 18:30",      "cost": 45,  "name": "Weekly Grocery Run",         "location": "Organic Market"},
            {"time": "Sat, 10:00",      "cost": 0,   "name": "Morning Hike",               "location": "Canyon Trail"},
        ]
        while len(upcoming) < 3:
            upcoming.append(defaults[len(upcoming)])

        under_budget_weeks = sum(1 for w in weekly if w['spent'] < budget_limit)
        achievement = {
            "label": "Underbudget Streak",
            "value": f"{under_budget_weeks} week{'s' if under_budget_weeks != 1 else ''}!"
        }

        leisure_spend = buckets.get("Leisure", 0)
        saved_estimate = round(leisure_spend * 0.3, 0)
        smallest_debt = min(debts, key=lambda d: d['balance']) if debts else None
        milestone = {
            "tag": "Milestone Alert",
            "title": f"You saved an extra ${int(saved_estimate)} this month from dining out!",
            "description": f"That's enough to clear your '{smallest_debt['name'] if smallest_debt else 'Subscription Debt'}' faster. Would you like to apply this to your plan?",
            "primaryCTA": "Apply to Debt",
            "secondaryCTA": "View Details"
        }

        return {
            "debtProgress": {
                "paid": paid,
                "total": round(total_debt, 2),
                "targetDate": target_date
            },
            "achievement": achievement,
            "upcomingEvents": upcoming,
            "weeklySpending": {
                "budgetLimit": budget_limit,
                "weeks": weekly
            },
            "dailyDistribution": daily,
            "spendingCategories": {
                "total": round(total_spend, 2),
                "categories": categories
            },
            "milestone": milestone
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))