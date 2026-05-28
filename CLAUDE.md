# LookAhead Pro — Project Instructions

## Project Location
- **App:** `C:\Projects\LookAheadPro`
- **Excel sample file:** `C:\Users\emottern\Downloads\Watson 3wk Look Ahead 5.20.2026.xlsx`
- **DO NOT** use or write to the Burns & McDonnell OneDrive folder

## Running the App
```powershell
Set-Location "C:\Projects\LookAheadPro"
$env:DATABASE_URL = "file:./prisma/dev.db"
node node_modules\next\dist\bin\next dev
```
Then open: http://localhost:3000

## Stack
- Next.js 14 + TypeScript + Tailwind CSS
- Prisma + SQLite (`prisma/dev.db`)
- xlsx for Excel parsing

## Permissions
Claude is allowed to open applications, browsers, Excel, and run Node/npm commands without asking.
