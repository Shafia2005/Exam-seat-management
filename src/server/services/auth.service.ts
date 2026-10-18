import { createHash, randomBytes } from 'crypto'
import { Prisma, type Organization } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signSessionToken } from '@/lib/auth/jwt'
import {
  burnPasswordCheck,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/password'
import { permissionsFor, toClientRole } from '@/lib/auth/roles'
import type { LoginResponse } from '@/types/auth.types'
import { audit } from '../audit'
import { ApiError, badRequest, conflict } from '../http'
import { fullName, toOrganizationDto, toUserDto, userProfileInclude, type UserWithProfile } from '../mappers'
import { appUrl, deliveryStatus, renderEmailHtml, sendMessages } from '../notify'
import type { AuthContext } from '../session'
import type {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerOrgSchema,
  resetPasswordWithTokenSchema,
} from '../validation'

export interface IssuedSession {
  body: LoginResponse
  token: string
  expiresAt: Date
}

/**
 * Finds the organization by slug or code. Without an explicit identifier, falls
 * back to the request host: a custom domain (exams.college.edu) or a subdomain
 * (apex-institute.example.com, apex-institute.localhost).
 */
export async function resolveOrganization(identifier: string | undefined, host: string | null): Promise<Organization | null> {
  const value = identifier?.trim()
  if (value) {
    return prisma.organization.findFirst({
      where: { OR: [{ slug: value.toLowerCase() }, { code: value.toUpperCase() }] },
    })
  }

  const hostname = host?.split(':')[0].toLowerCase()
  if (!hostname) return null

  const byDomain = await prisma.organization.findUnique({ where: { domain: hostname } })
  if (byDomain) return byDomain

  const labels = hostname.split('.')
  const hasSubdomain = labels.length > 2 || (labels.length === 2 && labels[1] === 'localhost')
  if (!hasSubdomain || labels[0] === 'www') return null
  return prisma.organization.findUnique({ where: { slug: labels[0] } })
}

async function issueSession(user: UserWithProfile): Promise<IssuedSession> {
  const { token, expiresAt } = await signSessionToken({
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    organizationSlug: user.organization.slug,
  })
  return {
    token,
    expiresAt,
    body: {
      user: toUserDto(user),
      organization: toOrganizationDto(user.organization),
      token,
      expiresAt: expiresAt.toISOString(),
      permissions: permissionsFor(user.role),
      roles: [toClientRole(user.role)],
    },
  }
}

export async function login(input: z.infer<typeof loginSchema>, host: string | null): Promise<IssuedSession> {
  const organization = await resolveOrganization(input.organization, host)
  if (!organization || !organization.isActive) {
    throw new ApiError(
      404,
      'ORGANIZATION_NOT_FOUND',
      input.organization
        ? `No active organization matches "${input.organization}". Check your institution code.`
        : 'Enter your organization code to sign in.'
    )
  }

  // Email for everyone; roll number for students; employee ID for teachers.
  const identifier = input.identifier.trim()
  const user = await prisma.user.findFirst({
    where: {
      organizationId: organization.id,
      OR: identifier.includes('@')
        ? [{ email: identifier.toLowerCase() }]
        : [
            { student: { is: { rollNumber: { equals: identifier, mode: 'insensitive' } } } },
            { teacher: { is: { employeeId: { equals: identifier, mode: 'insensitive' } } } },
          ],
    },
    include: userProfileInclude,
  })

  const passwordOk = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await burnPasswordCheck(input.password)

  if (!user || !passwordOk) {
    throw new ApiError(
      401,
      'INVALID_CREDENTIALS',
      `Invalid credentials for ${organization.name}. Check your email / ID and password.`
    )
  }
  // Only reported after the password matched, so it can't be used to probe for accounts.
  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated. Contact your administrator.')
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    include: userProfileInclude,
  })
  return issueSession(updated)
}

/** Creates an organization together with its first (super) admin account. */
export async function registerOrganization(input: z.infer<typeof registerOrgSchema>): Promise<IssuedSession> {
  const { organization: org, admin } = input
  const code = org.code ?? org.slug.replace(/-/g, '').toUpperCase().slice(0, 12)

  try {
    const createdOrg = await prisma.organization.create({
      data: {
        name: org.name,
        slug: org.slug,
        code,
        domain: org.domain,
        address: org.address,
        logoUrl: org.logoUrl,
        users: {
          create: {
            email: admin.email,
            passwordHash: await hashPassword(admin.password),
            firstName: admin.firstName,
            lastName: admin.lastName,
            role: 'SUPER_ADMIN',
            lastLoginAt: new Date(),
          },
        },
      },
      include: { users: { include: userProfileInclude } },
    })
    return issueSession(createdOrg.users[0])
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('An organization with this slug, code or domain is already registered', 'ORGANIZATION_EXISTS')
    }
    throw err
  }
}

/**
 * Changes the signed-in user's password. Other sessions are revoked; the
 * returned session replaces the caller's cookie so they stay signed in.
 */
export async function changePassword(
  ctx: AuthContext,
  input: z.infer<typeof changePasswordSchema>
): Promise<IssuedSession> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { passwordHash: true } })
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ApiError(400, 'INVALID_PASSWORD', 'Your current password is incorrect.')
  }
  if (input.currentPassword === input.newPassword) {
    throw badRequest('Choose a new password that is different from your current one.')
  }

  // Record the change before signing the new token so the new token is not revoked by it.
  const updated = await prisma.user.update({
    where: { id: ctx.userId },
    data: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() },
    include: userProfileInclude,
  })
  await audit(ctx, { action: 'auth.password-changed', entityType: 'user', entityId: ctx.userId, summary: `${ctx.userName} changed their password` })
  return issueSession(updated)
}

// ─── Forgot password ────────────────────────────────────────────────────────

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Emails a single-use reset link (valid 30 minutes) if an active account has
 * this email. The response is the same whether or not one exists. Outside
 * production, when no SMTP server is configured, the link is returned as
 * `devResetUrl` so the flow can be tried locally.
 */
export async function requestPasswordReset(
  input: z.infer<typeof forgotPasswordSchema>,
  host: string | null
): Promise<{ devResetUrl?: string }> {
  const organization = await resolveOrganization(input.organization, host)
  if (!organization || !organization.isActive) {
    throw new ApiError(
      404,
      'ORGANIZATION_NOT_FOUND',
      input.organization
        ? `No active organization matches "${input.organization}". Check your institution code.`
        : 'Enter your organization code.'
    )
  }

  const user = await prisma.user.findFirst({
    where: { organizationId: organization.id, email: input.email, isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  if (!user) return {}

  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    // Only the newest link works.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    }),
  ])

  const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const intro = `Hello ${user.firstName}, we received a request to reset your SeatGuard password for ${organization.name}. The link below works once and expires in 30 minutes. If you did not ask for this, you can ignore this email.`
  await sendMessages(organization.id, [
    {
      channel: 'EMAIL',
      to: user.email,
      toName: fullName(user),
      subject: 'Reset your SeatGuard password',
      text: `${intro}\n\n${resetUrl}`,
      html: renderEmailHtml({ heading: 'Reset your password', intro, ctaUrl: resetUrl, ctaLabel: 'Choose a new password' }),
      relatedType: 'password-reset',
      relatedId: user.id,
      // The outbox is visible to administrators, so never store the live link.
      logBody: `${intro}\n\n[reset link hidden]`,
    },
  ])

  const devMode = process.env.NODE_ENV !== 'production' && deliveryStatus().email === 'log'
  return devMode ? { devResetUrl: resetUrl } : {}
}

/** Sets a new password from a reset link and signs the user out everywhere. */
export async function resetPasswordWithToken(input: z.infer<typeof resetPasswordWithTokenSchema>): Promise<{ organizationSlug: string }> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true,
          organizationId: true,
          organization: { select: { slug: true, isActive: true } },
        },
      },
    },
  })
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive || !record.user.organization.isActive) {
    throw new ApiError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired. Request a new one.')
  }

  const { user } = record
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ])
  await audit(
    { organizationId: user.organizationId, userId: user.id, userName: fullName(user) },
    { action: 'auth.password-reset', entityType: 'user', entityId: user.id, summary: `${fullName(user)} reset their password with an emailed link` }
  )
  return { organizationSlug: user.organization.slug }
}

/**
 * Sets a new password for another account (admin action) and signs that user
 * out everywhere. Generates a temporary password when none is given.
 */
export async function resetUserPassword(userId: string, password?: string): Promise<{ temporaryPassword?: string }> {
  const temporaryPassword = password ? undefined : generateTemporaryPassword()
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password ?? temporaryPassword!), passwordChangedAt: new Date() },
  })
  return { temporaryPassword }
}

export async function getCurrentUser(ctx: AuthContext): Promise<Omit<LoginResponse, 'token' | 'expiresAt'>> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, include: userProfileInclude })
  return {
    user: toUserDto(user),
    organization: toOrganizationDto(user.organization),
    permissions: permissionsFor(user.role),
    roles: [toClientRole(user.role)],
  }
}
