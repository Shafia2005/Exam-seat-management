import type { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, getRequestToken, verifySessionToken } from '@/lib/auth/jwt'
import { forbidden, unauthorized } from './http'

export interface AuthContext {
  userId: string
  /** "First Last", recorded on audit log entries. */
  userName: string
  role: UserRole
  organizationId: string
  organizationSlug: string
}

/**
 * Verifies the session token and re-checks the account in the database, so a
 * deactivated user or organization loses access immediately, role changes
 * apply without waiting for the token to expire, and sessions issued before a
 * password change stop working.
 */
export async function requireAuth(req: NextRequest, allowedRoles?: readonly UserRole[]): Promise<AuthContext> {
  const claims = await verifySessionToken(getRequestToken(req))
  if (!claims) throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED')

  const user = await prisma.user.findFirst({
    where: { id: claims.userId, organizationId: claims.organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      passwordChangedAt: true,
      organization: { select: { slug: true, isActive: true } },
    },
  })
  if (!user || !user.isActive || !user.organization.isActive) {
    throw unauthorized('Your account is no longer active. Contact your administrator.', 'SESSION_REVOKED')
  }
  // `iat` has one-second resolution, so compare in whole seconds.
  if (user.passwordChangedAt && (claims.issuedAt ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw unauthorized('Your password was changed. Please sign in again.', 'SESSION_REVOKED')
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) throw forbidden()

  return {
    userId: user.id,
    userName: `${user.firstName} ${user.lastName}`,
    role: user.role,
    organizationId: claims.organizationId,
    organizationSlug: user.organization.slug,
  }
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
