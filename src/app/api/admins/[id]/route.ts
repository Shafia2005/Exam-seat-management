import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { updateAdmin } from '@/server/services/admins.service'
import { adminUpdateSchema } from '@/server/validation'

type Params = { id: string }

/** Rename, change role, or (de)activate an administrator. Super administrators only. */
export const PATCH = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateAdmin(ctx, params.id, await parseBody(req, adminUpdateSchema)))
})
