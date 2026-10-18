import { apiHandler, ok, parseBody } from '@/server/http'
import { enforceRateLimit } from '@/server/rate-limit'
import { requireAuth, setSessionCookie } from '@/server/session'
import { changePassword } from '@/server/services/auth.service'
import { changePasswordSchema } from '@/server/validation'

/** Changes the signed-in user's password, signs out their other sessions and refreshes this one. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req)
  await enforceRateLimit(`change-password:${ctx.userId}`, 10, 15 * 60 * 1000, 'Too many password change attempts.')

  const session = await changePassword(ctx, await parseBody(req, changePasswordSchema))
  const res = ok(session.body)
  setSessionCookie(res, session.token, session.expiresAt)
  return res
})
