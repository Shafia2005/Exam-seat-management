import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { importTeachers } from '@/server/services/teachers.service'
import { importSchema } from '@/server/validation'

/** Bulk-creates teachers from spreadsheet rows; `validateOnly: true` checks without saving. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await importTeachers(ctx, await parseBody(req, importSchema)))
})
