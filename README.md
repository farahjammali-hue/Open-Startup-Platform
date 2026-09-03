# Open Startup — All-in-One Platform

The central program-management platform for Open Startup: startup onboarding,
program tools (Contract & KYS, Data Room, Mentorship, Training, Office Hours,
Open Startup School), KPI reporting, and an admin console — all in one app.

Data is persisted to **Postgres** so everything is live and editable.

## Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind (brand tokens + Montserrat), Wouter, TanStack Query
- **Backend:** Express + TypeScript, Drizzle ORM, Passport (Google OAuth), bcrypt, PostgreSQL sessions
- **Database:** PostgreSQL (Neon serverless driver)

Brand: primary `#1d2853`, secondary `#469BE2`, white background, Montserrat.

## Project layout

```
client/        React app (pages, components, lib)
server/        Express API (auth, routes, storage, db)
shared/        Drizzle schema + Zod validation (shared types)
deploy/        Docker/VPS deployment config (see deploy/README.md)
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create your `.env`** (copy the example and fill in values)

   ```bash
   cp .env.example .env
   ```

   | Variable | What it is |
   |---|---|
   | `DATABASE_URL` | Postgres connection string (Neon or any Postgres). Required. |
   | `SESSION_SECRET` | Long random string for signing session cookies. |
   | `APP_URL` | Public base URL, e.g. `http://localhost:5000`. Used for the OAuth callback. |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud → APIs & Services → Credentials. Optional — email/password works without it. |
   | `SMTP_*` | Google Workspace SMTP, for verification/notification emails. Optional in dev. |
   | `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v2, for signup. Optional in dev. |
   | `ADMIN_EMAILS` | Comma-separated emails granted admin access. |
   | `ZOOM_*` | Server-to-Server OAuth app, for Mentorship/Training recording sync. Optional — leave blank to disable. |
   | `PORT` | Defaults to `5000`. |

   Everything marked optional degrades gracefully when left blank — the app
   just disables that one feature (e.g. no Google button, no Zoom recording sync).

3. **Set up Google OAuth** (optional — for the "Continue with Google" button)
   - Google Cloud Console → **Credentials** → **Create credentials → OAuth client ID** → *Web application*.
   - Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
     (and your production `{APP_URL}/api/auth/google/callback`).
   - Paste the client ID/secret into `.env`.

4. **Create the database schema**

   ```bash
   npm run db:push      # creates every table from shared/schema.ts
   npm run db:migrate    # applies incremental data fixes/migrations on top
   npm run db:seed       # optional: Open Startup School catalogue + starter office-hours slots
   ```

5. **Run it**

   ```bash
   npm run dev        # http://localhost:5000  (API + client on one port)
   ```

   For production:

   ```bash
   npm run build && npm start
   ```

   See `deploy/README.md` for a Docker/VPS deployment walkthrough.

## Other useful commands

```bash
npm run check       # TypeScript type-check, no build
npm test            # run the test suite (Vitest)
```

## Onboarding flow

1. **Login** — register or sign in with email/password, or Continue with Google.
2. **Role select** — only **Startup** is selectable now; Mentor and Investor are
   shown as "Soon".
3. **Basics** — startup name (required) + website.
4. **Profile** — company info: short description, location, markets, stage,
   links (website/LinkedIn required, social links optional), product/team
   videos, and pitch deck.
5. **Dashboard** — from here, founders complete Contract & KYS to unlock the
   rest of the platform (Dashboard, Data Room, Mentorship, Training).

A user is routed automatically to the right step based on
`users.onboarding_status` (`needs_role → needs_profile → complete`).

## Program modules

- **Contract & KYS** — the startup signs the program agreement externally and
  uploads the signed PDF, then submits a Know Your Startup profile; both are
  admin-reviewed (approve/reject with notes).
- **Dashboard** — startup profile, KPI collection, monthly updates, team roster.
- **Data Room** — a link to the startup's own external data room, with
  a manual "mark as updated" signal for admins.
- **Mentorship** — a flat list of program sessions (join links, recordings,
  transcripts, materials), an assigned mentor's profile, and a browsable
  "Other experts" catalog founders can rate by priority.
- **Training** — a parallel module to Mentorship (its own sessions, trainer,
  and homework tracking).
- **Office Hours** — book time with the OST team.
- **Open Startup School** — a curriculum of trainings that unlock over time.
- **Admin console** — review queues for Contracts/KYS, a full startup
  directory and detail view, KPI/monthly-update oversight, team rosters,
  and management screens for Mentorship/Training/Experts content.

## Data model

- **users** — identity + auth (local/google), role, onboarding status.
- **startups** — one per user; company profile, links, KYS/contract status,
  KPI history, and links out to every module above.
- **session** — server-side session store (connect-pg-simple).

See `shared/schema.ts` for the full table/column reference — it's the single
source of truth for the data model, kept in sync with `server/migrate.mjs`.

## Notes / next steps

- **Deck upload** currently takes a shareable link. Wiring real file upload
  (object storage, 30 MB cap, PDF/PPT/PPTX) is a clean follow-up.
- Zoom integration currently handles recording/transcript sync for Mentorship
  sessions; extending the same to Training is a natural next step.
