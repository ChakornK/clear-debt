from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from models import (ExchangeTokenRequest, SaveDebtsRequest, GeneratePlanRequest, 
                    ChatRequest, CalendarEvent, DashboardResponse, PredictEventRequest)
from plaid_client import create_link_token, exchange_public_token, get_accounts, get_transactions, get_liabilities
from snowflake_client import (get_cached_category_mappings, get_transactions_raw, save_access_token, get_access_token, save_debts,
    get_debts, save_transactions, get_spending_summary,
    save_calendar_events, get_calendar_events, save_plan, get_connection,
    get_cached_milestone, save_milestone, save_category_mappings,
    get_dashboard_data, save_user_preferences, get_user_preferences)
import time
from cortex import generate_plan, chat, generate_milestone, classify_transactions, predict_event_spend, predict_events_batch
from google_calendar_client import get_google_calendar_events
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
        transactions, _ = get_transactions(access_token)
        liabilities = get_liabilities(access_token)
        save_transactions(user_id, transactions)
        save_debts(user_id, liabilities)
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
        
        days = 60 
        batch_size = 100
        offset = 0
        total_synced = 0
        
        while True:
            transactions, total_count = get_transactions(access_token, days=days, offset=offset, count=batch_size)
            if not transactions:
                break
            
            save_transactions(user_id, transactions)
            total_synced += len(transactions)
            offset += len(transactions)
            
            if offset >= total_count:
                break
                
        return {"success": True, "total_synced": total_synced}
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
        save_user_preferences(user_id, req.monthly_income, req.monthly_limit, req.savings_pct)
        return {"saved": len(debts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/setup")
def get_user_setup_route(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        prefs = get_user_preferences(user_id)
        debts = get_debts(user_id)
        events = get_calendar_events(user_id)
        
        # Convert calendar events back to activities for form pre-filling
        # For simplicity, we filter events that were generically added as "triggers" 
        # (they might have today's date if they were just added)
        # Actually frontend is expecting an "id" which matches how it stores it.
        activities = []
        for i, e in enumerate(events):
            # Try to restore activity structure
            activities.append({
                "id": i + 1,
                "name": e['label'],
                "category": e['type'],
                "estimatedCost": e['amount']
            })

        has_completed_setup = bool(prefs or debts or events)
        
        return {
            "has_completed_setup": has_completed_setup,
            "debts": debts,
            "activities": activities,
            "monthly_income": prefs['monthly_income'] if prefs else 0,
            "monthly_limit": prefs['monthly_limit'] if prefs else 0,
            "savings_pct": prefs['savings_pct'] if prefs else 20
        }
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
        # 1. Fetch manual calendar events
        manual_events = get_calendar_events(user_id)
        
        # 1b. Generate virtual income events from preferences
        prefs = get_user_preferences(user_id)
        income_events = []
        if prefs and prefs.get('monthly_income', 0) > 0:
            now = datetime.now()
            # Generate for current year and next year to ensure visibility
            for year in [now.year, now.year + 1]:
                for month in range(1, 13):
                    income_date = datetime(year, month, 1).strftime("%Y-%m-%d")
                    income_events.append({
                        "date": income_date,
                        "type": "Income",
                        "label": "Monthly Income",
                        "amount": float(prefs['monthly_income']),
                        "is_income": True
                    })
        
        # 2. Fetch real transactions
        txns = get_transactions_raw(user_id)
        
        # 3. Fetch category mappings for transactions
        cat_map = get_cached_category_mappings()
        
        # 4. Process transactions into CalendarEvent format
        txn_events = []
        to_classify = []
        
        for t in txns:
            cat = t['category']
            if cat not in cat_map:
                to_classify.append(cat)
            
            txn_events.append({
                "date": t['date'],
                "type": cat_map.get(cat, "Other"),
                "label": t['description'],
                "amount": float(t['amount'])
            })
            
        # 5. Classify missing categories if any (async/background ideally, but inline for now)
        if to_classify:
            new_mappings = classify_transactions(list(set(to_classify)))
            save_category_mappings(new_mappings)
            cat_map.update(new_mappings)
            # Update the types in txn_events
            for te in txn_events:
                # We need to find the original raw category if possible, but txn_events already has the label.
                # Let's re-match by finding the txn again or just updating based on a map.
                # A better way is to do this during the first loop.
                pass

        # Re-calc types for txn_events after potential classification
        final_txn_events = []
        for t in txns:
            final_txn_events.append({
                "date": t['date'],
                "type": cat_map.get(t['category'], "Other"),
                "label": t['description'],
                "amount": float(t['amount']),
                "is_income": t.get('is_income', False)
            })

        return {"events": manual_events + final_txn_events + income_events}
    except Exception as e:
        print(f"Error in get_events: {e}")
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

@app.post("/api/google-calendar/sync")
async def sync_google_calendar(request: Request, user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        access_token = user.get('access_token')
        if not access_token:
             raise HTTPException(status_code=401, detail="Google access token not found. Please log in again.")

        # 1. Fetch events from Google
        google_events = await get_google_calendar_events(access_token, days=30)
        
        if not google_events:
            return {"synced": 0, "events": []}
        
        # 2. Fetch existing events from Snowflake to check for cache
        # existing_events = get_calendar_events(user_id)
        existing_events = []
        
        # Create a lookup set for (label, date)
        cache_lookup = {(e['label'], e['date']) for e in existing_events if e.get('amount', 0) > 0}
        
        # 3. Filter events that need prediction
        to_predict = []
        already_predicted = []
        
        for e in google_events:
          e_date = e['date'].split('T')[0]
          if (e['label'], e_date) in cache_lookup:
            existing = next(
              (ex for ex in existing_events 
               if ex['label'] == e['label'] and ex['date'].split('T')[0] == e_date),
              None
            )
            if existing:
              already_predicted.append({
                "date": e_date,
                "type": existing['type'],
                "label": e['label'],
                "amount": existing['amount']
              })
          else:
            to_predict.append(e)
        
        # 4. Predict spending for NEW events only
        new_estimated = []
        if to_predict:
            try:
                predictions = predict_events_batch(to_predict)
                for i, e in enumerate(to_predict):
                    pred = predictions[i] if i < len(predictions) else {}
                    new_estimated.append({
                        "date": e['date'],
                        "type": pred.get('type', "Other"),
                        "label": e['label'],
                        "amount": pred.get('predictedAmount', 0)
                    })
            except Exception as ai_e:
                print(f"Batch AI estimation failed: {ai_e}")
                for e in to_predict:
                    new_estimated.append({
                        "date": e['date'],
                        "type": "Other",
                        "label": e['label'],
                        "amount": 0
                    })
        
        # 5. Save ONLY new predictions to Snowflake (save_calendar_events uses MERGE)
        if new_estimated:
            save_calendar_events(user_id, new_estimated)
            
        # 6. Return combined results for the UI
        all_synced = already_predicted + new_estimated
        # Sort by date for better UI presentation
        all_synced.sort(key=lambda x: x['date'])
        
        return {"synced": len(new_estimated), "total": len(all_synced), "events": all_synced}
    except Exception as e:
        print(f"Sync error: {str(e)}")
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

# Simple in-memory cache
DASHBOARD_CACHE = {} # {user_id: {"data": ..., "timestamp": ...}}
CACHE_TTL = 300 # 5 minutes

@app.get("/api/dashboard", response_model=DashboardResponse)
async def get_dashboard(user: dict = Depends(get_current_user)):
    try:
        user_id = user['sub']
        
        # ── CACHE CHECK ────────────────────────────────
        now_ts = time.time()
        if user_id in DASHBOARD_CACHE:
            entry = DASHBOARD_CACHE[user_id]
            if now_ts - entry['timestamp'] < CACHE_TTL:
                return entry['data']

        # 1. Fetch data from Snowflake (Consolidated into 1 connection)
        db_data = get_dashboard_data(user_id)
        debts = db_data['debts']
        spending = db_data['spending']
        events = db_data['events']
        raw_txns = db_data['raw_txns']
        cached_cat_map = db_data['cat_map']
        
        # ── DEBT PROGRESS ──────────────────────────────
        total_debt = sum(d['balance'] for d in debts) if debts else 0
        # For 'paid', we look for 'Payment' transactions in the last 30 days
        paid_this_month = sum(abs(t['amount']) for t in raw_txns 
                             if 'Payment' in t['category'] 
                             and datetime.fromisoformat(t['date']) >= datetime.now() - timedelta(days=30))
        
        # Estimate target date
        target_date = ""
        if debts:
            total_min = sum(d['minimum'] for d in debts)
            if total_min > 0:
                months = int(total_debt / (total_min + 200)) # assume extra $200
                target_date = (datetime.now() + timedelta(days=months*30)).strftime("%B %Y")

        # ── ACHIEVEMENT ────────────────────────────────
        # Streak logic: count weeks under a $500 budget
        budget_limit = 500
        streak = 0
        now = datetime.now()
        for i in range(12): # check last 12 weeks
            w_start = now - timedelta(weeks=i+1)
            w_end = now - timedelta(weeks=i)
            w_spent = sum(t['amount'] for t in raw_txns 
                         if w_start <= datetime.fromisoformat(t['date']) < w_end
                         and not t.get('is_income', False))
            if w_spent < budget_limit:
                streak += 1
            else:
                break
        
        achievement = {
            "label": "Underbudget Streak",
            "value": f"{streak} weeks!" if streak > 0 else "New Start!"
        }

        # ── UPCOMING EVENTS ────────────────────────────
        raw_event_labels = [e['label'] for e in events if datetime.fromisoformat(e['date']) >= datetime.now()]
        to_classify_events = [l for l in raw_event_labels if l not in cached_cat_map]
        
        if to_classify_events:
            event_new_mappings = classify_transactions(to_classify_events)
            save_category_mappings(event_new_mappings)
            cached_cat_map.update(event_new_mappings)
        
        upcoming = []
        for e in events:
            if datetime.fromisoformat(e['date']) >= datetime.now():
                dt = datetime.fromisoformat(e['date'])
                time_str = dt.strftime("%a, %b %d, %H:%M") if dt.hour > 0 else dt.strftime("%a, %b %d")
                upcoming.append({
                    "time": time_str,
                    "cost": e['amount'],
                    "name": e['label'],
                    "location": "Remote",
                    "category": e.get('type', "Other")
                })

        # ── WEEKLY SPENDING ────────────────────────────
        weeks = []
        for i in range(4, -1, -1):
            w_start = now - timedelta(weeks=i+1)
            w_end = now - timedelta(weeks=i)
            w_spent = sum(t['amount'] for t in raw_txns 
                         if w_start <= datetime.fromisoformat(t['date']) < w_end
                         and not t.get('is_income', False))
            weeks.append({
                "week": f"W{5-i}",
                "spent": round(w_spent, 2),
                "active": i == 0
            })

        # ── DAILY DISTRIBUTION ─────────────────────────
        daily = []
        days_map = ["M", "T", "W", "T", "F", "S", "S"]
        # Last 7 days
        for i in range(6, -1, -1):
            target_day = now - timedelta(days=i)
            d_spent = sum(t['amount'] for t in raw_txns 
                         if datetime.fromisoformat(t['date']).date() == target_day.date()
                         and not t.get('is_income', False))
            daily.append({
                "day": days_map[target_day.weekday()],
                "spent": round(d_spent, 2),
                "active": i == 0
            })

        # ── SPENDING CATEGORIES ────────────────────────
        raw_categories = list(set(s['category'] for s in spending))
        
        # Determine which categories need classification
        to_classify = [c for c in raw_categories if c not in cached_cat_map]
        
        if to_classify:
            new_mappings = classify_transactions(to_classify)
            save_category_mappings(new_mappings)
            cached_cat_map.update(new_mappings)

        buckets = {}
        for s in spending:
            b_name = cached_cat_map.get(s['category'], "Other")
            buckets[b_name] = buckets.get(b_name, 0) + s['total']
        
        total_sum = sum(buckets.values()) or 1
        
        # Color map for diverse categories
        colors = {
            "Housing": "bg-emerald-400",
            "Food & Dining": "bg-orange-400",
            "Transportation": "bg-blue-400",
            "Healthcare": "bg-rose-400",
            "Entertainment": "bg-purple-400",
            "Shopping": "bg-amber-400",
            "Debt Payments": "bg-red-400",
            "Other": "bg-slate-400"
        }
        
        categories = [
            {
                "color": colors.get(label, "bg-slate-200"),
                "label": label,
                "pct": int(val / total_sum * 100)
            }
            for label, val in buckets.items() if val > 0
        ]
        
        # Sort by percentage descending
        categories.sort(key=lambda x: x['pct'], reverse=True)

        # ── AI MILESTONE ───────────────────────────────
        milestone = get_cached_milestone(user_id)
        
        if not milestone:
            try:
                milestone = generate_milestone(debts, spending, events)
                save_milestone(user_id, milestone)
            except:
                # Fallback if AI fails
                milestone = {
                    "tag": "Milestone Alert",
                    "title": "You're making great progress!",
                    "description": "Keep staying under your weekly budget to clear your debts faster.",
                    "primaryCTA": "View Plan",
                    "secondaryCTA": "Got it"
                }

        response_payload = {
            "debtProgress": {
                "paid": round(paid_this_month, 2),
                "total": round(total_debt, 2),
                "targetDate": target_date
            },
            "achievement": achievement,
            "upcomingEvents": upcoming[:3],
            "weeklySpending": {
                "budgetLimit": budget_limit,
                "weeks": weeks
            },
            "dailyDistribution": daily,
            "spendingCategories": {
                "total": round(total_sum, 2),
                "categories": categories
            },
            "milestone": milestone
        }
        
        # Update Cache
        DASHBOARD_CACHE[user_id] = {
            "data": response_payload,
            "timestamp": time.time()
        }

        return response_payload

    except Exception as e:
        print(f"Error in get_dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
