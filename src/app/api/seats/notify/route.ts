import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { notifySeating } from '@/server/services/notifications.service'
import { notifySchema } from '@/server/validation'

/** Emails and/or texts every seated student their seats for an exam. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  const { examId, channels } = await parseBody(req, notifySchema)
  return ok(await notifySeating(ctx, examId, channels))
})
