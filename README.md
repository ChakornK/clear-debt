# ClearDebt

An intelligent personal finance platform that transforms multi-calendar complexity into actionable debt repayment insights. ClearDebt integrates spending behavior, calendar events, and AI-powered predictions to help users take control of their financial future.

Built using **Google Gemini AI**, **Snowflake**, and **Plaid**.

---

## What It Does

Most debt repayment tools ignore the reality of modern life — that a "Study Group at Coffee Shop" event on your calendar means $25 in spending, or that three social events in one weekend requires proactive budget adjustments. ClearDebt helps users eliminate debt faster by combining real banking data, calendar intelligence, and AI-powered repayment strategies. Instead of generic advice, every recommendation is grounded in the user's actual balances, spending behavior, and upcoming financial events.


**Key innovation:** When you add a calendar event, ClearDebt uses Gemini AI to instantly predict how much you'll spend — before the money leaves your account.

---

## Features
### 1. Multi-Source Debt Aggregation
Connects to real bank accounts via Plaid (credit cards, lines of credit, student loans, auto loans)
Manual debt entry for accounts outside Plaid
All data unified in Snowflake as a single financial profile

### 2. Spending Behavior Analyzer
Reads 90 days of transaction history and surfaces patterns — average monthly spend by category, recurring subscriptions, and seasonal spikes. This output feeds directly into the AI's reasoning when generating your repayment plan.

### 3. Calendar Intelligence Layer
A monthly calendar overlaying debt due dates, paydays, and user-flagged events (tax refund, big expense, bonus). Click any day to add an event. All calendar data gets sent to the AI as context when generating your plan.

### 4. AI Event Spending Predictor 
The core innovation. When you add a calendar event like "Birthday Dinner Downtown" or "Weekend Trip to Niagara Falls", Gemini AI instantly predicts the likely spend, category, and itemized breakdown — before you even think about it.

### 5. AI Repayment Plan
Bundles your debt snapshot, calendar events, and spending behavior into a structured prompt for Gemini AI. Returns a personalized repayment plan showing avalanche vs snowball vs AI-recommended hybrid strategies side by side, with total interest saved and payoff date for each.

### 6. Month-by-Month Timeline
An animated chart showing how your balances shrink over time under the recommended plan. Each bar represents one month, each color segment represents one debt account.

### 7. AI Chat
Persistent chat grounded in your actual debt data. Every message re-injects your full financial context so answers are specific to your situation. Ask hypotheticals like "What if I got a $3k bonus?" or "Should I consolidate?"

### 8. Dashboard
A real-time overview of debt progress, weekly spending analysis, daily cost distribution, spending categories, upcoming calendar events with predicted costs, and milestone alerts.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| Database | Snowflake |
| AI | Google Gemini 2.5 Flash |
| Bank Data | Plaid API |
| Auth | Google OAuth |
| Frontend | TypeScript, React |

---

## Prerequisites

Make sure you have the following installed:

- **Python 3.12+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)

You will also need accounts and API keys for:

- [Snowflake](https://app.snowflake.com) — free 30-day trial available
- [Google AI Studio](https://aistudio.google.com) — for Gemini API key
- [Plaid](https://plaid.com) — sandbox access is free
- [Google Cloud Console](https://console.cloud.google.com) — for OAuth credentials

---

