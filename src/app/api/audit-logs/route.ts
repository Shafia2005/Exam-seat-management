import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, paginated, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { listAuditLogs } from '@/server/services/admins.service'
import { auditListQuery } from '@/server/validation'

/** Change history, newest first. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const query = parseQuery(req, auditListQuery)
  const { rows, total } = await listAuditLogs(ctx, query)
  return paginated(rows, query.page, query.limit, total)
})
