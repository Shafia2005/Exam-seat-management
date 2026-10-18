import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, paginated, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { listNotifications } from '@/server/services/notifications.service'
import { notificationListQuery } from '@/server/validation'

/** Email/SMS outbox, newest first. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const query = parseQuery(req, notificationListQuery)
  const { rows, total } = await listNotifications(ctx, query)
  return paginated(rows, query.page, query.limit, total)
})
