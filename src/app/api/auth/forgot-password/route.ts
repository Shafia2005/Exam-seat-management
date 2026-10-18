import { apiHandler, ok, parseBody } from '@/server/http'
import { clientIp, enforceRateLimit } from '@/server/rate-limit'
import { requestPasswordReset } from '@/server/services/auth.service'
import { forgotPasswordSchema } from '@/server/validation'

const WINDOW_MS = 15 * 60 * 1000
const MESSAGE = 'Too many reset requests.'

/** Emails a reset link when an account matches. The response never says whether one does. */
export const POST = apiHandler(async (req) => {
  const input = await parseBody(req, forgotPasswordSchema)
  const ip = clientIp(req.headers)
  if (ip !== 'unknown') await enforceRateLimit(`forgot-ip:${ip}`, 30, WINDOW_MS, MESSAGE)
  const org = (input.organization ?? req.headers.get('host') ?? '').toLowerCase()
  await enforceRateLimit(`forgot:${org}:${input.email}`, 3, WINDOW_MS, MESSAGE)

  const { devResetUrl } = await requestPasswordReset(input, req.headers.get('host'))
  return ok({
    message: 'If an account with that email exists, we have sent a link to reset the password. It expires in 30 minutes.',
    ...(devResetUrl ? { devResetUrl } : {}),
  })
})
