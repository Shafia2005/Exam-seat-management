import { apiHandler, ok, parseBody } from '@/server/http'
import { clientIp, enforceRateLimit, resetRateLimit } from '@/server/rate-limit'
import { setSessionCookie } from '@/server/session'
import { login } from '@/server/services/auth.service'
import { loginSchema } from '@/server/validation'

const WINDOW_MS = 15 * 60 * 1000
// Per account: the main brute-force guard. Keyed without the IP, which clients can spoof.
const MAX_ATTEMPTS_PER_ACCOUNT = 10
// Per IP: a loose password-spraying guard, high enough for a campus behind one NAT address.
const MAX_ATTEMPTS_PER_IP = 1000
const MESSAGE = 'Too many sign-in attempts.'

export const POST = apiHandler(async (req) => {
  const input = await parseBody(req, loginSchema)

  const ip = clientIp(req.headers)
  if (ip !== 'unknown') await enforceRateLimit(`login-ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_MS, MESSAGE)
  const accountKey = `login:${(input.organization ?? req.headers.get('host') ?? '').toLowerCase()}:${input.identifier.toLowerCase()}`
  await enforceRateLimit(accountKey, MAX_ATTEMPTS_PER_ACCOUNT, WINDOW_MS, MESSAGE)

  const session = await login(input, req.headers.get('host'))
  await resetRateLimit(accountKey)

  const res = ok(session.body)
  setSessionCookie(res, session.token, session.expiresAt)
  return res
})
