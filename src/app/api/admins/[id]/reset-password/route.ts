import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { resetAdminPassword } from '@/server/services/admins.service'
import { resetPasswordSchema } from '@/server/validation'

type Params = { id: string }

/** Sets a new password (or generates a temporary one) for another administrator. */
export const POST = apiHandler<Params>(async (req, { params }) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { password } = await parseBody(req, resetPasswordSchema)
  return ok(await resetAdminPassword(ctx, params.id, password))
})
