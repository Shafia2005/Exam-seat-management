import { STAFF_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { listBenches } from '@/server/services/infrastructure.service'
import { benchListQuery } from '@/server/validation'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, STAFF_ROLES)
  return ok(await listBenches(ctx, parseQuery(req, benchListQuery)))
})
