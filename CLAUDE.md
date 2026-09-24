# Paisa Pal — AI-Powered Personal Finance Tracker (MERN + AI)

> Master build spec. Place this file as `CLAUDE.md` in the project root and ask Claude Code:
> "Read CLAUDE.md and start Phase 0. After each phase, run tests, update the checklist, and commit."

---

## 0. Instructions for Claude Code (read first)

- Build the project **phase by phase** (Section 12). Do not jump ahead.
- At the end of each checkpoint (Section 12.1): run lint + tests, fix failures, tick the checkboxes in this file, then **STOP**. Do not commit or push — the user pushes to GitHub at each checkpoint and says "continue" to start the next one. Suggested commit message: `feat(cpN): <summary>`.
- Ask before: adding a paid service, changing the stack, deleting data, or changing the database schema after Phase 3.
- Use **JavaScript** (ES modules, `"type": "module"`) on both client and server — no TypeScript. Document function inputs/outputs with JSDoc; validate all runtime data with Zod.
- Never hardcode secrets. Everything goes through `.env` (keep `.env.example` updated).
- Money is always stored as **integers in paise** (₹250.50 → `25050`). Format only in the UI.
- Every DB query must be scoped by the logged-in `userId`. No exceptions.
- The LLM must **never** access MongoDB directly. It only calls whitelisted tool functions (Section 7.4).
- All AI features must degrade gracefully: if the AI API fails or AI is disabled, the app still works.
- `client/` and `server/` are **fully independent**: each has its own `package.json`, `node_modules`, lock file, ESLint/Prettier configs, `.gitignore` and `.env.example`. Never add tooling or dependencies at the repo root. Run `npm run check` inside each folder.
- Prefer small, readable files. Business logic lives in `services/`, not controllers.
- Write unit tests for every analytics function and parser.

---

## 1. Product summary

**One-liner:** A personal finance tracker where AI does the logging, the categorizing and the forecasting — the user just makes decisions.

**Problem it solves**
1. Logging expenses is tedious → people stop tracking.
2. Categories become messy → reports become useless.
3. Normal trackers only show the past → no warning before overspending.
4. People can't easily ask questions about their own money.

**Solution**
1. Zero-effort capture: natural language, bank/UPI SMS, receipt photo, CSV bank statement.
2. Auto-categorization that learns from the user's corrections.
3. Forecasts, anomaly alerts, subscription detection — before problems happen.
4. A chat assistant that answers questions from the user's real data, with charts.

**Target users:** students, young earners, freelancers, small households (India-first: INR, UPI, Indian bank SMS formats).

---

## 2. Tech stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite (JavaScript / JSX) |
| Styling / UI | Tailwind CSS + shadcn/ui + lucide-react icons |
| Server state | TanStack Query |
| Client state | Zustand |
| Forms / validation | React Hook Form + Zod |
| Charts | Recharts |
| Routing | React Router |
| Animations | Framer Motion (light use) |
| Backend | Node.js + Express (JavaScript, ES modules) |
| Database | MongoDB Atlas + Mongoose |
| Cache / rate limit / queues | Redis (Upstash) + BullMQ |
| Auth | JWT (access 15 min) + refresh token (7 days, httpOnly cookie, rotated, hashed in DB), bcrypt; Google OAuth optional |
| AI (LLM) | Gemini API (default, free tier) via provider adapter; OpenAI / Groq / Ollama (local) as alternatives |
| OCR | LLM vision for receipts; Tesseract.js fallback |
| File storage | Cloudinary |
| Email | Resend (or Nodemailer + SMTP) |
| PDF export | pdfkit (server) |
| CSV | papaparse (client) / csv-parse (server) |
| Security | helmet, cors, express-rate-limit (Redis store), express-mongo-sanitize, zod validation |
| Logging | pino + pino-http |
| Testing | Vitest (unit), Supertest (API), Playwright (E2E), mongodb-memory-server |
| Docs | Swagger / OpenAPI (swagger-ui-express) |
| CI | GitHub Actions (lint, format check, test) |
| Deploy | Vercel (client), Render or Railway (server + worker), MongoDB Atlas, Upstash |
| Optional | Docker + docker-compose for local dev, Sentry for errors, PWA (vite-plugin-pwa) |

---

## 3. Architecture

```
React (Vite) ──HTTPS/JSON + SSE──> Express API ──> MongoDB Atlas
                                      │
                                      ├── services/ (business logic)
                                      ├── ai/
                                      │    ├── llm/ adapter (gemini | openai | groq | ollama)
                                      │    ├── piiMasker
                                      │    ├── parsers/ (nl text, sms regex, receipt, csv)
                                      │    ├── categorizer (rules → merchant memory → LLM)
                                      │    ├── chat agent (tool calling, whitelisted tools)
                                      │    └── analytics/ (forecast, anomaly, subscriptions, healthScore, budgetSuggest, whatIf) — pure JS math
                                      ├── Redis: cache, rate limits, BullMQ
                                      └── worker process: recurring txns, nightly insights, weekly digest, budget alerts
```

**Principle:** LLM for language (understanding text, explaining numbers). Deterministic code for math (forecasts, anomalies, scores). This makes results accurate, testable, cheap and explainable.

---

## 4. Folder structure

```
paisa-pal/                    (root holds only docs — no package.json, node_modules or .gitignore)
├── CLAUDE.md
├── README.md
├── docker-compose.yml            (optional: mongo + redis for local dev)
├── .github/workflows/ci.yml
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx  App.jsx  router.jsx
│       ├── api/            (axios instance with refresh interceptor, query hooks per feature)
│       ├── components/
│       │   ├── ui/         (shadcn)
│       │   ├── charts/     (CategoryPie, TrendLine, ForecastChart, BudgetBar)
│       │   ├── layout/     (Sidebar, Topbar, MobileNav)
│       │   └── common/     (EmptyState, Money, DateRangePicker, ConfirmDialog)
│       ├── features/
│       │   ├── auth/  wallets/  transactions/  categories/  budgets/  goals/
│       │   ├── reports/  insights/  assistant/  quick-add/  import/  settings/  onboarding/
│       ├── pages/          (Landing, Login, Register, Dashboard, Transactions, Wallets,
│       │                    Budgets, Goals, Reports, Subscriptions, Assistant, Insights, Settings)
│       ├── store/          (zustand: ui, filters)
│       ├── lib/            (money.js, dates.js, zod schemas, constants)
│       └── styles/
└── server/
    ├── src/
    │   ├── app.js  server.js  worker.js
    │   ├── config/         (env.js validated with zod, db.js, redis.js, logger.js)
    │   ├── models/
    │   ├── routes/  controllers/  services/
    │   ├── middleware/     (auth, validate, rateLimit, errorHandler, notFound)
    │   ├── ai/
    │   │   ├── llm/        (adapter.js, gemini.js, openai.js, groq.js, ollama.js)
    │   │   ├── prompts/
    │   │   ├── parsers/    (nlParser.js, smsParser.js, receiptParser.js, csvImporter.js)
    │   │   ├── tools/      (chat tool definitions + implementations)
    │   │   ├── analytics/  (forecast.js, anomaly.js, subscriptions.js, healthScore.js,
    │   │   │                budgetSuggest.js, whatIf.js)
    │   │   ├── categorizer.js
    │   │   ├── piiMasker.js
    │   │   └── chatAgent.js
    │   ├── jobs/           (queues.js, recurring.job.js, insights.job.js, digest.job.js, alerts.job.js)
    │   ├── utils/          (money.js, dates.js, ApiError.js, asyncHandler.js)
    │   ├── seed/           (defaultCategories.js, demoUser.js — 6 months realistic data)
    │   └── docs/           (openapi)
    └── tests/              (unit/, api/, fixtures/ incl. sample SMS + CSV)
```

---

## 5. Data models (Mongoose)

All models: `timestamps: true`. All user-owned docs have indexed `userId`.

**User**
`name, email (unique), passwordHash, avatarUrl, currency ('INR'), monthStartDay (1), timezone ('Asia/Kolkata'), settings: { aiEnabled: true, digestEmail: true, budgetAlerts: true, theme }, onboardingDone`

**RefreshToken**
`userId, tokenHash, expiresAt (TTL index), userAgent, revokedAt`

**Wallet**
`userId, name, type: 'cash'|'bank'|'upi'|'card'|'savings'|'other', balance (paise), openingBalance, color, icon, isArchived, creditLimit? (for card)`

**Category**
`userId (null = system default), name, type: 'income'|'expense', icon, color, parentId?, isArchived`
Defaults: Food & Dining, Groceries, Transport, Fuel, Rent, Utilities, Mobile & Internet, Shopping, Entertainment, Subscriptions, Health, Education, Travel, Personal Care, Gifts, EMI/Loans, Investments, Other; Income: Salary, Freelance, Pocket Money, Refund, Interest, Other Income.

**Transaction**
`userId, walletId, toWalletId? (transfers), type: 'income'|'expense'|'transfer', amount (paise, >0), categoryId?, merchant, merchantKey (normalized lowercase), note, tags[], date, source: 'manual'|'nl'|'sms'|'receipt'|'csv'|'recurring', aiConfidence?, receiptUrl?, recurringId?, isDuplicateFlag`
Indexes: `{userId, date:-1}`, `{userId, categoryId, date}`, `{userId, merchantKey}`.

**MerchantMap** (learning memory for categorizer)
`userId, merchantKey (unique per user), categoryId, hits, lastUsedAt`

**Budget**
`userId, categoryId (null = overall), month ('YYYY-MM'), limit (paise), alertLevels [80,100], alertsSent[], rollover: boolean`

**Goal**
`userId, name, targetAmount, savedAmount, deadline, linkedWalletId?, icon, status: 'active'|'done'|'paused'`

**RecurringRule**
`userId, template {walletId, type, amount, categoryId, merchant, note}, frequency: 'daily'|'weekly'|'monthly'|'yearly', interval, nextRun, endDate?, detectedByAI, active`

**Subscription** (detected)
`userId, merchantKey, displayName, avgAmount, periodDays, lastChargedAt, nextExpectedAt, yearlyCost, status: 'active'|'ignored'|'cancelled'`

**Insight**
`userId, type: 'anomaly'|'forecast'|'budget'|'subscription'|'duplicate'|'tip'|'goal', severity: 'info'|'warn'|'critical', title, message, reason (explainability text), data (json), seen, dismissed, dedupeKey (unique per user)`

**ChatSession / ChatMessage**
`ChatSession: userId, title` · `ChatMessage: sessionId, userId, role: 'user'|'assistant'|'tool', content, toolName?, toolArgs?, toolResult?, chart? (json)`

**Notification**
`userId, kind, title, body, link, read`

**Split (future, Phase 10)**
`Group, GroupMember, SharedExpense, Settlement`

**Critical rule:** creating/editing/deleting a Transaction must update Wallet balances inside a **MongoDB session transaction** (Atlas supports it). Transfers debit one wallet and credit another atomically.

---

## 6. Feature list

### 6.1 Core
- [ ] Register / login / logout / refresh / me; Google login (optional)
- [ ] Onboarding: currency, month start day, create first wallets, optional CSV import, enable AI
- [ ] Wallets: CRUD, archive, balance, transfers
- [ ] Categories: defaults + custom, icons/colors
- [ ] Transactions: CRUD, filters (date range, wallet, category, type, tag, amount range, search), pagination, bulk delete/re-categorize
- [ ] Receipt image attach (Cloudinary)
- [ ] Budgets: per category + overall, monthly, progress, alerts at 80%/100%, optional rollover
- [ ] Goals: target, deadline, contributions, required-per-month calculation
- [ ] Recurring transactions (rent, salary, EMI)
- [ ] Dashboard: total balance, month income/expense, savings rate, category pie, 6-month trend, recent transactions, insights feed, forecast card, health score card
- [ ] Reports: monthly/yearly, by category/wallet/merchant, export CSV + PDF
- [ ] Settings: profile, currency, AI toggle, digest email toggle, theme, export all data (JSON), delete account

### 6.2 AI features
- [ ] **A1 Natural-language quick add** — "spent 250 on biryani with Rahul yesterday from GPay" → prefilled form → confirm
- [ ] **A2 SMS parser** — paste one or many bank/UPI SMS → regex first, LLM fallback → review list → confirm
- [ ] **A3 Receipt scanner** — photo → LLM vision → amount, merchant, date, items → confirm
- [ ] **A4 CSV bank-statement import** — upload → column mapping (auto-detected by AI) → dedupe → auto-categorize → confirm
- [ ] **A5 Smart categorizer that learns** — rules → MerchantMap → LLM; user correction updates MerchantMap
- [ ] **A6 AI Assistant (chat)** — tool calling over user's data, streamed answers, inline charts, suggested questions
- [ ] **A7 Cash-flow forecast** — predicted month-end balance + chart + warning
- [ ] **A8 Anomaly alerts** — z-score per category + duplicate charge detection
- [ ] **A9 Subscription detector** — recurring merchant detection, yearly cost, "mark as cancelled"
- [ ] **A10 Budget autopilot** — suggested budgets from last 3 months
- [ ] **A11 Financial health score** — 0–100 with factor breakdown and tips
- [ ] **A12 What-if simulator** — "cut food 20%" → effect on savings and goal dates
- [ ] **A13 Weekly AI digest** — email + in-app every Monday
- [ ] **A14 Explainability** — every insight has a "Why?" showing the numbers used
- [ ] **A15 Privacy layer** — PII masking before any LLM call; AI on/off switch

---

## 7. AI design (implementation details)

### 7.1 LLM adapter
Every provider (gemini.js, openai.js, …) exports an object with the same two methods:
```js
/**
 * @typedef {Object} LLMProvider
 * @property {(opts: { system: string, user: string, schema: import('zod').ZodType, image?: Buffer }) => Promise<any>} generateJSON
 *   Returns data already validated by `schema`.
 * @property {(opts: { system: string, messages: Msg[], tools: ToolDef[] }) => AsyncIterable<ChatEvent>} chatWithTools
 */
```
- Provider chosen by `LLM_PROVIDER` env. Models configured by env (`LLM_MODEL_FAST`, `LLM_MODEL_SMART`).
- `generateJSON`: request JSON output, validate with Zod, retry once with the validation error, else throw `AIParseError`.
- Timeouts (15s), retries with backoff for 429/5xx, token usage logged per user.

### 7.2 PII masker (run before every LLM call)
Mask: account/card numbers (keep last 4 → `XXXX1234`), phone numbers, emails, UPI IDs (keep handle domain), Aadhaar/PAN patterns, OTPs. Unit-test with fixtures.

### 7.3 Parsers
- **nlParser**: prompt includes today's date, user's wallet names and category names; output schema `{ type, amount, merchant, date, categoryName, walletName, note, confidence }`. Relative dates ("yesterday") resolved using user timezone.
- **smsParser**: regex library for common Indian formats (debited/credited, "Rs."/"INR"/"₹", "UPI Ref", "Avl Bal", "spent on card XX1234 at"). Unknown format → LLM. Ignore OTP/promotional SMS.
- **receiptParser**: image → LLM vision → `{ merchant, date, total, tax, items[] }`; Tesseract fallback when AI disabled.
- **csvImporter**: detect columns (date, description, debit, credit, amount, balance) by header names + LLM hint; parse dates in multiple formats; dedupe by (date, amount, normalized description).

### 7.4 Categorizer pipeline
```
normalize merchant → merchantKey
1. MerchantMap(userId, merchantKey) → category (confidence 1.0)
2. Keyword rules (swiggy|zomato → Food; uber|ola|rapido → Transport; netflix|spotify|prime → Subscriptions; ...)
3. LLM (batch up to 50 uncategorized items per call) → category + confidence
On user correction → upsert MerchantMap, increment hits.
```

### 7.5 Chat assistant (tool calling)
System prompt: finance assistant for this user only; use tools for any number; never invent figures; answer in short friendly language with ₹; no specific stock/crypto buy/sell advice (give general education + disclaimer); refuse non-finance tasks politely.

Whitelisted tools (all implementations inject `userId` server-side; the LLM never supplies it):
| Tool | Args |
|---|---|
| `getSpending` | category?, walletId?, from, to, groupBy?: 'day'|'week'|'month'|'category'|'merchant' |
| `getIncome` | from, to, groupBy? |
| `compareSpending` | periodA {from,to}, periodB {from,to}, groupBy |
| `getTopMerchants` | from, to, limit |
| `getBudgetStatus` | month |
| `getGoals` | — |
| `getForecast` | — |
| `getSubscriptions` | — |
| `getHealthScore` | — |
| `searchTransactions` | query, from?, to?, limit ≤ 20 |
| `simulateWhatIf` | changes: [{category, changePercent}] |

Loop: user msg → LLM → tool calls (max 5 per turn) → results → final answer streamed via SSE. If a tool result is chartable, return `chart: {type, data}` so the UI renders Recharts inline. Save history. Suggested prompts: "Where did most of my money go this month?", "Compare food spending with last month", "Can I afford a ₹15,000 phone this month?", "How can I save ₹3,000 more?".

### 7.6 Analytics engine (pure functions, no LLM)
- **forecast.js**: EMA of daily expense (α = 0.3) over current month; `predictedEnd = balance − emaDaily × daysLeft − upcomingRecurring + expectedIncome`. Also project each budget's month-end usage. Output series for chart.
- **anomaly.js**: per category, weekly totals over last 8 weeks → mean, std; `z = (thisWeek − mean)/std`; flag z > 2 and amount > ₹500. Duplicate: same merchantKey + amount within 24h.
- **subscriptions.js**: group by merchantKey; ≥3 charges; amount variance ≤ 10%; interval ≈ 7/30/365 days (±3 days / ±5 days / ±15 days) → subscription with nextExpectedAt and yearlyCost.
- **healthScore.js** (0–100): savings rate 35, budget adherence 25, spending stability (coefficient of variation) 15, goal on-track 15, emergency buffer (savings ÷ avg monthly expense, target 3 months) 10. Return sub-scores + one tip each.
- **budgetSuggest.js**: median of last 3 months per category, trimmed toward a target savings rate (default 20%); needs vs wants split.
- **whatIf.js**: apply % changes to average monthly category spend → new monthly savings → new goal completion dates.

LLM is only used to phrase insight messages (with template fallback when AI is off).

### 7.7 Cost, safety, reliability
- Rate limits: AI routes 20 req/min/user; chat 30 messages/hour/user.
- Cache in Redis: insights (6h), forecast (1h, invalidated on new transaction), chat tool results (5 min).
- Nothing AI-generated is saved without user confirmation (except insights).
- Store `aiConfidence`; show low-confidence items highlighted for review.
- Prompt-injection safety: text from SMS/receipts/CSV is wrapped as data, never as instructions.

---

## 8. API (all under `/api`, JSON, Zod-validated)

```
auth         POST /auth/register · /auth/login · /auth/refresh · /auth/logout · GET /auth/me · GET /auth/google (optional)
users        PATCH /users/me · PATCH /users/me/settings · GET /users/me/export · DELETE /users/me
wallets      GET/POST /wallets · PATCH/DELETE /wallets/:id · POST /wallets/transfer
categories   GET/POST /categories · PATCH/DELETE /categories/:id
transactions GET /transactions (filters, cursor/page) · POST · PATCH/DELETE /:id · POST /bulk · POST /:id/receipt
recurring    GET/POST /recurring · PATCH/DELETE /recurring/:id
budgets      GET /budgets?month= · POST · PATCH/DELETE /:id · GET /budgets/status?month=
goals        GET/POST /goals · PATCH/DELETE /goals/:id · POST /goals/:id/contribute
reports      GET /reports/summary · /reports/by-category · /reports/trend · /reports/merchants · GET /reports/export?format=csv|pdf
import       POST /import/csv/preview · POST /import/csv/commit
ai           POST /ai/parse/text · /ai/parse/sms · /ai/parse/receipt
             POST /ai/categorize (batch)
             GET /ai/forecast · /ai/health-score · /ai/subscriptions · /ai/budget-suggestions
             POST /ai/what-if
insights     GET /insights · PATCH /insights/:id (seen/dismissed)
chat         GET /chat/sessions · POST /chat/sessions · GET /chat/sessions/:id · POST /chat/sessions/:id/messages (SSE stream) · DELETE /chat/sessions/:id
notifications GET /notifications · PATCH /notifications/:id/read
health       GET /health
```
Standard error shape: `{ success: false, error: { code, message, details? } }`.

---

## 9. Frontend pages & UX

- **Landing page** — hero, features (AI capture, assistant, forecast), screenshots, "Try demo account" button.
- **Dashboard** — Quick Add bar at top (natural language input with mic button later), balance cards, forecast card with mini chart, health score ring, budget bars, category pie, trend line, insights feed, recent transactions.
- **Transactions** — table (desktop) / cards (mobile), filters drawer, low-confidence AI rows highlighted, inline category edit (teaches categorizer).
- **Add Transaction modal** — tabs: Manual · Type it · Paste SMS · Scan receipt.
- **Import** — CSV upload → mapping preview → review → commit.
- **Wallets**, **Budgets** (with "Suggest budgets" AI button), **Goals** (with what-if slider), **Subscriptions**, **Reports**, **Insights** (with "Why?" expanders), **Assistant** (chat, suggested questions, inline charts), **Settings**.
- Global: dark/light mode, fully responsive, skeleton loaders, empty states with CTAs, toast notifications, keyboard shortcut `N` for new transaction, `/` for search, ₹ formatting with Indian digit grouping (1,00,000).
- Accessibility: labels, focus states, color not the only signal.

---

## 10. Security checklist
- [ ] bcrypt (12 rounds); password rules; login rate limit (5/min/IP)
- [ ] Refresh token rotation + reuse detection; httpOnly, secure, sameSite cookies
- [ ] helmet, strict CORS (client origin only), mongo-sanitize, Zod on every body/query/param
- [ ] Every query filtered by `userId`; tests prove user A cannot read user B's data
- [ ] File upload: type + size limits (5 MB images, 10 MB CSV)
- [ ] PII masking before LLM; AI toggle; no raw financial data in logs
- [ ] Secrets only in env; `.env` gitignored

---

## 11. Environment variables (`server/.env.example` + `client/.env.example`)
```
# server
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
LLM_PROVIDER=gemini            # gemini | openai | groq | ollama
GEMINI_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL_FAST=
LLM_MODEL_SMART=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# client
VITE_API_URL=http://localhost:5000/api
```

---

## 12. Build phases (tick as completed)

### Phase 0 — Setup
- [x] Monorepo `client/` + `server/`, JavaScript (ESM), ESLint, Prettier, `.gitignore`, `.env.example`
- [ ] Express app with helmet, cors, pino, error handler, `/api/health`, env validation with Zod
- [ ] Mongo + Redis connections; docker-compose for local mongo/redis (optional)
- [ ] Vite React app with Tailwind + shadcn/ui, router, layout shell (sidebar + mobile nav), theme toggle
- [ ] GitHub Actions CI (lint, format check, test)

### Phase 1 — Auth
- [ ] User + RefreshToken models, register/login/refresh/logout/me
- [ ] Auth middleware; login rate limit
- [ ] Client: login/register pages, protected routes, axios refresh interceptor, auth store
- [ ] API tests for auth

### Phase 2 — Wallets, categories, transactions
- [ ] Models + default category seeding on register
- [ ] Transaction service with Mongo sessions updating wallet balances; transfers
- [ ] Transactions page with filters, pagination, add/edit modal (manual tab), receipt upload
- [ ] Tests: balance consistency on create/edit/delete/transfer; user isolation

### Phase 3 — Budgets, goals, recurring, dashboard, reports
- [ ] Budgets + status aggregation; Goals + contributions; RecurringRule CRUD
- [ ] Dashboard charts and cards; Reports page; CSV + PDF export
- [ ] Onboarding flow
- [ ] **Deploy v1** (non-AI tracker working end to end)

### Phase 4 — AI foundation & smart capture
- [ ] LLM adapter (Gemini first) + generateJSON with Zod + retries
- [ ] PII masker + tests
- [ ] A1 NL quick add, A2 SMS parser (regex + LLM), A3 receipt scanner
- [ ] A5 categorizer + MerchantMap learning
- [ ] A4 CSV import with mapping preview + dedupe

### Phase 5 — Analytics engine & insights
- [ ] forecast, anomaly, subscriptions, healthScore, budgetSuggest, whatIf (+ unit tests with fixtures)
- [ ] BullMQ worker: nightly insights, recurring runner, budget alerts
- [ ] Insights feed + "Why?" explainability; Subscriptions page; Budget autopilot button; What-if slider on Goals

### Phase 6 — AI assistant
- [ ] Tool implementations (user-scoped aggregations) + tests
- [ ] Chat agent loop with max 5 tool calls, SSE streaming
- [ ] Chat UI: sessions list, streaming messages, inline Recharts, suggested questions

### Phase 7 — Notifications & polish
- [ ] Weekly digest email (A13) + in-app notifications
- [ ] Empty states, skeletons, keyboard shortcuts, mobile polish, Indian number formatting
- [ ] Settings: AI toggle, export data, delete account
- [ ] Landing page + demo account (seed 6 months realistic Indian data: salary/pocket money, rent, Swiggy, Uber, Netflix, Jio, groceries, one anomaly, one duplicate)

### Phase 8 — Quality & launch
- [ ] Playwright E2E: signup → add txn via NL → see dashboard update → ask assistant
- [ ] Swagger docs; security checklist complete
- [ ] Deploy client (Vercel), API + worker (Render/Railway)
- [ ] README: architecture diagram, "How the AI works", screenshots, demo GIF, setup steps

### Phase 9+ — Future ideas (see Section 13)

---

## 12.1 Checkpoints (stop → user pushes to GitHub → "continue")

Each checkpoint is a small, working, pushable state. Claude stops after each one.

**Phase 0 — Setup**
- [x] **CP1 Repo skeleton** — independent `client/` + `server/` apps, each with its own `package.json`, JavaScript (ESM), ESLint, Prettier, `.gitignore`, `.env.example`; README stub
- [ ] **CP2 Server foundation** — Express + helmet + cors + pino, error handler, notFound, `/api/health`, Zod env validation, Mongo + Redis connections, docker-compose, Vitest + Supertest health test
- [ ] **CP3 Client foundation** — Vite + React (JSX), Tailwind + shadcn/ui, React Router, layout shell (sidebar + mobile nav), theme toggle
- [ ] **CP4 CI** — GitHub Actions: lint, format check, test for client + server

**Phase 1 — Auth**
- [ ] **CP5 Auth backend** — User + RefreshToken models, register/login/refresh/logout/me, auth middleware, login rate limit, API tests
- [ ] **CP6 Auth frontend** — login/register pages, auth store, axios refresh interceptor, protected routes

**Phase 2 — Wallets, categories, transactions**
- [ ] **CP7 Wallets + categories backend** — models, CRUD, default category seeding on register, tests
- [ ] **CP8 Transactions backend** — transaction service with Mongo sessions, transfers, filters/pagination, bulk; balance-consistency + user-isolation tests
- [ ] **CP9 Transactions + wallets UI** — Transactions page, filters, pagination, add/edit modal (manual), Wallets page, receipt upload (Cloudinary)

**Phase 3 — Budgets, goals, recurring, dashboard, reports**
- [ ] **CP10 Budgets, goals, recurring backend** — CRUD, budget status aggregation, goal contributions, tests
- [ ] **CP11 Budgets + goals UI and dashboard** — cards, charts, budget bars, recent transactions
- [ ] **CP12 Reports + export** — Reports page, CSV + PDF export
- [ ] **CP13 Onboarding + Deploy v1** — onboarding flow; non-AI tracker live

**Phase 4 — AI foundation & smart capture**
- [ ] **CP14 LLM adapter + PII masker** — Gemini provider, generateJSON + Zod + retries, masker + tests
- [ ] **CP15 NL quick add + SMS parser** — A1 + A2 (regex + LLM fallback), fixtures + tests, UI tabs
- [ ] **CP16 Receipt scanner + categorizer** — A3 + A5 (MerchantMap learning)
- [ ] **CP17 CSV import** — A4 mapping preview, dedupe, commit

**Phase 5 — Analytics & insights**
- [ ] **CP18 Analytics engine** — forecast, anomaly, subscriptions, healthScore, budgetSuggest, whatIf + unit tests
- [ ] **CP19 Worker** — BullMQ: nightly insights, recurring runner, budget alerts
- [ ] **CP20 Insights UI** — insights feed + "Why?", Subscriptions page, budget autopilot, what-if slider

**Phase 6 — AI assistant**
- [ ] **CP21 Chat backend** — tool implementations + tests, agent loop (max 5 tools), SSE streaming
- [ ] **CP22 Chat UI** — sessions, streaming messages, inline charts, suggested questions

**Phase 7 — Notifications & polish**
- [ ] **CP23 Digest + notifications** — weekly email (A13), in-app notifications
- [ ] **CP24 Polish + settings** — empty states, skeletons, shortcuts, mobile, AI toggle, export, delete account
- [ ] **CP25 Landing + demo account** — landing page, 6-month demo seed

**Phase 8 — Quality & launch**
- [ ] **CP26 E2E + docs + security** — Playwright, Swagger, security checklist
- [ ] **CP27 Launch** — deploy client + API + worker, final README with screenshots/GIF

---

## 13. Future ideas (roadmap)

**Capture**
- Voice entry (Web Speech API → NL parser), Tamil/Hindi input support
- PWA with offline add + sync; Android app via React Native / Expo sharing the API
- Android SMS auto-read (with permission) in the mobile app
- WhatsApp / Telegram bot: "spent 200 petrol" → logged
- Email receipt forwarding (unique inbox address per user)
- Bank sync via India's RBI Account Aggregator framework (through a licensed provider) — automatic transactions

**Intelligence**
- Personalized ML categorizer trained on user corrections (small classifier; Python FastAPI microservice with scikit-learn)
- Better forecasting (Prophet / ARIMA in the Python service) with seasonality (festivals, semester fees)
- Bill & EMI reminders with due-date prediction
- "Smart nudges": payday saving suggestion, weekend spending warnings
- AI monthly report card (PDF) with story-style summary
- Tax helper: track 80C/80D-type deductions, export for filing (informational only)
- Local/private mode using Ollama so no data leaves the machine
- RAG over the user's own notes and receipts ("what did I buy at DMart in July?")

**Social & family**
- Split expenses & groups (Splitwise-style) with settle-up
- Shared family/household wallets with roles (owner, member, viewer)
- Couples/roommates shared budgets

**Money growth**
- Net-worth tracking (assets, loans), investment portfolio tracking (manual entries / CSV), SIP tracker
- Debt payoff planner (snowball vs avalanche)
- Savings challenges & gamification (streaks, badges, 52-week challenge)

**Platform**
- Multi-currency with live exchange rates (travel mode)
- Public API + webhooks; Zapier-style integrations
- Admin dashboard (usage, AI cost per user)
- Two-factor authentication, device management
- Internationalization (English, Tamil, Hindi)

---

## 14. Demo script (3 minutes)
1. Log in to the demo account → dashboard with forecast + health score.
2. Type "paid 1200 electricity bill from HDFC" → confirm → dashboard updates.
3. Paste a bank SMS → parsed; upload a receipt → parsed.
4. Open an anomaly insight → click "Why?" → see the numbers.
5. Subscriptions page → "₹7,800/year on subscriptions".
6. Assistant: "Compare my food spending this month vs last month" → answer + chart.
7. Goals → what-if slider: "cut food 20%" → goal reached 2 months earlier.

## 15. Interview talking points
- LLM never touches the DB → tool calling with user-scoped functions (security + accuracy).
- Hybrid AI: regex/rules → learned merchant memory → LLM (cheaper and smarter over time).
- Math done by deterministic code, not the LLM (LLMs are unreliable at arithmetic; this is testable and explainable).
- Money in integer paise; Mongo transactions for atomic balance updates.
- Privacy: PII masking, AI toggle, per-user isolation tests.
- Graceful degradation: app works fully with AI off.
