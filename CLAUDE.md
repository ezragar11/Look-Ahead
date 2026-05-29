# LookAhead Pro — Project Instructions

## Stack
- Next.js 14 + TypeScript + Tailwind CSS
- Prisma + PostgreSQL (Supabase)
- NextAuth v4 (credentials + JWT)
- Deployed on Vercel

## Rules
- Do NOT use or write to the Burns & McDonnell OneDrive folder
- Do NOT commit secrets, API keys, database strings, or company data
- Do NOT add new sidebar tabs without explicit approval
- Do NOT rebuild from scratch — improve existing features
- Use soft delete (`deletedAt`) for all entities
- Enforce permissions on the backend, not just UI
- Use demo data only — no real project documents in the repo

## Development
```powershell
Set-Location "C:\Projects\LookAheadPro"
npm run dev
```

## Database
```powershell
npx prisma db push     # sync schema
npx prisma studio      # browse data
npx prisma format      # format schema
```

## Permissions
Claude is allowed to open applications, browsers, and run Node/npm commands without asking.
