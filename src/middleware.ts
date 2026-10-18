import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, getRequestToken, verifySessionToken } from '@/lib/auth/jwt'
import { PUBLIC_API_ROUTES, ROLE_HOME, rolesForPage } from '@/lib/auth/roles'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite cookies). */
function isCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // API routes: handlers do the full (database-backed) check; this is a fast first gate.
  if (pathname.startsWith('/api/')) {
    if (!SAFE_METHODS.has(req.method) && isCrossOrigin(req)) {
      return apiError(403, 'CROSS_ORIGIN_REJECTED', 'Cross-origin requests are not allowed')
    }
    if (PUBLIC_API_ROUTES.includes(pathname)) return NextResponse.next()
    const session = await verifySessionToken(getRequestToken(req))
    if (!session) return apiError(401, 'UNAUTHORIZED', 'Authentication required')
    return NextResponse.next()
  }

  // Dashboard pages: require a session and a role that may open the page.
  const allowedRoles = rolesForPage(pathname)
  if (!allowedRoles) return NextResponse.next()

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    const res = NextResponse.redirect(loginUrl)
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE)
    return res
  }

  if (!allowedRoles.includes(session.role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/students/:path*',
    '/teachers/:path*',
    '/exams/:path*',
    '/seat-allocation/:path*',
    '/teacher-allocation/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/my-duties/:path*',
    '/my-seat/:path*',
    '/attendance/:path*',
    '/activity/:path*',
  ],
}
