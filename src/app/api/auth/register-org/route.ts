import { apiHandler, created, parseBody } from '@/server/http'
import { clientIp, enforceRateLimit } from '@/server/rate-limit'
import { setSessionCookie } from '@/server/session'
import { registerOrganization } from '@/server/services/auth.service'
import { registerOrgSchema } from '@/server/validation'

const MAX_REGISTRATIONS_PER_HOUR = 5

/** Creates an organization and its first super-admin, and signs that admin in. */
export const POST = apiHandler(async (req) => {
  await enforceRateLimit(
    `register-org:${clientIp(req.headers)}`,
    MAX_REGISTRATIONS_PER_HOUR,
    60 * 60 * 1000,
    'Too many organizations registered from this network.'
  )

  const session = await registerOrganization(await parseBody(req, registerOrgSchema))
  const res = created(session.body)
  setSessionCookie(res, session.token, session.expiresAt)
  return res
})
