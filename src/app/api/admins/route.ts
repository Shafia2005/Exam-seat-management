import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, created, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { createAdmin, listAdmins } from '@/server/services/admins.service'
import { adminCreateSchema } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await listAdmins(ctx))
})

/** Super administrators only. A temporary password is generated when none is given. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { admin, temporaryPassword } = await createAdmin(ctx, await parseBody(req, adminCreateSchema))
  return created(admin, temporaryPassword ? { temporaryPassword } : undefined)
})
