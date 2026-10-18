import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, ok, parseBody } from '@/server/http'
import { requireAuth } from '@/server/session'
import { autoAllocateDuties } from '@/server/services/duties.service'
import { autoAllocateDutiesSchema } from '@/server/validation'

/** Replaces the duties of the chosen papers (default: every paper) with an automatically generated roster. */
export const POST = apiHandler(async (req) => {
  const ctx = await requireAuth(req, ADMIN_ROLES)
  return ok(await autoAllocateDuties(ctx, await parseBody(req, autoAllocateDutiesSchema)))
})
