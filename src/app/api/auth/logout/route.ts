import { apiHandler, ok } from '@/server/http'
import { clearSessionCookie } from '@/server/session'

export const POST = apiHandler(async () => {
  const res = ok({ loggedOut: true })
  clearSessionCookie(res)
  return res
})
