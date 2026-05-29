# LookAhead Pro

Construction 3-week lookahead scheduling platform. Multi-company, multi-project, role-based access.

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in real values
npx prisma generate
npx prisma db push
npm run db:seed              # creates demo data + 5 demo users
npm run dev                  # http://localhost:3000
```

## Demo Logins

| Name | Email | Password | Role |
|------|-------|----------|------|
| Maria Chen | maria@demo.lookaheadpro.com | demo1234 | Project Manager |
| James Thompson | james@demo.lookaheadpro.com | demo1234 | Superintendent |
| Sarah Kim | sarah@demo.lookaheadpro.com | demo1234 | Engineer |
| Mike Rodriguez | mike@demo.lookaheadpro.com | demo1234 | Subcontractor |
| Pat Davis | pat@demo.lookaheadpro.com | demo1234 | Owner/Viewer |

First-time setup: register at `/register` (only works when 0 users exist), then seed adds demo users to your project.

## Environment Variables

See [.env.example](.env.example) for all required variables.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite (`file:./prisma/dev.db`) or Postgres connection string |
| `NEXTAUTH_SECRET` | JWT signing secret (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev) |
| `ANTHROPIC_API_KEY` | Optional — enables AI analysis features |

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Prisma** (SQLite dev / Postgres production)
- **NextAuth v4** (credentials + JWT)
- **Tailwind CSS** + Lucide icons
- **Role-based access control** with 7-tier permission hierarchy

## Key Features

- Upload Excel lookahead schedules → auto-parse activities
- Conflict detection (trade overlap, location stacking)
- Daily work plans with field actions (status, notes, alerts, date moves)
- 8-tab reporting with CSV export
- Area coordination with crew stacking warnings
- Full audit trail
- Project map and site plans

## Project Structure

```
src/
├── app/
│   ├── api/          # Route handlers (activities, alerts, upload, etc.)
│   └── app/          # UI pages: /app/[companySlug]/projects/[projectSlug]/...
├── components/       # Shared components (ErrorBoundary, etc.)
├── contexts/         # React contexts (CompanyContext)
├── lib/              # Utilities (prisma, auth, access, parser, conflicts)
prisma/
├── schema.prisma     # Data model
├── seed.ts           # Demo data seeder
```

## Deployment

Production target: Vercel + Supabase Postgres.

```bash
# Generate Prisma client for production
npx prisma generate

# Run migrations (production)
npx prisma migrate deploy

# Build
npm run build
```
