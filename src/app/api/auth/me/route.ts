import { apiHandler, ok } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getCurrentUser } from '@/server/services/auth.service'

export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req)
  return ok(await getCurrentUser(ctx))
})
