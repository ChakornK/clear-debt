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
Overlays debt due dates, income events, and planned expenses on a monthly calendar
Detects cash flow conflicts when debt payments and large expenses fall in the same week
Calculates the optimal window to make extra debt payments (after income arrives, before next due date)
Flags months where total outgoing payments exceed expected income

### 4. AI Event Spending Predictor 
The core innovation. When you add a calendar event like "Birthday Dinner Downtown" or "Weekend Trip to Niagara Falls", Gemini AI instantly predicts the likely spend, category, and itemized breakdown — before you even think about it.

### 5. AI Repayment Plan (Snowflake Cortex)
Compares Debt Avalanche (highest APR first) vs Debt Snowball (smallest balance first)
Generates a personalized hybrid strategy using Snowflake Cortex (Mistral Large 2)
Factors in calendar events and spending behavior — not just interest rates
Shows total interest saved, payoff date, and month-by-month balance breakdown

### 6. Month-by-Month Timeline
An animated chart showing how your balances shrink over time under the recommended plan. Each bar represents one month, each color segment represents one debt account.

### 7. AI Financial Chat (Gemini)
Context-aware chat grounded in the user's actual debt data and repayment plan
Handles hypotheticals: "What if I got a $3k bonus?" or "Should I consolidate?"
Full conversation history re-injected on every message for continuity

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

## Running Locally

In the root folder, install all dependencies:

```shell
yarn install
```

To run in dev mode:

```shell
yarn dev
```

To build and start the app:

```shell
yarn build
yarn start
```

---