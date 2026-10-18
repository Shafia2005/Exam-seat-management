# SeatGuard

**Fair seating, guarded exams.** SeatGuard is a multi-tenant, anti-cheating exam seating platform for institutions. It covers student and faculty management, exam scheduling, per-paper seat allocation that keeps same-department students apart, invigilation rosters, exam-day attendance, and verifiable hall tickets.

Going live? See [DEPLOYMENT.md](DEPLOYMENT.md).

## Status

| Layer | Status |
|--------|--------|
| UI (Next.js + TypeScript) | Working |
| Seat allocation algorithms | Working, server-side (anti-cheating + seat map) |
| Database | PostgreSQL via Prisma ORM |
| Auth | bcrypt passwords + JWT in an HttpOnly cookie, role-based route guards |
| Multi-tenancy | Every record is scoped to an organization |

## Features

- **Organizations**: each institution is a tenant. Users sign in with their organization code or slug, or through a subdomain or custom domain. New institutions self-register at `/register`.
- **Settings**:
  - Institution profile and **exam policy**: minimum attendance for eligibility and timezone.
  - **Administrators**: super admins add, edit, deactivate and reset other admins.
  - Departments, courses, blocks and rooms. Room benches are generated from the layout.
  - **Notifications outbox**.
- **Accounts**:
  - Users change their own password from the user menu.
  - "Forgot password?" sends a single-use email link that expires after 30 minutes.
  - Admins reset student and teacher passwords.
  - Every password change signs the user out of their other sessions.
- **Roles**
  - **Admin / Super Admin**: manages students, teachers, exams and rooms, and runs seat and duty allocation.
  - **Teacher**: sees their invigilation duties per paper and takes exam-day attendance in their halls.
  - **Student**: sees their hall and seat for every paper, and downloads the hall ticket PDF with a QR code.
- **Students / Teachers**: list, search, add and edit; manage attendance and eligibility. **Bulk import** from Excel (.xlsx) or CSV, with a downloadable template and a check step before anything is saved.
- **Exams**: create as a draft, publish or cancel; add, edit and remove papers. Published exams move from **scheduled → ongoing → completed automatically by date**, in the institution's timezone.
- **Seat Allocation (USP)**
  - Seating is **per paper**. Seat all papers at once (same seat throughout) or one paper at a time.
  - Algorithms: Anti-Cheating, Department Interleave, Sequential, Random.
  - Candidates are either *everyone matching* the department and semester filters (resolved on the server, so there's no size cap) or a hand-picked list.
  - Students and seats already used by another paper at an overlapping time are excluded.
  - Live seat map coloured by department; same-department neighbour metric; CSV export.
  - **Notify students** by email and/or SMS.
  - Seating is locked once attendance has been taken for that paper.
- **Invigilation**
  - Per-paper rosters. Auto-allocate (fair, inter-departmental, seniority-based) one paper or all papers, or assign manually.
  - Daily duty limits count duties from **every exam on the same day** and are never exceeded automatically. Shortfalls are listed, and a manual override is available.
  - A teacher can't be in two halls at the same time.
  - **Notify invigilators**.
- **Exam-day attendance**
  - Invigilators mark each candidate present or absent from their phone. Attendance opens on the paper's date.
  - Admins can mark any hall.
  - Reports show turnout per paper and hall, plus the list of absentees.
- **Hall tickets**: a PDF with every paper, hall and seat, and a QR code. Scanning it opens a public page that confirms the ticket is genuine.
- **Activity**: a change history of who did what, and when. It covers students, teachers, exams, seating, duties, attendance, settings and accounts.
- **Reports**: overview stats, department eligibility, exam-day attendance, and CSV downloads.
- **Modern UI**: responsive app shell, light/dark/system themes, toasts and confirmation dialogs, and a page title per screen.

## Tech Stack

- Next.js 15 (App Router, Route Handlers, Middleware) + TypeScript
- PostgreSQL 16 + Prisma ORM 6
- `bcryptjs` (password hashing), `jose` (JWT, Edge-compatible), Zod (request validation)
- Zustand (client state)
- Tailwind CSS + Radix UI primitives (`src/components/ui`), lucide icons, Recharts
- `pdf-lib` + `qrcode` (hall tickets), `read-excel-file` (imports), `nodemailer` + Twilio REST (notifications)
- Jest (unit tests), a Node smoke-test script (API end to end), GitHub Actions CI

## Getting Started

Prerequisites: Node.js 18.18+ and either Docker or a PostgreSQL 14+ server.

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # then set JWT_SECRET (see the comment in the file)
npm run db:up               # starts PostgreSQL in Docker (skip if you have your own)
npm run db:deploy           # applies migrations
npm run db:seed             # loads the demo organization
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

Organization: `apex-institute` (or code `APEX`) — *Apex Institute of Technology*

| Role | Sign in with | Password |
|------|--------------|----------|
| Admin | `admin@example.com` | `admin123` |
| Teacher | `teacher@example.com` or employee ID `TCH002` | `teacher123` |
| Student | `student@example.com` or roll number `CS2024001` | `student123` |

All 12 seeded teachers use `teacher123`, and all 120 students use `student123`.

The seed builds a live scenario:

- The mid-semester exam is **completed**.
- The end-semester exam is **ongoing**, with one paper **today**. Exam dates are shifted to the day you seed; set `SEED_KEEP_DATES=true` to keep the original dates.
- Every paper is seated (anti-cheating, rooms CS-101 and CS-102) and has invigilators.
- Past papers already have attendance.
- Today's paper is waiting for the teacher to take attendance.

Re-running `npm run db:seed` rebuilds only the demo organization.

With `NEXT_PUBLIC_ENABLE_DEMO_LOGIN="true"` the login page shows one-click demo sign-in buttons and the header shows a role switcher; both sign in through the real API. Turn this off in production.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Session signing secret, at least 32 random characters |
| `JWT_EXPIRES_IN` | Session lifetime, e.g. `7d`, `12h` (default `7d`) |
| `NEXT_PUBLIC_DEFAULT_ORG_SLUG` | Organization prefilled on the login page |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `"true"` shows demo sign-in shortcuts (must be `"false"` in production) |
| `APP_URL` | Public base URL for emailed links and hall-ticket QR codes |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email delivery. Without `SMTP_HOST`, emails are only logged |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `SMS_DEFAULT_COUNTRY_CODE` | SMS delivery (optional) |
| `MIGRATE_DATABASE_URL` | Direct database URL for migrations during deployment (optional) |

Without email or SMS providers, every message still appears in **Settings → Notifications** and in the server log, so all flows can be demonstrated locally. In development, "Forgot password" also shows the reset link on screen.

## Demo Script (College Presentation)

1. **Admin**: the dashboard shows live stats. Under **Exam Schedule**, the past exam is *completed* and the current one is *ongoing*. The status follows the calendar.
2. **Students → Import**: download the template, fill in a few rows, upload, click **Check file**, then **Import**.
3. **Seat Allocation**:
   1. Pick the ongoing exam and a paper.
   2. Choose **Everyone matching**, then filter by department or semester.
   3. Run **Anti-cheating**.
   4. Show the seat map, the papers table and **Notify students**. Settings → Notifications shows the outbox.
4. **Invigilation**: pick today's paper and show the workload panel. Its counts include every exam that day, and busy teachers are flagged. Then **Auto-allocate** and **Notify invigilators**.
5. **Teacher** (phone-sized window): **My Duties** → **Take attendance** → mark absentees → **Mark remaining present**.
6. **Reports → Exam-day attendance**: turnout per paper and hall, plus the absentee list.
7. **Student** → **My Seat & Hall Ticket**: show each paper's hall and seat, then **Download PDF**. Scan the QR code with a phone to open the verification page.
8. **Activity**: the full change history from the steps above.
9. **Settings → Institution**: raise the minimum attendance and watch eligibility update. Under **Administrators**, add a second admin.

## Architecture

```
prisma/
├── schema.prisma             # Multi-tenant schema (PostgreSQL)
├── migrations/               # SQL migrations
└── seed.ts                   # Demo organization from src/services/mock/data
src/
├── middleware.ts             # Session + role guard for pages and /api
├── app/(auth)/login          # Organization-aware login
├── app/(dashboard)/          # Protected pages
├── app/api/                  # Route handlers (thin: auth → validate → service)
├── app/verify/[token]        # Public hall-ticket verification (QR code target)
├── server/                   # Server-only code
│   ├── services/             # Business logic, always scoped by organizationId
│   ├── allocation/           # Pure seat and duty planning (shared with the seed and unit tests)
│   ├── scheduling/time.ts    # Time slots, overlaps, "today" in the institution timezone
│   ├── notify/               # Email (SMTP) and SMS (Twilio) delivery + outbox
│   ├── audit.ts              # Change-history writer
│   ├── mappers.ts            # Prisma rows → API DTOs (match src/types)
│   ├── validation.ts         # Zod request schemas
│   ├── session.ts            # requireAuth() + session cookie helpers
│   └── http.ts               # Response envelope + error mapping
├── components/ui/            # Design-system primitives (button, dialog, table, …)
├── components/layout/        # App shell: sidebar, top bar, navigation config
├── lib/auth/                 # JWT, password hashing, role rules (shared)
├── lib/api-client.ts         # Browser fetch wrapper
├── lib/toast.ts, confirm.ts  # Global toasts and confirmation dialogs
├── modules/                  # Client services (call /api) + Zustand stores
├── services/mock/data/       # Source JSON for the seed
└── types/                    # Shared TypeScript types (API contracts)
tests/
├── unit/                     # Jest: scheduling, duty planner, seat algorithms, import, validation
└── smoke/api.smoke.mjs       # End-to-end API checks against a running server + demo seed
```

### Security model

- Passwords are hashed with bcrypt (cost 12). Login responses don't reveal whether an account exists.
- The session JWT (`userId`, `role`, `organizationId`) is stored in an HttpOnly, `SameSite=Lax` cookie (`Secure` in production). API clients may send it as `Authorization: Bearer <token>` instead.
- Middleware rejects unauthenticated requests and redirects pages by role: `/dashboard` and management pages for admins, `/my-duties` for teachers, `/my-seat` for students. Admins may open the teacher/student portals to preview any user.
- Every route handler re-checks the user in the database, so deactivating an account or changing a role takes effect immediately, and sessions issued before a password change or reset are rejected.
- Every query is filtered by the session's `organizationId`; IDs from another organization behave as "not found".
- Cross-origin state-changing API requests are rejected. Login, registration, password changes and password-reset requests are rate-limited with counters stored in PostgreSQL, so limits hold across app instances.
- Password-reset links are single-use and expire after 30 minutes. Only a SHA-256 hash of each token is stored, and "forgot password" gives the same answer whether or not the email exists.
- Hall-ticket QR codes carry a signed token with its own audience, so it can never be used as a session. The public verification page shows only what an invigilator needs.
- Teachers can only read and mark attendance in halls where they invigilate that paper.

## API

All responses use `{ success, data, meta }` or `{ success: false, error: { code, message } }`. List endpoints accept `page` and `limit` (max 500) and return `meta.pagination`.

| Method & path | Roles | Purpose |
|---------------|-------|---------|
| `POST /api/auth/login` | public | `{ organization, identifier, password }`; identifier is email, roll number or employee ID |
| `POST /api/auth/register-org` | public | `{ organization: { name, slug, code? }, admin: { firstName, lastName, email, password } }` |
| `POST /api/auth/logout` | public | Clears the session cookie |
| `GET /api/auth/me` | any | Current user, organization, roles and permissions |
| `POST /api/auth/change-password` | any | `{ currentPassword, newPassword }`; signs out other sessions |
| `POST /api/auth/forgot-password` | public | `{ organization, email }`; emails a reset link |
| `POST /api/auth/reset-password` | public | `{ token, password }` |
| `GET, PATCH /api/organization` | any / admin | Institution profile and policy (`minAttendancePercent`, `timezone`); slug and code are fixed |
| `GET, POST /api/admins`; `PATCH /api/admins/:id`; `POST /api/admins/:id/reset-password` | admin (changes: super admin) | Administrator accounts |
| `GET /api/audit-logs` | admin | Change history (`entityType`, `search`) |
| `GET /api/notifications`; `GET /api/notifications/status` | admin | Outbox; whether email/SMS are live |
| `POST /api/students/import`, `/api/teachers/import` | admin | `{ rows, password, validateOnly }` bulk import |
| `GET, POST /api/students` | staff / admin | List (search, department, course, semester, section, status, eligibility, sort) / create |
| `GET, PUT, PATCH, DELETE /api/students/:id` | staff / admin | Read / update / delete |
| `POST /api/students/:id/reset-password` | admin | `{ password? }`; returns `temporaryPassword` when generated |
| `GET, POST /api/teachers` | staff / admin | List (search, department, availability, status) / create |
| `GET, PUT, PATCH, DELETE /api/teachers/:id` | staff / admin | Read / update / delete |
| `POST /api/teachers/:id/reset-password` | admin | `{ password? }`; returns `temporaryPassword` when generated |
| `GET, POST /api/exams` | any / admin | List (drafts hidden from non-admins) / create |
| `GET, PUT, PATCH, DELETE /api/exams/:id` | any / admin | Read / update (incl. publish & cancel via `status`) / delete |
| `POST /api/exams/:id/sessions` | admin | Add a paper |
| `PATCH, DELETE /api/exams/:id/sessions/:sessionId` | admin | Edit / remove a paper |
| `GET, POST /api/departments`, `/api/courses` | staff / admin | Catalog |
| `PATCH, DELETE /api/departments/:id`, `/api/courses/:id` | admin | Edit / delete (refused while in use) |
| `GET, POST /api/blocks`, `/api/rooms`; `GET /api/benches` | staff / admin | Infrastructure (creating a room generates its benches) |
| `PATCH, DELETE /api/blocks/:id`, `/api/rooms/:id` | admin | Edit / delete (rooms used by seating or duties can't be deleted) |
| `GET /api/seats/allocation?examId=&sessionId=` | staff | Seating plans, one per paper |
| `DELETE /api/seats/allocation?examId=&sessionId=` | admin | Clear an exam or one paper |
| `GET /api/seats/summary` | staff | Seat counts per exam and per paper/room |
| `POST /api/seats/allocate` | admin | `{ examId, sessionIds?, studentIds? \| selection?, algorithm, roomIds? }` |
| `POST /api/seats/notify` | admin | `{ examId, channels: ['email','sms'] }` |
| `GET /api/seats/my-seat` | student (admin: `?studentId=`) | Own seats per paper, invigilators, hall-ticket tokens |
| `GET /api/seats/hall-ticket?examId=` | student (admin: `&studentId=`) | Hall ticket PDF |
| `GET /api/duties?sessionId=` | staff | Roster for one paper |
| `POST /api/duties` | admin | `{ sessionId, roomId, teacherId, role, override? }` |
| `DELETE /api/duties?examId=&sessionId=` | admin | Clear an exam or one paper |
| `DELETE /api/duties/:id` | admin | Remove a duty |
| `POST /api/duties/auto-allocate` | admin | `{ examId, sessionIds?, strategy, invigilatorsPerRoom }` → `{ created, sessions, warnings }` |
| `POST /api/duties/notify` | admin | Email/SMS invigilators |
| `GET /api/duties/workload?sessionId=` | staff | Duties per teacher that day (all exams), with `busy` flags |
| `GET /api/duties/my-duties` | teacher (admin: `?teacherId=`) | Own duties with co-invigilators and attendance progress |
| `GET, PUT /api/attendance?sessionId=&roomId=` | staff (teachers: own halls) | Hall sheet / mark `{ marks: [{ allocationId, status }] }` |
| `GET /api/attendance/summary?examId=` | admin | Turnout per paper and hall |

"Staff" means admins and teachers.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run type-check` — TypeScript check
- `npm run lint` — ESLint
- `npm test` — unit tests (Jest)
- `npm run test:smoke` — end-to-end API checks (needs `npm run db:seed` and a running server; pass a base URL to test another host)
- `npm run db:up` — start PostgreSQL in Docker
- `npm run db:migrate` — create/apply a migration after editing `schema.prisma` (development)
- `npm run db:deploy` — apply migrations (production / CI)
- `npm run db:seed` — load the demo organization
- `npm run db:reset` — drop, re-migrate and re-seed the database
- `npm run db:studio` — browse data in Prisma Studio
