# ChatBotAI — Next.js + SQLite (v3 — multi-tenant)

A complete **Next.js (App Router, TypeScript) + SQLite** SaaS chatbot platform — now with a
**super admin**, **subscription plans**, and **Crisp/tawk.to-style modules**. It drops onto any
kind of website: blog, e-commerce, listing/marketplace, SaaS, or a generic custom site.

**No database server to install or manage** — SQLite (via `better-sqlite3`) keeps everything
in a single file (`data/chatbotai.db`) that lives with the project, exactly like the original
Flask + SQLite app.

## What's new in v3

- **Super Admin** — a single privileged account (seeded from `.env`) that creates and owns every
  customer account. Public sign-up is disabled; admins provision accounts at **Admin → Accounts → New**.
- **Subscriptions / packages** — define plans (price, duration, max bots, max messages/month, max
  agents, and which modules they unlock) at **Admin → Plans**, then assign one when creating an
  account. Limits are enforced (bot creation + monthly message quota).
- **Expiry & ban** — set/renew an account's expiry or suspend it. Banned/expired accounts can't log
  in, and their widgets go dark automatically until reactivated.
- **Multi-website ready** — pick a *website type* (blog / e-commerce / listing / SaaS / custom) to
  seed a sensible persona, quick replies and starter Q&As. The widget works on any site.
- **Crisp / tawk.to modules**
  - **Canned replies** — saved agent responses with `!shortcut` autocomplete in the live-chat box.
  - **Proactive triggers** — auto-messages on time-on-page / URL / scroll / exit-intent.
  - **Departments & tags** — organise and route live chats.
  - **Visitor info panel** — referrer, language, timezone, screen, device, current page per chat.

> **Upgrades are non-destructive.** The schema migrates additively (new tables + `ALTER TABLE ADD
> COLUMN`); existing data is never dropped. Just deploy the new code and start the app.

### First run as super admin

1. Set `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` in `.env.local`.
2. Start the app — the super admin is created (or an existing user with that email is promoted).
3. Log in → you land on **/admin**. Create plans, then create customer accounts.

## Features (chatbot core)

- **Auth** — login / logout (JWT in an httpOnly cookie, bcrypt passwords); accounts are admin-created
- **Dashboard** — stats, 30-day message chart, top bots, recent conversations (Chart.js)
- **Bots CRUD** + appearance, persona, modules, allowed-domain whitelist
- **Knowledge base** — nested Q&A decision tree: add/edit/delete, drag-drop reorder & re-parent,
  collapse, bulk show/hide/delete, pagination
- **External APIs** — per-bot live-data endpoints (bearer/header/visitor-token) + test button
- **Auto-train** — scrape a URL (FAQ JSON-LD + readable text + r.jina.ai SPA fallback) → LLM →
  Q&A pairs, or import nested JSON
- **Analytics**, **Conversations** viewer, **Live Chats** (human handoff + agent inbox/chat polling)
- **Contact form** inbox, **SMTP settings** + test (nodemailer), **Notifications** bell with chime
- **Embeddable widget** — the same Shadow-DOM `embed.js` served at `/embed.js`
- **LLM** — HuggingFace router (chat + vision), multilingual greetings, Q&A matcher, website + API grounding

## Requirements

- Node.js 18.18+ (tested on 22)
- That's it. SQLite needs no server. (`better-sqlite3` is a native addon — on a fresh Linux box
  you may need `build-essential python3`; Debian/Windows ship prebuilt binaries.)

## Quick start

```bash
cd nextjs-app
npm install
cp .env.example .env.local      # edit AUTH_SECRET, HF_TOKEN (SQLITE_PATH is optional)
npm run dev                     # http://localhost:3000
```

Open http://localhost:3000 → **Login** as the super admin (from `.env.local`) → create a plan and
then a customer account (which auto-gets a starter bot seeded for its website type). The DB file is
created automatically at `data/chatbotai.db` on first use.

Production:

```bash
npm run build
npm start
```

Check the DB connection any time: `npm run db:check`

## Environment variables (`.env.local`)

| Variable | Purpose |
|---|---|
| `SQLITE_PATH` | DB file path (optional, default `./data/chatbotai.db`) |
| `AUTH_SECRET` | secret for the session JWT cookie (use a long random string) |
| `SUPERADMIN_EMAIL` | super admin login — auto-created/promoted on first start |
| `SUPERADMIN_PASSWORD` | super admin password (change after first login) |
| `APP_BASE_URL` | public URL of this app — used in the embed snippet & uploaded image URLs |
| `HF_TOKEN` | HuggingFace inference token (free) |
| `HF_MODEL` | default text model |
| `HF_PROVIDER` | inference provider routing (`auto`) |

## Architecture

| Concern | File(s) |
|---|---|
| SQLite connection + schema | `src/lib/sqlite.ts` |
| Data access (repository) | `src/lib/repo.ts` (+ types in `src/lib/types.ts`) |
| LLM + scraping | `src/lib/llm.ts`, `src/lib/scrape.ts` |
| Public widget API | `src/app/api/public/bot/[publicId]/*` |
| Admin AJAX API | `src/app/api/{notifications,qa,apis,agent,bots}/*` |
| Form mutations | `src/app/actions/*` (server actions) |
| Pages | `src/app/**/page.tsx` + `src/components/**` |
| Auth | `src/lib/auth.ts`, `src/lib/jwt.ts`, `src/middleware.ts` |
| Roles, plans, quota enforcement | `src/lib/access.ts` |
| Website-type presets | `src/lib/presets.ts` |
| Super admin panel | `src/app/(app)/admin/*`, `src/app/actions/admin.ts` |
| Modules (canned/triggers/departments/tags) | `src/app/(app)/{canned,departments}/*`, `src/components/bot-edit/TriggersSection.tsx`, `src/app/actions/modules.ts` |
| Embeddable widget | `public/embed.js` (served at `/embed.js`) |

### Notes

- Integer primary keys (like the original Flask app). The message PK doubles as the numeric id the
  widget polls with `after_id`.
- Uploaded images go to `public/uploads/` (served at `/uploads/...`). In Docker they persist on a volume.
- **Backup = copy `data/chatbotai.db`.** See DEPLOY.md.
- Deploy to a VPS: see **DEPLOY.md** (Docker one-command, or native PM2 + Nginx + free SSL).
