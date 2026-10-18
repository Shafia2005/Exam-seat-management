// Session token signing/verification. Runs in both the Edge runtime
// (middleware) and Node (route handlers), so it only depends on `jose`.

import { SignJWT, decodeJwt, jwtVerify } from 'jose'
import type { DbUserRole } from '@/types/auth.types'
import { isDbUserRole } from './roles'

export const SESSION_COOKIE = 'esm_session'

const ISSUER = 'exam-seat-management'
const AUDIENCE = 'exam-seat-management:api'

export interface SessionClaims {
  userId: string
  role: DbUserRole
  organizationId: string
  organizationSlug: string
  /** Seconds since epoch (JWT `iat`). */
  issuedAt?: number
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function signSessionToken(claims: SessionClaims): Promise<{ token: string; expiresAt: Date }> {
  const token = await new SignJWT({
    role: claims.role,
    org: claims.organizationId,
    orgSlug: claims.organizationSlug,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '7d')
    .sign(getSecret())

  const { exp } = decodeJwt(token)
  return { token, expiresAt: new Date((exp ?? 0) * 1000) }
}

/** Returns the session claims, or `null` when the token is missing, expired or tampered with. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null
  // Resolve the secret outside the try so a misconfiguration surfaces instead of
  // silently logging everyone out.
  const secret = getSecret()
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })
    if (typeof payload.sub !== 'string' || typeof payload.org !== 'string' || !isDbUserRole(payload.role)) {
      return null
    }
    return {
      userId: payload.sub,
      role: payload.role,
      organizationId: payload.org,
      organizationSlug: typeof payload.orgSlug === 'string' ? payload.orgSlug : '',
      issuedAt: payload.iat,
    }
  } catch {
    return null
  }
}

/** Reads the session token from the HttpOnly cookie, falling back to an `Authorization: Bearer` header. */
export function getRequestToken(req: { headers: Headers; cookies: { get(name: string): { value: string } | undefined } }): string | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (cookie) return cookie
  const header = req.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim() || null
  return null
}

// ─── Hall-ticket verification tokens ────────────────────────────────────────
// Encoded in the hall-ticket QR code. A separate audience means these can never
// be used as session tokens.

const HALL_TICKET_AUDIENCE = 'seatguard:hall-ticket'

export interface HallTicketClaims {
  studentId: string
  examId: string
  organizationId: string
}

export async function signHallTicketToken(claims: HallTicketClaims): Promise<string> {
  return new SignJWT({ exam: claims.examId, org: claims.organizationId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.studentId)
    .setIssuer(ISSUER)
    .setAudience(HALL_TICKET_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('180d')
    .sign(getSecret())
}

export async function verifyHallTicketToken(token: string): Promise<HallTicketClaims | null> {
  const secret = getSecret()
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: HALL_TICKET_AUDIENCE, algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || typeof payload.exam !== 'string' || typeof payload.org !== 'string') return null
    return { studentId: payload.sub, examId: payload.exam, organizationId: payload.org }
  } catch {
    return null
  }
}
