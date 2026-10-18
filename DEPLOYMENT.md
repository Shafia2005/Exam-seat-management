# Deploying SeatGuard

SeatGuard is a Next.js app backed by PostgreSQL. The recommended setup is
**Vercel** for the app and a hosted Postgres database (**Neon** or **Supabase**).
Both have free tiers and serve everything over HTTPS. A Docker setup for a
single server follows at the end.

## Before you go live

- [ ] `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` is `false`. This removes the one-click demo
  buttons and the role switcher.
- [ ] `JWT_SECRET` is a new random value of 48 characters or more. Don't reuse
  your local one.
- [ ] Email (SMTP) is configured. Without it, "Forgot password" and the seating
  notices are only written to the outbox (Settings → Notifications).
- [ ] `APP_URL` is your public `https://` address. Emailed links and the
  hall-ticket QR codes use it.
- [ ] You don't run the demo seed in production. It creates accounts with known
  passwords. Use **Create an organization** (`/register`) instead.

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 1. Create the database

**Neon** (neon.tech) → New project → copy two connection strings:

- the **pooled** one (host contains `-pooler`), for the app
- the **direct** one, for migrations

Supabase works the same way (Project settings → Database): the "Transaction
pooler" string is for the app and the "Direct connection" string is for
migrations. On Supabase, add `?pgbouncer=true&connection_limit=1` to the pooled
string.

## 2. Deploy to Vercel

1. Push this repository to GitHub, GitLab or Bitbucket.
2. Go to vercel.com → **Add New… → Project** and import the repository. The
   framework is detected as Next.js.
3. Under **Environment Variables**, add the values from
   [`.env.production.example`](.env.production.example). At minimum:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled connection string |
   | `MIGRATE_DATABASE_URL` | direct connection string |
   | `JWT_SECRET` | the random secret from above |
   | `APP_URL` | `https://<your-project>.vercel.app` (or your own domain) |
   | `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `false` |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | from your email provider |

4. Click **Deploy**.

Vercel runs `npm run vercel-build`, which generates the Prisma client, applies
any pending migrations (`scripts/migrate-deploy.mjs`) and builds the app. Every
later push to `main` redeploys the same way.

> **Preview deployments.** Builds also run migrations, so scope the database
> variables to **Production** only. Alternatively, give Preview its own Neon
> branch or database.

### Custom domain and HTTPS

Go to Vercel → Project → **Settings → Domains** and add, for example,
`exams.your-college.edu`. Then add the DNS record that Vercel shows at your DNS
provider. Vercel issues and renews the HTTPS certificate automatically. Then:

- Set `APP_URL` to `https://exams.your-college.edu` and redeploy.
- Optionally, enter the domain in SeatGuard under **Settings → Institution →
  Custom domain**. Users on that domain then don't have to type the organization
  code.

### Email and SMS

- **Email**: any SMTP service works, for example Resend, SendGrid, Mailgun,
  Amazon SES, or Google Workspace (`smtp.gmail.com` with an app password). Set
  `SMTP_SECURE=true` only for port 465.
- **SMS** (optional): create a Twilio account and set `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. Phone numbers stored without a
  country code get `SMS_DEFAULT_COUNTRY_CODE` (default `+91`).

Settings → Notifications shows whether each channel is **Live** or **Log only**,
and lists every message that was sent.

## 3. First sign-in

1. Open `https://<your-domain>/register` and create your institution and its
   first super administrator.
2. Settings → Institution: set the minimum attendance and the timezone.
3. Settings → Administrators: invite other administrators.
4. Add departments, courses, blocks and rooms. Then import students and
   teachers from Excel/CSV (Students → **Import**, Teachers → **Import**).

### Demo instance (optional)

To deploy a throw-away demo with the sample data, set
`NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`. Then seed it once from your machine:

```bash
DATABASE_URL="<direct connection string>" npm run db:seed
```

The seed shifts the sample exam dates, so one exam is finished and the other
has a paper today.

## Updating the database schema

Create migrations locally with `npm run db:migrate` and commit them. They are
applied automatically on the next deploy. To apply them by hand:

```bash
DATABASE_URL="<direct connection string>" npx prisma migrate deploy
```

## Docker (single server)

`docker-compose.yml` has an `app` profile that runs PostgreSQL, applies
migrations and starts the production server on port 3000:

```bash
# .env must define JWT_SECRET (and APP_URL / SMTP_* as needed)
docker compose --profile app up -d --build
```

Put a reverse proxy with HTTPS in front of it, for example Caddy
(`caddy reverse-proxy --from exams.your-college.edu --to localhost:3000`) or
nginx with Let's Encrypt. Set `APP_URL` to the `https://` address. Back up the
`pgdata` volume, for example with a nightly `pg_dump`.

To build the image on its own: `docker build -t seatguard .`. It uses Next.js
standalone output and runs as a non-root user.

## Checks

```bash
npm run lint && npm run type-check   # static checks
npm test                             # unit tests
npm run db:seed && npm run dev       # then, in another terminal:
npm run test:smoke                   # end-to-end API checks against the demo data
```

GitHub Actions (`.github/workflows/ci.yml`) runs all of these on every push and
pull request, against a throw-away Postgres.
