import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()

genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

def chat_with_gemini(debts, plan, history, user_message):
    model = genai.GenerativeModel('gemma-3-27b-it')

    # Build debt context
    debt_summary = "\n".join([
        f"- {d['name']}: ${d['balance']} balance at {d['apr']}% APR, "
        f"${d['minimum']}/mo minimum, due day {d['due']}"
        for d in debts
    ]) or "No debts on file."

    total_debt = sum(d['balance'] for d in debts)
    highest_apr = max(debts, key=lambda d: d['apr']) if debts else None

    # Build plan context
    plan_summary = f"""Recommended strategy: {plan.get('recommendedStrategy', 'not generated')}
Payoff date: {plan.get('payoffDate', 'unknown')}
Interest saved vs minimum only: ${plan.get('interestSaved', 0)}
Priority payoff order: {', '.join(plan.get('priorityOrder', []))}
AI reasoning: {plan.get('reasoning', 'none')}""" if plan else "No repayment plan generated yet."

    # System prompt with full debt context injected
    system_prompt = f"""You are a knowledgeable and friendly financial advisor specializing in debt repayment optimization.

You have full context of the user's financial situation. Always reference their actual numbers when answering.

USER'S DEBT PROFILE:
{debt_summary}

Total debt: ${total_debt:,.2f}
Highest APR debt: {f"{highest_apr['name']} at {highest_apr['apr']}%" if highest_apr else "none"}

CURRENT REPAYMENT PLAN:
{plan_summary}

INSTRUCTIONS:
- Always use the user's actual debt numbers in your answers
- For what-if scenarios (bonus, extra payment, consolidation), calculate approximate outcomes
- Be concise, specific, and actionable
- If asked about consolidation, compare the blended rate vs current weighted average APR
- If asked about a bonus or windfall, recommend which debt to target first based on their profile
- Never give generic advice — always tie it back to their specific debts
- BE EXTREMELY CONCISE"""

    # Build conversation history for Gemini
    gemini_history = []
    for msg in history:
        role = "user" if msg['role'] == 'user' else "model"
        gemini_history.append({
            "role": role,
            "parts": [msg['content']]
        })

    # Start chat with history
    chat = model.start_chat(history=gemini_history)

    # Send message with system context prepended on first message
    full_message = f"{system_prompt}\n\nUser question: {user_message}" if not history else user_message

    response = chat.send_message(full_message)
    return response.text