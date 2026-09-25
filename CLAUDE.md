# Paisa Pal — AI-Powered Personal Finance Tracker (MERN + AI)

> Master build spec. Place this file as `CLAUDE.md` in the project root and ask Claude Code:
> "Read CLAUDE.md and start Phase 0. After each phase, run tests, update the checklist, and commit."

---

## 0. Instructions for Claude Code (read first)

- Build the project **phase by phase** (Section 12). Do not jump ahead.
- At the end of each checkpoint (Section 12.1): run lint + tests, fix failures, tick the checkboxes in this file, then **STOP**. Do not commit or push — the user pushes to GitHub at each checkpoint and says "continue" to start the next one. Suggested commit message: `feat(cpN): <summary>`.
- Ask before: adding a paid service, changing the stack, deleting data, or changing the database schema after Phase 3.
- Use **plain JavaScript only** (ES modules, `"type": "module"`, `.js` / `.jsx`) on both client and server. **No TypeScript anywhere**: no `.ts`/`.tsx` files, no `tsconfig`, no `typescript`/`tsx`/`@types/*` packages, and no JSDoc type annotations (`@param {type}`, `@typedef`). Use short plain-English comments instead. Validate all runtime data (request bodies, env, LLM output) with Zod.
- Never hardcode secrets. Everything goes through `.env` (keep `.env.example` updated).
- Money is always stored as **integers in paise** (₹250.50 → `25050`). Format only in the UI.
- Every DB query must be scoped by the logged-in `userId`. No exceptions.
- The LLM must **never** access MongoDB directly. It only calls whitelisted tool functions (Section 7.4).
- All AI features must degrade gracefully: if the AI API fails or AI is disabled, the app still works.
- `client/` and `server/` are **fully independent**: each has its own `package.json`, `node_modules`, lock file, ESLint/Prettier configs, `.gitignore` and `.env.example`. Never add tooling or dependencies at the repo root. Run `npm run check` inside each folder.
- **Adding shadcn/ui components:** `npx shadcn add` fails on this machine (npm `allow-scripts` config + registry `cn` import). Instead run `npx shadcn@latest view <name>`, take the source, convert it to `.jsx` (drop types, import `cn` from `@/lib/utils`, `radix-ui` for primitives) and save it in `client/src/components/ui/`. Never install a package named `cn`.
- Client pages are registered in `client/src/lib/navigation.js` (sidebar, mobile nav and router all read it). Replace `PlaceholderPage` in `client/src/router.jsx` as each page is built.
- Onboarding: `RequireAuth` sends users with `onboardingDone: false` to `/onboarding` (outside `AppLayout`). The MSW `testUser` has finished onboarding; pass `renderApp(url, { user })` to test a new user.
- AI capture only returns drafts (`services/capture.service.js`). The client saves them through `POST /transactions` with `source` + `aiConfidence`. Categories come from `ai/categorizer.js#suggestCategories`: MerchantMap memory → keyword rules (`ai/categoryRules.js`, by `systemKey`) → AI batch of ≤50.
- Background jobs live in `server/src/jobs/` as plain async functions (tested directly). `jobs/scheduler.js` runs them with BullMQ when `REDIS_URL` is set, else with in-process timers. Start them with `npm run worker`, or inside the API with `JOBS_IN_API=true` (Render free plan). The recurring runner claims each date by moving `nextDate` first, so two runners never double-add. Insights are fixed-text templates with a `reason` holding the numbers, deduped by `dedupeKey`.
- Deploy: Vercel rewrites `/api/*` to the Render API (`client/vercel.json`), so the refresh cookie is first-party. Set `TRUST_PROXY_HOPS=2` on Render so rate limits see the real IP.
- Edit files with the Edit/Write tools or Node — never PowerShell `Set-Content`/`Get-Content -Raw` round-trips (Windows PowerShell 5.1 corrupts UTF-8 like ₹ and — and adds a BOM).
- API responses: success → `{ success: true, data: {...} }`; errors → the standard error shape (Section 8). Protected routes use `requireAuth` and read the user from `req.user.id`. Validate input with `validate({ body, query, params })` + Zod schemas in `server/src/validators/`.
- Client data: call the API only through `client/src/api/*` (shared axios instance handles tokens + refresh); server state via TanStack Query; errors are `ApiError` with `code`/`message`. Pages are lazy-loaded in `router.jsx`. Client tests fake the API with MSW (`client/src/test/msw.js`).
- Ownership: load user-owned docs with `findOwnedOrThrow(Model, userId, id)` — another user's id returns the same 404 as a missing one. Every new resource adds cases to `server/tests/api/isolation.test.js`.
- Server API tests: `tests/globalSetup.js` starts ONE in-memory MongoDB replica set (transactions need a replica set) for the whole run; `tests/helpers/db.js` gives each test file its own database on it. Create a fresh `createApp()` per test (fresh rate-limit counters). Tests that depend on "today" fake only Date: `vi.useFakeTimers({ toFake: ['Date'] })`.
- Dates: the API accepts a local day (`"2026-09-24"` = start of that day in the user's `timezone`, default Asia/Kolkata) or a full ISO timestamp with offset. `from`/`to` filters are inclusive local days. Helpers in `server/src/utils/dates.js`.
- Every change to transactions goes through `transaction.service.js` (one MongoDB transaction for the row + wallet balances). Never `$inc` a wallet balance anywhere else. `tests/helpers/fixtures.js#expectBalancesConsistent` checks the invariant.
- **Design system (CP9, chosen by the user): emerald + gold, soft aurora background, balanced motion.**
  - Colours are CSS variables in `client/src/styles/index.css` (`--primary` emerald, `--gold`, `--income`/`--expense`). Never hard-code brand colours in components; money colours always come with a +/− sign.
  - Surfaces: use the `surface` utility (glass card) and `glass`; pages sit on `<AuroraBackground />` (already in AppLayout/AuthLayout).
  - Motion: import `m` from `motion/react` (LazyMotion is set up in AppProviders — do not use `motion.div`). Buttons press/shine, cards lift on hover, lists stagger in, money uses `<AnimatedMoney>`. Keep it calm; everything must still work with reduced motion (CSS media query + `MotionConfig reducedMotion="user"`).
  - Copy: short, plain English (e.g. "Money in and money out"). No internal jargon like checkpoint names in the UI.
  - Tests run with reduced motion on (`mockMatchMedia`), and `toast.dismiss()` runs after each test (sonner keeps a global store).
- Receipts: always served through `GET /api/transactions/:id/receipt` (owner only, `Cache-Control: private`); storage drivers in `server/src/storage/` (`local` | `cloudinary` private images). File type is checked from the bytes, max 5 MB; photos are deleted after their transaction is deleted.
- Budget months follow the user's `monthStartDay` (e.g. 25 → "2026-09" = 25 Sep–24 Oct) in their time zone: use `monthRange` / `monthContaining` in `server/src/utils/dates.js`. Budget and goal maths are pure functions (`budget.math.js`, `goal.math.js`) — status compares exact paise, never rounded percentages.
- **Charts** follow the dataviz skill: pick the form first (a ranked bar list, not a pie, for "where did the money go"), one ₹ axis only, a legend for 2+ series, and a screen-reader table for every chart. Series colours are `--chart-in` (emerald) / `--chart-out` (amber), validated colour-blind safe in light and dark with the skill's `validate_palette.js` — the obvious green/red pair FAILS (deutan ΔE 6.4); run the validator again before adding any new series colour. Status (ok/warning/over) always shows an icon + label, never colour alone.
- Bundle: Recharts and its helpers live in the `charts` chunk (`client/vite.config.js`) and load only with pages that draw charts. `includeDependenciesRecursively: false` is required, otherwise a shared helper (e.g. clsx) pulls a whole chunk into the first load. After adding a big library, check `dist/index.html` to see what loads up front.
- Client tests: do not preload pages in the test setup (it doubled the run time); `findBy*` waits up to 10s for a lazy page instead, and `testTimeout` is 20s for whole-page tests. Budgets/goals/reports are faked by `client/src/test/fakePlanning.js`.
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
| Animations | Motion (`motion/react`, formerly Framer Motion) — balanced use, always respects "reduce motion" |
| Backend | Node.js + Express (JavaScript, ES modules) |
| Database | MongoDB Atlas + Mongoose |
| Cache / rate limit / queues | Redis (Upstash) + BullMQ |
| Auth | JWT (access 15 min) + refresh token (7 days, httpOnly cookie, rotated, hashed in DB), bcrypt via `bcryptjs` (pure JS, same hashes — no native build); Google OAuth optional |
| AI (LLM) | Gemini API (default, free tier) via provider adapter; OpenAI / Groq / Ollama (local) as alternatives |
| OCR | LLM vision for receipts; Tesseract.js fallback |
| File storage | Cloudinary |
| Email | Resend (or Nodemailer + SMTP) |
| PDF export | pdfkit (server) |
| CSV | papaparse (client) / csv-parse (server) |
| Security | helmet, cors, express-rate-limit (rate-limit-redis store on its own non-queuing ioredis connection when Redis is ready, in-memory otherwise; `passOnStoreError` lets requests through if Redis drops), own `sanitize` middleware (express-mongo-sanitize does not support Express 5), zod validation |
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
paisa-pal/                    (root holds only docs + .github — no package.json, node_modules or .gitignore)
├── CLAUDE.md
├── README.md
├── .github/workflows/     (server.yml, client.yml — the only non-doc files at root; GitHub requires this location)
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx  App.jsx  router.jsx
│       ├── api/            (axios instance with refresh interceptor, query hooks per feature)
│       ├── components/
│       │   ├── ui/         (shadcn/ui, converted to .jsx — see note below)
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
    ├── docker-compose.yml  (optional: local mongo replica set + redis)
    ├── src/
    │   ├── app.js  server.js  worker.js
    │   ├── config/         (env.js validated with zod, db.js, redis.js, logger.js)
    │   ├── models/
    │   ├── routes/  controllers/  services/
    │   ├── middleware/     (auth, validate, rateLimit, errorHandler, notFound, sanitize)
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
    │   ├── utils/          (money.js, dates.js, ApiError.js)  — no asyncHandler: Express 5 forwards async errors itself
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
`userId (required), name, type: 'income'|'expense', icon (lucide name), color (#hex), parentId? (one level only), systemKey (null for custom), sortOrder, isArchived`
**Decision (CP7):** each user gets their own copy of the defaults on sign-up (created in the same MongoDB transaction as the user). Defaults carry a stable `systemKey` (e.g. `food_dining`) so rules still find them after a rename; they can be archived but not deleted. Names are unique per user + type, case-insensitive.
Defaults: Food & Dining, Groceries, Transport, Fuel, Rent, Utilities, Mobile & Internet, Shopping, Entertainment, Subscriptions, Health, Education, Travel, Personal Care, Gifts, EMI/Loans, Investments, Other; Income: Salary, Freelance, Pocket Money, Refund, Interest, Other Income.

**Transaction**
`userId, walletId, toWalletId? (transfers), type: 'income'|'expense'|'transfer', amount (paise, >0), categoryId?, merchant, merchantKey (normalized lowercase), note, tags[], date, source: 'manual'|'nl'|'sms'|'receipt'|'csv'|'recurring', aiConfidence?, receiptUrl?, recurringId?, isDuplicateFlag`
Indexes: `{userId, date:-1}`, `{userId, categoryId, date}`, `{userId, merchantKey}`.

**MerchantMap** (learning memory for categorizer)
`userId, merchantKey (unique per user), categoryId, hits, lastUsedAt`

**Budget**
`userId, categoryId (null = overall), month ('YYYY-MM'), limit (paise), alertLevels [80,100], alertsSent[], rollover: boolean`

**Goal**
`userId, name, targetAmount, savedAmount, deadline (local date), linkedWalletId?, icon, color, status: 'active'|'done'|'paused', contributions[{amount, date, note}]` — reaching the target sets done; taking money out below it reopens

**RecurringRule**
`userId, template {walletId, toWalletId?, type, amount, categoryId, merchant, note}, frequency: 'daily'|'weekly'|'monthly'|'yearly', interval, startDate, endDate?, nextDate, nextRun, lastRunDate, detectedByAI, active` — dates are local 'YYYY-MM-DD'; every occurrence is counted from startDate (31st → 28 Feb → 31 Mar, no drift)

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
- [x] Register / login / logout / refresh / me (Google login: optional, not built yet)
- [x] Onboarding: currency, month start day, create first wallets, optional CSV import, enable AI
- [x] Wallets: CRUD, archive, balance, transfers
- [x] Categories: defaults + custom (add, rename, hide in Settings)
- [x] Transactions: CRUD, filters (date range, wallet, category, type, tag, amount range, search), pagination, bulk delete/re-categorize
- [x] Receipt image attach (local disk in dev, private Cloudinary images in production)
- [x] Budgets: per category + overall, monthly, progress, alerts at 80%/100%, optional rollover (alert notifications arrive with the worker, CP19)
- [x] Goals: target, deadline, contributions, required-per-month calculation
- [x] Recurring transactions (rent, salary, EMI)
- [x] Dashboard: total balance, month income/expense, savings rate, category breakdown, 6-month trend, recent transactions (CP11) · quick add (CP15) · forecast card, health score card, tips (CP20)
- [x] Reports: monthly/yearly, by category/wallet/merchant, export CSV + PDF
- [x] Settings: profile, currency, AI toggle, digest email toggle, theme, export all data (JSON), delete account

### 6.2 AI features
- [x] **A1 Natural-language quick add** — "spent 250 on biryani with Rahul yesterday from GPay" → prefilled form → confirm
- [x] **A2 SMS parser** — paste one or many bank/UPI SMS → regex first, LLM fallback → review list → confirm
- [x] **A3 Receipt scanner** — photo → LLM vision → amount, merchant, date, items → confirm
- [x] **A4 CSV bank-statement import** — upload → column mapping (auto-detected by AI) → dedupe → auto-categorize → confirm
- [x] **A5 Smart categorizer that learns** — rules → MerchantMap → LLM; user correction updates MerchantMap
- [x] **A6 AI Assistant (chat)** — tool calling over user's data, streamed answers, inline charts, suggested questions
- [x] **A7 Cash-flow forecast** — predicted month-end balance + chart + warning
- [x] **A8 Anomaly alerts** — z-score per category + duplicate charge detection
- [x] **A9 Subscription detector** — recurring merchant detection, yearly cost, "mark as cancelled"
- [x] **A10 Budget autopilot** — suggested budgets from last 3 months
- [x] **A11 Financial health score** — 0–100 with factor breakdown and tips
- [x] **A12 What-if simulator** — "cut food 20%" → effect on savings and goal dates
- [x] **A13 Weekly AI digest** — email + in-app every Monday
- [x] **A14 Explainability** — every insight has a "Why?" showing the numbers used
- [x] **A15 Privacy layer** — PII masking before any LLM call; AI on/off switch

---

## 7. AI design (implementation details)

### 7.1 LLM adapter
**As built (CP14):** each provider (`gemini.js`, `openaiCompatible.js` for OpenAI + Groq, `ollama.js`) only implements `complete({ system, user, image?, json, tier })` over plain `fetch` (no SDKs; `llm/http.js` does timeouts + retries). `adapter.js#generateJSON` is shared by all: it masks PII in `user`, describes the Zod schema to the model, validates, retries once with the problems, then throws `AIParseError`; provider failures become `AIUnavailableError` so callers fall back. No key → no provider → AI features degrade. Tests swap in `tests/helpers/fakeLLM.js#useFakeLLM`. User text always goes in prompts through `prompts/common.js#asData`. `chatWithTools` is added in CP21. Original plan:

Every provider (gemini.js, openai.js, …) exports an object with the same two methods:
```js
// gemini.js (openai.js, groq.js, ollama.js look the same)
export const geminiProvider = {
  // { system, user, schema (Zod), image? } → data already validated by schema
  async generateJSON({ system, user, schema, image }) { /* ... */ },

  // { system, messages, tools } → async generator yielding text chunks and tool calls
  async *chatWithTools({ system, messages, tools }) { /* ... */ },
};
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
auth         POST /auth/register · /auth/login · /auth/refresh · /auth/logout · GET /auth/me · POST /auth/demo (✅ CP25: a fresh sandbox per click from seed/demoUser.js, emails @demo.paisa-pal.invalid, removed after 24 h by jobs/cleanup.job.js) · GET /auth/google (optional)
users        PATCH /users/me (name, currency, monthStartDay, timezone, onboardingDone) · PATCH /users/me/settings (merged per field) (✅ CP13) · GET /users/me/export (JSON download, no secrets) · DELETE /users/me ({password}; removes every collection + receipt files) (✅ CP24)
wallets      GET/POST /wallets · GET/PATCH/DELETE /wallets/:id · POST /wallets/transfer
categories   GET/POST /categories · PATCH/DELETE /categories/:id
transactions GET /transactions (from,to,type,walletId,categoryId,tag,minAmount,maxAmount,q,sort,page,limit → {transactions, totals, pagination}) · POST · GET/PATCH/DELETE /:id · POST /bulk ({action:'delete'|'categorize', ids ≤200, categoryId?}) · POST /:id/receipt
recurring    GET/POST /recurring · PATCH/DELETE /recurring/:id   (each rule has nextDate/nextRun + upcoming: next 3 dates)
budgets      GET /budgets?month= · POST · PATCH/DELETE /:id · GET /budgets/status?month= (→ month, fromDate, toDate, daysLeft, totalSpent, budgets[{budget, spent, effectiveLimit, remaining, percent, status: ok|warning|over, dailyAllowance, rolloverAmount}])
goals        GET/POST /goals · PATCH/DELETE /goals/:id · POST /goals/:id/contribute ({amount: +add / −take out}) — goals include progress {percent, remaining, monthsLeft, requiredPerMonth, overdue}
reports      GET /reports/by-category?from&to&type (✅ CP11, sub-categories rolled into parents) · /reports/trend?months (✅ CP11, per budget month) · /reports/summary · /reports/merchants · /reports/by-wallet · GET /reports/export?format=csv|pdf&from&to (✅ CP12 — CSV is UTF-8 with BOM and formula-injection-safe; PDF prints "Rs." since the built-in fonts lack ₹)
import       POST /import/csv/preview (multipart "statement" ≤10 MB + optional "mapping" JSON {headerIndex, mapping}) → {headerIndex, mapping, headers, sample, needsMapping, dayFirst, rows[{index,line,date,description,merchant,amount,type,categoryId,confidence,via,duplicate}], skipped, usedAI} · POST /import/csv/commit ({walletId, keepBalance=true, rows ≤2000}) → {imported} (✅ CP17: one Mongo transaction in transaction.service#importTransactions; keepBalance moves openingBalance so the balance stays put)
ai           GET /ai/status → {enabled, configured, provider} · POST /ai/parse/text ({text ≤500}) → {draft, usedAI} · /ai/parse/sms ({text ≤20000, ≤50 messages}) → {items[{index,text,status:'ready'|'skipped',reason?,draft?,possibleDuplicate?,via?}], usedAI} (✅ CP15; both work with AI off via plain parsing; 20/min/user) · /ai/parse/receipt (multipart "receipt", needs AI) · /ai/parse/receipt-text ({text} read on the device by Tesseract.js when AI is off) (✅ CP16)
             POST /ai/categorize ({items ≤200}) → {suggestions[{categoryId, confidence, via: memory|rule|ai|null}]} (✅ CP16). Every create/edit/bulk-categorize with a merchant + category updates MerchantMap (not recurring-runner rows)
             GET /ai/forecast · /ai/health-score · /ai/anomalies · /ai/subscriptions (+ PATCH /ai/subscriptions/:id {status: active|ignored|cancelled}) · /ai/budget-suggestions?targetSavingsRate= (✅ CP18: plain maths in ai/analytics/, data loaded by services/analytics.service.js; no AI and no AI rate limit, so they work with AI off)
             POST /ai/what-if
insights     GET /insights?includeDismissed → {insights, unseen} · PATCH /insights/:id (seen/dismissed) · POST /insights/seen ({ids}) · POST /insights/refresh (same work as the nightly job, for this user) (✅ CP20)
chat         GET /chat/sessions · POST /chat/sessions · GET /chat/sessions/:id → {session, messages} · POST /chat/sessions/:id/messages ({content ≤1000}; SSE events text|tool|chart|done|error; 30/hour/user) · DELETE /chat/sessions/:id (✅ CP21: ai/chatAgent.js + ai/tools/index.js; providers stream via chat(); tools add userId server-side, return rupees, mask text; getBalances added to the tool list)
notifications GET /notifications → {notifications, unread} · PATCH /notifications/:id/read · POST /notifications/read-all (✅ CP23: new warn/critical insights ring the bell; jobs/digest.job.js runs Mondays 9 AM IST — in-app for everyone, email via Resend REST when RESEND_API_KEY + EMAIL_FROM are set and digestEmail is on; AI writes a one-line note from the totals, fixed text when AI is off)
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
- **Wallets**, **Budgets** (with "Suggest budgets" AI button), **Goals** (with what-if slider), **Recurring** (`/recurring`: the user's own repeating payments since CP13; AI-detected subscriptions join this page in CP20), **Reports**, **Insights** (with "Why?" expanders), **Assistant** (chat, suggested questions, inline charts), **Settings**.
- Global: dark/light mode, fully responsive, skeleton loaders, empty states with CTAs, toast notifications, keyboard shortcut `N` for new transaction, `/` for search, ₹ formatting with Indian digit grouping (1,00,000).
- Accessibility: labels, focus states, color not the only signal.

---

## 10. Security checklist
- [x] bcrypt (12 rounds); password rules; login rate limit (5/min/IP)
- [x] Refresh token rotation + reuse detection; httpOnly, secure, sameSite cookies
- [x] helmet, strict CORS (client origin only), sanitize middleware, Zod on every body/query/param
- [x] Every query filtered by `userId`; tests prove user A cannot read user B's data
- [x] File upload: type + size limits (5 MB images, 10 MB CSV)
- [x] PII masking before LLM; AI toggle; no raw financial data in logs (LLM logs hold token counts and how many items were masked, never text)
- [x] Secrets only in env; `.env` gitignored (only .env.example files are tracked; npm audit: 0 vulnerabilities in both apps)

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
RECEIPT_STORAGE=local          # local | cloudinary (use cloudinary when deployed)
UPLOAD_DIR=uploads
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
- [x] Express app with helmet, cors, pino, error handler, `/api/health`, env validation with Zod
- [x] Mongo + Redis connections; docker-compose for local mongo/redis (optional)
- [x] Vite React app with Tailwind + shadcn/ui, router, layout shell (sidebar + mobile nav), theme toggle
- [x] GitHub Actions CI (lint, format check, test)

### Phase 1 — Auth
- [x] User + RefreshToken models, register/login/refresh/logout/me
- [x] Auth middleware; login rate limit
- [x] Client: login/register pages, protected routes, axios refresh interceptor, auth store
- [x] API tests for auth

### Phase 2 — Wallets, categories, transactions
- [x] Models + default category seeding on register
- [x] Transaction service with Mongo sessions updating wallet balances; transfers
- [x] Transactions page with filters, pagination, add/edit modal (manual tab), receipt upload
- [x] Tests: balance consistency on create/edit/delete/transfer; user isolation

### Phase 3 — Budgets, goals, recurring, dashboard, reports
- [x] Budgets + status aggregation; Goals + contributions; RecurringRule CRUD
- [x] Dashboard charts and cards; Reports page; CSV + PDF export
- [x] Onboarding flow
- [ ] **Deploy v1** (non-AI tracker working end to end)

### Phase 4 — AI foundation & smart capture
- [x] LLM adapter (Gemini first) + generateJSON with Zod + retries
- [x] PII masker + tests
- [x] A1 NL quick add, A2 SMS parser (regex + LLM), A3 receipt scanner
- [x] A5 categorizer + MerchantMap learning
- [x] A4 CSV import with mapping preview + dedupe

### Phase 5 — Analytics engine & insights
- [x] forecast, anomaly, subscriptions, healthScore, budgetSuggest, whatIf (+ unit tests with fixtures)
- [x] BullMQ worker: nightly insights, recurring runner, budget alerts
- [x] Insights feed + "Why?" explainability; Subscriptions (on the Recurring page); Budget autopilot button; What-if slider on Goals

### Phase 6 — AI assistant
- [x] Tool implementations (user-scoped aggregations) + tests
- [x] Chat agent loop with max 5 tool calls, SSE streaming
- [x] Chat UI: sessions list, streaming messages, inline Recharts, suggested questions

### Phase 7 — Notifications & polish
- [x] Weekly digest email (A13) + in-app notifications
- [x] Empty states, skeletons, keyboard shortcuts (N = new transaction, / = search), mobile polish, Indian number formatting
- [x] Settings: AI toggle, export data, delete account
- [x] Landing page + demo account (seed 6 months realistic Indian data: salary/pocket money, rent, Swiggy, Uber, Netflix, Jio, groceries, one anomaly, one duplicate)

### Phase 8 — Quality & launch
- [x] Playwright E2E: signup → add txn via NL → see dashboard update → ask assistant (client/e2e, `npm run e2e`; server/scripts/e2e-server.js = in-memory Mongo + scripted fake AI; .github/workflows/e2e.yml)
- [x] Swagger docs (/api/docs, /api/openapi.json — generated from the Zod validators in src/docs/openapi.js); security checklist complete
- [ ] Deploy client (Vercel), API + worker (Render/Railway)
- [x] README: architecture diagram (Mermaid), "How the AI works", screenshots (docs/screenshots, `npm run screenshots` in client), setup steps — a demo GIF can be recorded after deploy

### Phase 9+ — Future ideas (see Section 13)

---

## 12.1 Checkpoints (stop → user pushes to GitHub → "continue")

Each checkpoint is a small, working, pushable state. Claude stops after each one.

**Phase 0 — Setup**
- [x] **CP1 Repo skeleton** — independent `client/` + `server/` apps, each with its own `package.json`, JavaScript (ESM), ESLint, Prettier, `.gitignore`, `.env.example`; README stub
- [x] **CP2 Server foundation** — Express + helmet + cors + pino, error handler, notFound, `/api/health`, Zod env validation, Mongo + Redis connections, docker-compose, Vitest + Supertest health test
- [x] **CP3 Client foundation** — Vite + React (JSX), Tailwind + shadcn/ui, React Router, layout shell (sidebar + mobile nav), theme toggle
- [x] **CP4 CI** — GitHub Actions: lint, format check, test for client + server

**Phase 1 — Auth**
- [x] **CP5 Auth backend** — User + RefreshToken models, register/login/refresh/logout/me, auth middleware, login rate limit, API tests
- [x] **CP6 Auth frontend** — login/register pages, auth store, axios refresh interceptor, protected routes

**Phase 2 — Wallets, categories, transactions**
- [x] **CP7 Wallets + categories backend** — models, CRUD, default category seeding on register, tests
- [x] **CP8 Transactions backend** — transaction service with Mongo sessions, transfers, filters/pagination, bulk; balance-consistency + user-isolation tests
- [x] **CP9 Transactions + wallets UI** — Transactions page, filters, pagination, add/edit modal (manual), Wallets page, receipt upload (Cloudinary)

**Phase 3 — Budgets, goals, recurring, dashboard, reports**
- [x] **CP10 Budgets, goals, recurring backend** — CRUD, budget status aggregation, goal contributions, tests
- [x] **CP11 Budgets + goals UI and dashboard** — cards, charts, budget bars, recent transactions
- [x] **CP12 Reports + export** — Reports page, CSV + PDF export
- [ ] **CP13 Onboarding + Deploy v1** — onboarding flow; non-AI tracker live *(built: onboarding wizard, Recurring page, `vercel.json` + README deploy guide, `TRUST_PROXY_HOPS`. Waiting on the user: Atlas, Render and Vercel accounts to go live)*

**Phase 4 — AI foundation & smart capture**
- [x] **CP14 LLM adapter + PII masker** — Gemini provider, generateJSON + Zod + retries, masker + tests
- [x] **CP15 NL quick add + SMS parser** — A1 + A2 (regex + LLM fallback), fixtures + tests, UI tabs
- [x] **CP16 Receipt scanner + categorizer** — A3 + A5 (MerchantMap learning)
- [x] **CP17 CSV import** — A4 mapping preview, dedupe, commit

**Phase 5 — Analytics & insights**
- [x] **CP18 Analytics engine** — forecast, anomaly, subscriptions, healthScore, budgetSuggest, whatIf + unit tests
- [x] **CP19 Worker** — BullMQ: nightly insights, recurring runner, budget alerts
- [x] **CP20 Insights UI** — insights feed + "Why?", Subscriptions page, budget autopilot, what-if slider

**Phase 6 — AI assistant**
- [x] **CP21 Chat backend** — tool implementations + tests, agent loop (max 5 tools), SSE streaming
- [x] **CP22 Chat UI** — sessions, streaming messages, inline charts, suggested questions

**Phase 7 — Notifications & polish**
- [x] **CP23 Digest + notifications** — weekly email (A13), in-app notifications
- [x] **CP24 Polish + settings** — empty states, skeletons, shortcuts, mobile, AI toggle, export, delete account
- [x] **CP25 Landing + demo account** — landing page, 6-month demo seed

**Phase 8 — Quality & launch**
- [x] **CP26 E2E + docs + security** — Playwright, Swagger, security checklist
- [ ] **CP27 Launch** — deploy client + API + worker, final README with screenshots/GIF *(README + screenshots done; deploy waits on the user's Atlas, Render and Vercel accounts — steps in README → Deploying)*

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
