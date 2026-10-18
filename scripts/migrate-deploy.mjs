// Applies pending Prisma migrations during a deployment build.
//
// Hosted Postgres providers (Neon, Supabase, …) give a pooled connection string
// for the app and a direct one for schema changes. Set MIGRATE_DATABASE_URL to
// the direct string; DATABASE_URL is used when it is not set.

import { spawnSync } from 'node:child_process'

const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('migrate-deploy: set DATABASE_URL (and optionally MIGRATE_DATABASE_URL) before building.')
  process.exit(1)
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: url },
})
process.exit(result.status ?? 1)
