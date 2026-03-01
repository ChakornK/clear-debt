from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import ExchangeTokenRequest, SaveDebtsRequest, GeneratePlanRequest, ChatRequest
from plaid_client import create_link_token, exchange_public_token, get_accounts, get_transactions, get_liabilities
from snowflake_client import (save_access_token, get_access_token, save_debts,
    get_debts, save_transactions, get_spending_summary,
    save_calendar_events, get_calendar_events, save_plan)
from cortex import generate_plan, chat
from math_engine import calc_all_strategies

app = FastAPI(title="ClearDebt API")

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── PLAID ROUTES ──────────────────────────────────────

@app.get("/api/plaid/link-token/{user_id}")
def get_link_token(user_id: str):
    try:
        token = create_link_token(user_id)
        return {"link_token": token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/plaid/exchange")
def exchange_token(req: ExchangeTokenRequest):
    try:
        access_token, item_id = exchange_public_token(req.public_token)
        save_access_token(req.user_id, access_token, item_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/plaid/sync/{user_id}")
def sync_plaid(user_id: str):
    try:
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
def save_debts_route(req: SaveDebtsRequest):
    try:
        debts = [d.dict() for d in req.debts]
        events = [e.dict() for e in req.calendar_events]
        save_debts(req.user_id, debts)
        if events:
            save_calendar_events(req.user_id, events)
        return {"saved": len(debts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debts/{user_id}")
def get_debts_route(user_id: str):
    try:
        return {"debts": get_debts(user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── CALENDAR ROUTES ───────────────────────────────────

@app.get("/api/calendar/{user_id}")
def get_events(user_id: str):
    try:
        return {"events": get_calendar_events(user_id, future_only=True)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── PLAN ROUTES ───────────────────────────────────────

@app.post("/api/plan/generate")
async def generate_plan_route(req: GeneratePlanRequest):
    try:
        debts = get_debts(req.user_id)
        if not debts:
            raise HTTPException(status_code=400, detail="No debts found. Sync or add debts first.")
        events = get_calendar_events(req.user_id, future_only=False)
        spending = get_spending_summary(req.user_id)
        strategies = calc_all_strategies(debts, req.extra_payment)
        ai_plan = generate_plan(debts, events, spending, strategies)
        ai_plan['strategies'] = strategies
        save_plan(req.user_id, ai_plan)
        return {"plan": ai_plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── CHAT ROUTES ───────────────────────────────────────

@app.post("/api/chat")
async def chat_route(req: ChatRequest):
    try:
        debts = get_debts(req.user_id)
        history = [m.dict() for m in req.history]
        history.append({"role": "user", "content": req.message})
        reply = chat(debts, {}, history)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

        