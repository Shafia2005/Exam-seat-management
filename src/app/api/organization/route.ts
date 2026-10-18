import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getOrganization, updateOrganization } from '@/server/services/organization.service'
import { organizationUpdateSchema } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req)
  return ok(await getOrganization(ctx))
})

export const PATCH = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await updateOrganization(ctx, await parseBody(req, organizationUpdateSchema)))
})
