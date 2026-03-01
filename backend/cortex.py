from snowflake.snowpark import Session
from snowflake.cortex import Complete
from dotenv import load_dotenv
import os, json

load_dotenv()

def get_session():
    return Session.builder.configs({
        "account":   os.getenv('SF_ACCOUNT'),
        "user":      os.getenv('SF_USER'),
        "password":  os.getenv('SF_PASSWORD'),
        "warehouse": os.getenv('SF_WAREHOUSE'),
        "database":  os.getenv('SF_DATABASE'),
        "schema":    os.getenv('SF_SCHEMA'),
        "role":      os.getenv('SF_ROLE')
    }).create()

def generate_plan(debts, calendar_events, spending, strategies):
    session = get_session()

    debt_lines = "\n".join([
        f"- {d['name']}: ${d['balance']} balance, {d['apr']}% APR, "
        f"${d['minimum']}/mo minimum, due day {d['due']}"
        for d in debts
    ])

    event_lines = "\n".join([
        f"- {e['date']}: {e['type']} — {e['label']} (${e['amount']})"
        for e in calendar_events
    ]) or "No upcoming events."

    spend_lines = "\n".join([
        f"- {s['category']}: ${s['total']} over 90 days"
        for s in spending
    ])

    prompt = f"""You are a certified financial planner specializing in debt repayment optimization.

DEBTS:
{debt_lines}

UPCOMING CALENDAR EVENTS:
{event_lines}

SPENDING BEHAVIOR (last 90 days):
{spend_lines}

PRE-COMPUTED STRATEGY RESULTS ($200/mo extra payment):
- Avalanche: ${strategies['avalanche']['total_interest']} total interest, {strategies['avalanche']['months_to_payoff']} months
- Snowball: ${strategies['snowball']['total_interest']} total interest, {strategies['snowball']['months_to_payoff']} months
- Minimum only: ${strategies['minimum']['total_interest']} total interest, {strategies['minimum']['months_to_payoff']} months

Respond ONLY with valid JSON, no markdown, no extra text. Use these exact keys:
{{
  "recommendedStrategy": "avalanche" | "snowball" | "hybrid",
  "reasoning": "2-3 sentences referencing specific numbers",
  "priorityOrder": ["debt name 1", "debt name 2"],
  "monthlyExtra": 200,
  "interestSaved": 0,
  "payoffDate": "YYYY-MM",
  "calendarInsights": ["insight 1", "insight 2"]
}}"""

    response = Complete("mistral-large2", prompt, session=session)
    clean = response.strip().replace('```json','').replace('```','').strip()
    return json.loads(clean)

def chat(debts, plan, history):
    session = get_session()

    context = f"""You are a financial advisor. The user's debts are: {json.dumps(debts)}.
Their current repayment plan recommends the {plan.get('recommendedStrategy','avalanche')} strategy.
They will pay off their debt by {plan.get('payoffDate','unknown')} saving ${plan.get('interestSaved',0)} in interest.
Answer questions using their exact numbers. Be concise and actionable."""

    conversation = "\n".join([
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in history
    ])
    conversation += "\nAssistant:"

    full_prompt = context + "\n\n" + conversation
    return Complete("mistral-large2", full_prompt, session=session)