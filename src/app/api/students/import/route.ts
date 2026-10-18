import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { importStudents } from '@/server/services/students.service'
import { importSchema } from '@/server/validation'

/** Bulk-creates students from spreadsheet rows; `validateOnly: true` checks without saving. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await importStudents(ctx, await parseBody(req, importSchema)))
})
