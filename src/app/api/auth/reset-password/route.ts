import { apiHandler, ok, parseBody } from '@/server/http'
import { clientIp, enforceRateLimit } from '@/server/rate-limit'
import { resetPasswordWithToken } from '@/server/services/auth.service'
import { resetPasswordWithTokenSchema } from '@/server/validation'

/** Sets a new password from an emailed reset link. */
export const POST = apiHandler(async (req) => {
  const ip = clientIp(req.headers)
  if (ip !== 'unknown') await enforceRateLimit(`reset-ip:${ip}`, 30, 15 * 60 * 1000, 'Too many attempts.')
  const result = await resetPasswordWithToken(await parseBody(req, resetPasswordWithTokenSchema))
  return ok({ ...result, message: 'Your password has been reset. Sign in with your new password.' })
})
