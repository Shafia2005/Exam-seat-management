# SeatGuard — Setup Instructions

## Prerequisites

- Node.js 18.18+
- npm
- Docker Desktop (for the bundled PostgreSQL), or your own PostgreSQL 14+ server

> **Keep the project outside OneDrive / Dropbox / iCloud folders** (the Windows Desktop and
> Documents folders are often synced). Sync clients turn the `.next` build files into cloud
> placeholders and Next.js crashes with `EINVAL: invalid argument, readlink …`.
> This project lives in `C:\Projects\exam-seat-management-admin`.

## Install & Run

```bash
cd "C:\Projects\exam-seat-management-admin"
npm install
copy .env.example .env
```

Edit `.env` and set `JWT_SECRET` to a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

If you use your own PostgreSQL server, also change `DATABASE_URL`. Then:

```bash
npm run db:up       # start PostgreSQL in Docker (skip with your own server)
npm run db:deploy   # create the tables
npm run db:seed     # load the demo organization
npm run dev
```

Open http://localhost:3000

### Login

- Organization: `apex-institute` (or `APEX`)
- Admin: `admin@example.com` / `admin123`
- Teacher: `teacher@example.com` / `teacher123`
- Student: `student@example.com` / `student123`

## After pulling changes

Pulling new code can bring database changes. Stop `npm run dev` (Ctrl+C) first, because a running dev server locks the Prisma engine files on Windows. Then run:

```bash
npm install         # also regenerates the Prisma client
npm run db:deploy   # applies new migrations
npm run db:seed     # optional: fresh demo data
npm run dev
```

## Notes

- Data is stored in PostgreSQL and survives restarts. `npm run db:seed` rebuilds the demo organization; `npm run db:reset` rebuilds the whole database.
- The seed shifts exam dates so the demo always has a finished exam and an ongoing one with a paper today.
- The JSON files under `src/services/mock/data/` are only the seed source.
- Email and SMS are optional locally. Without them, messages appear under **Settings → Notifications**, and "Forgot password" shows the reset link on screen.
- Tests: `npm test` runs the unit tests. `npm run test:smoke` runs the end-to-end API checks, which need a running server and fresh seed data.
- Deploying to the internet: see [DEPLOYMENT.md](DEPLOYMENT.md).

### PowerShell execution policy (if npm scripts fail)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or use Command Prompt / Git Bash instead.
