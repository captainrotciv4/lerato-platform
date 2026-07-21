# Setup guide — Lerato Platform

> First-run instructions for the multi-organization platform.
> Estimated time: 15 minutes on a clean Windows / macOS machine.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | ≥ 20 LTS | https://nodejs.org/en/download |
| **PostgreSQL** | 16+ | Easiest: run via Docker (below) |
| **Git** | any | https://git-scm.com |

## 1. Install dependencies

From inside the `code/` folder:

```bash
npm install
```

This pulls in Next.js 15, Prisma 5, Auth.js v5, Tailwind, and everything declared in `package.json`. Takes ~2 minutes on a typical connection.

## 2. Start PostgreSQL

**Option A — Docker (recommended for local dev):**

```bash
docker run -d \
  --name lerato-db \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=lerato_dev \
  postgres:16
```

**Option B — native install:** install PostgreSQL 16 directly, create a database called `lerato_dev`, set the postgres password to anything you like.

## 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the bare minimum:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lerato_dev"
AUTH_SECRET="<generate with: openssl rand -base64 32>"
```

You can leave M-PESA, SMS, email, and R2 blank for now — they're only needed when their respective features are exercised.

## 4. Run the database migration

```bash
npx prisma migrate dev --name init
```

This creates every table from `prisma/schema.prisma` — Organization, User, Beneficiary, Donation, Mission, AuditLog, etc.

## 5. Seed initial data

```bash
npx prisma db seed
```

This bootstraps:

- **3 organizations**: Lerato Foundation, Darajani Sports Academy, Agape in Action — each with its own brand colour
- **3 users with hashed passwords** (default: `change-me-on-first-login`):
  - `victor@victormuoki.com` — admin across all three orgs
  - `simon@leratofoundation.org` — admin on Lerato + Darajani
  - `martha@agapeinaction.org` — admin on Agape
- **6 programmes** (Education, Life, Mentorship, Community Dev, Darajani Football, Agape World Cup Engagement)
- **15 Lerato partnerships** (Agape in Action, Christian Family, A Meal A Day, etc. — pulled from leratofoundation.org)
- **1 sample mission** (World Cup Engagement Programme) with the full 7-person delegate roster

## 6. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/sign-in`. Use `victor@victormuoki.com` / `change-me-on-first-login`.

After signing in, you land on `/lerato` (your first accessible org). The top bar has an org switcher — try clicking **Darajani** or **Agape** to see the same shell theme to that organization's brand colour.

## 7. Browse the database visually

```bash
npx prisma studio
```

Opens at http://localhost:5555 — a clean web UI to inspect every table. Click around the seeded data to get a feel for the relationships.

## 8. (Optional) Reset and re-seed

If you want to start fresh:

```bash
npx prisma migrate reset
# Confirms the prompt, then re-runs migrations + seed in one go
```

---

## What's working in v0.1

- ✅ Sign in / sign out
- ✅ Org-aware routing (`/lerato`, `/darajani`, `/agape`)
- ✅ Per-org theming (brand colour pulled from Organization table)
- ✅ Org switcher in top bar
- ✅ Membership-gated access (404 if you visit an org you're not in)
- ✅ Dashboard with KPI tiles + recent beneficiaries
- ✅ Beneficiaries list with search
- ✅ Add Beneficiary form with audit log entry on creation
- ✅ RBAC permission set per role (admin, programme manager, finance, communications, field staff, board observer)
- ✅ Soft delete on beneficiaries (deletedAt) — never lose history

## What's next (Phase 2 remainder + Phase 3)

- [ ] Beneficiary detail page + edit form
- [ ] CSV import tool for migrating existing rosters
- [ ] Donor management (add, list, link donation)
- [ ] Staff & volunteer directory
- [ ] Partner directory with public partnerships visible
- [ ] Programme enrolment UI
- [ ] Attendance capture (will pair with mobile app in Phase 7)

---

## Troubleshooting

**"Can't reach database server"** — confirm Docker is running and port 5432 is free: `docker ps` and `lsof -i :5432`.

**"Invalid email or password"** — passwords were seeded with `change-me-on-first-login`. If you've changed yours, use the new one. If you've forgotten, run `npx prisma migrate reset` and re-seed.

**"Module not found: Can't resolve '@/lib/...'"** — TypeScript path aliases are configured in `tsconfig.json` under `paths`. Restart `npm run dev` to pick up changes.

**Auth.js v5 throws on first request** — set `AUTH_SECRET` in `.env`. Generate with `openssl rand -base64 32`.

---

**Built by:** Victor Muoki · victor@victormuoki.com
**Reference:** VMK-Q-2026-0617
