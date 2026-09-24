# Paisa Pal

**AI-powered personal finance tracker** — AI does the logging, categorizing and forecasting; you just make decisions.

Built with React (JavaScript), Node.js + Express, MongoDB and the Gemini API. India-first: INR, UPI and Indian bank SMS formats.

> 🚧 Work in progress. See [`CLAUDE.md`](./CLAUDE.md) for the full build plan and checkpoints.

## Planned features

- **Zero-effort capture** — type "spent 250 on biryani yesterday", paste bank SMS, scan receipts, import CSV statements
- **Smart categorizer** that learns from your corrections
- **Forecasts & alerts** — month-end balance prediction, anomaly detection, subscription finder
- **AI assistant** — ask questions about your own money and get answers with charts
- **Privacy first** — PII masking before any AI call, and a switch to turn AI off completely

## Project structure

```
paisa-pal/
├── client/   React + Vite (JSX)       (own package.json, configs, .gitignore)
└── server/   Express API (JavaScript) (own package.json, configs, .gitignore)
```

`client/` and `server/` are fully independent — install and run each one inside its own folder.

## Getting started

Requires Node.js 22.9+.

### 1. API (`server/`)

```bash
cd server
npm install
cp .env.example .env
```

Set `MONGODB_URI` in `server/.env` — either:

- **MongoDB Atlas (free, no install):** create an M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas), then paste its `mongodb+srv://...` connection string, or
- **Docker:** run `npm run db:up` (local MongoDB replica set + Redis) and keep the default URI.

`REDIS_URL` is optional — leave it empty to run without Redis, or use a free [Upstash](https://upstash.com) `rediss://...` URL.

```bash
npm run dev        # http://localhost:5000/api/health
```

### 2. Web app (`client/`)

```bash
cd client
npm install
cp .env.example .env
npm run dev        # http://localhost:5173
```

Built with React 19, Vite, Tailwind CSS v4, shadcn/ui (Radix), React Router and Zustand.
Light / dark / system theme, desktop sidebar and a mobile bottom tab bar.

### Scripts

Run these inside `server/` or `client/`:

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run lint`      | ESLint                              |
| `npm run format`    | Format code (Prettier)              |
| `npm test`          | Unit tests (Vitest)                 |
| `npm run check`     | All of the above — run before a push |
