import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok } from '@/server/http'
import { requireAuth } from '@/server/session'
import { getDeliveryStatus } from '@/server/services/notifications.service'

/** Whether email and SMS providers are configured, or messages are only logged. */
export const GET = apiHandler(async (req) => {
  await requireAuth(req, ADMIN_ROLES)
  return ok(getDeliveryStatus())
})
