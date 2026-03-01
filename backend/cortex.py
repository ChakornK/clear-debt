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
        model='models/gemini-2.5-flash',
        contents=prompt
    )
    clean = response.text.strip().replace('```json', '').replace('```', '').strip()
    return json.loads(clean)

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