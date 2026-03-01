from google import genai
from dotenv import load_dotenv
import os, json

load_dotenv()

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

def generate_plan(debts, calendar_events, spending, strategies):
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
    ]) or "No spending data."

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
  "recommendedStrategy": "avalanche" or "snowball" or "hybrid",
  "reasoning": "2-3 sentences referencing specific numbers",
  "priorityOrder": ["debt name 1", "debt name 2"],
  "monthlyExtra": 200,
  "interestSaved": 0,
  "payoffDate": "YYYY-MM",
  "calendarInsights": ["insight 1", "insight 2"]
}}"""

    response = client.models.generate_content(
        model='models/gemini-2.0-flash', # Cheap and fast
        contents=prompt
    )
    clean = response.text.strip().replace('```json', '').replace('```', '').strip()
    return json.loads(clean)

def classify_transactions(categories_list):
    prompt = f"""Map these raw financial categories to ONE of the following bucket names: 
    'Housing', 'Food & Dining', 'Transportation', 'Healthcare', 'Entertainment', 'Shopping', 'Debt Payments', 'Other'.
    
    RAW CATEGORIES: {", ".join(categories_list)}
    
    Return ONLY JSON: {{"raw_category": "bucket_name", ...}}"""

    try:
        response = client.models.generate_content(
            model='models/gemma-3-27b-it',  
            contents=prompt
        )
        clean = response.text.strip().replace('```json', '').replace('```', '').strip()
        return json.loads(clean)
    except Exception as e:
        print(f"Classification error: {e}")
        # Expanded fallback map
        fallback = {}
        rules = {
            'Housing': ['Rent', 'Mortgage', 'Utilities', 'Electric', 'Water', 'Internet', 'Home'],
            'Food & Dining': ['Food', 'Drink', 'Restaurant', 'Dining', 'Grocery', 'Cafe', 'Pizza', 'Coffee'],
            'Transportation': ['Uber', 'Lyft', 'Gas', 'Transport', 'Car', 'Taxi', 'Parking', 'Transit'],
            'Healthcare': ['Health', 'Pharmacy', 'Doctor', 'Hospital', 'Insurance', 'Clinic', 'Dental'],
            'Entertainment': ['Netflix', 'Spotify', 'Movie', 'Game', 'Concert', 'Event', 'Show', 'Stream'],
            'Shopping': ['Amazon', 'Walmart', 'Target', 'Shop', 'Mall', 'Store', 'Gift', 'Clothing'],
            'Debt Payments': ['Credit Card', 'Loan', 'Interest', 'Payment', 'Amex', 'Visa', 'Mastercard']
        }
        for c in categories_list:
            found = False
            for bucket, keywords in rules.items():
                if any(k.lower() in c.lower() for k in keywords):
                    fallback[c] = bucket
                    found = True
                    break
            if not found:
                fallback[c] = 'Other'
        return fallback

def chat(debts, plan, history):
    debt_summary = "\n".join([
        f"- {d['name']}: ${d['balance']} balance, {d['apr']}% APR, ${d['minimum']}/mo minimum"
        for d in debts
    ])

    system_context = f"""You are a financial advisor helping with debt repayment.
The user's debts are:
{debt_summary}

Current plan: {plan.get('recommendedStrategy', 'avalanche')} strategy.
Payoff date: {plan.get('payoffDate', 'unknown')}.
Interest saved: ${plan.get('interestSaved', 0)}.

Answer questions using their exact numbers. Be concise and actionable."""

    conversation = "\n".join([
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in history
    ])

    full_prompt = system_context + "\n\n" + conversation + "\nAssistant:"

    response = client.models.generate_content(
        model='models/gemini-2.5-flash',
        contents=full_prompt
    )
    return response.text

def chat_stream(debts, plan, prefs, events, history):
    """Stream chat responses from Gemini with rich financial context."""
    debt_summary = "\n".join([
        f"- {d['name']}: ${d['balance']} balance, {d['apr']}% APR, ${d['minimum']}/mo minimum"
        for d in debts
    ]) or "No debts found."

    prefs = prefs or {}
    monthly_income = prefs.get('monthly_income') or 0
    monthly_limit = prefs.get('monthly_limit') or 0
    savings_pct = prefs.get('savings_pct') or 20

    budget_summary = (
        f"Monthly net income: ${monthly_income}. "
        f"Monthly non-debt budget: ${monthly_limit}. "
        f"Target savings percentage: {savings_pct}%."
    )

    event_lines = "\n".join([
        f"- {e['date']}: {e.get('type', 'Other')} — {e.get('label', '')} (${e.get('amount', 0)})"
        for e in (events or [])[:15]
    ]) or "No upcoming events on file."

    system_context = f"""You are a financial coach specializing in debt repayment, budgeting, and planning around life events.

DEBTS:
{debt_summary}

BUDGET & PREFERENCES:
{budget_summary}

UPCOMING CALENDAR EVENTS (potential spending):
{event_lines}

CURRENT REPAYMENT PLAN:
- Strategy: {plan.get('recommendedStrategy', 'avalanche or snowball not yet chosen')}
- Estimated payoff date: {plan.get('payoffDate', 'unknown')}
- Estimated interest saved vs minimums-only: ${plan.get('interestSaved', 0)}

GUIDELINES:
- Always ground advice in the user's actual debts, budget, and events above.
- Be concise, specific, and action-oriented.
- When relevant, suggest trade-offs between events, discretionary spend, and extra debt payments.
- Keep responses short (2–5 paragraphs) unless the user explicitly asks for a deep dive."""

    conversation = "\n".join([
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in history
    ])

    full_prompt = system_context + "\n\n" + conversation + "\nAssistant:"

    stream = client.models.generate_content_stream(
        model='models/gemini-2.5-flash',
        contents=full_prompt,
    )

    for chunk in stream:
        text = getattr(chunk, "text", None) or ""
        if text:
            yield text

def predict_event_spend(label: str, date: str):
    prompt = f"""You are a personal finance assistant. A user has added a calendar event called "{label}" on {date}.

Based on the event name, predict the likely spending in CAD.

Respond ONLY with valid JSON, no markdown:
{{
  "predictedAmount": 25,
  "category": "Dining",
  "confidence": "high",
  "explanation": "Coffee shop study sessions typically include beverages and snacks",
  "breakdown": [
    {{"item": "Coffee", "amount": 8}},
    {{"item": "Snack", "amount": 7}}
  ]
}}"""

    response = client.models.generate_content(
        model='models/gemma-3-27b-it',
        contents=prompt
    )
    clean = response.text.strip().replace('```json', '').replace('```', '').strip()
    return json.loads(clean)

def predict_events_batch(events: list):
    event_list = "\n".join([f"- {e['label']} on {e['date']}" for e in events])
    prompt = f"""You are a personal finance assistant. A user has these calendar events from the last 30 days and the next 30 days:
{event_list}

Predict the likely spending in CAD for EACH event. Even if you are unsure, provide a reasonable estimate based on typical costs for such activities (e.g., a coffee catchup is $10-15, a dinner is $40-60, a flight is $200-500). 

For each event, classify the "type" as one of:
'Housing', 'Food & Dining', 'Transportation', 'Healthcare', 'Entertainment', 'Shopping', 'Debt Payments', 'Other'.

Respond ONLY with a JSON array of objects, one for each event in the exact same order:
[
  {{
    "label": "event label",
    "predictedAmount": 25.0,
    "type": "Food & Dining",
    "explanation": "Reasoning for the cost and category"
  }},
  ...
]"""

    response = client.models.generate_content(
        model='models/gemma-3-27b-it', 
        contents=prompt
    )
    clean = response.text.strip().replace('```json', '').replace('```', '').strip()
    return json.loads(clean)