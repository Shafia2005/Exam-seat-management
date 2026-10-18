import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Organization } from '@/types/auth.types'
import { audit } from '../audit'
import { toOrganizationDto } from '../mappers'
import type { AuthContext } from '../session'
import type { organizationUpdateSchema } from '../validation'
import { syncExamStatuses } from './exams.service'

export async function getOrganization(ctx: AuthContext): Promise<Organization> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } })
  return toOrganizationDto(org)
}

/**
 * Updates display details and exam policy. Slug and code are fixed because
 * users sign in with them. A new attendance threshold re-evaluates every
 * student whose eligibility is not manually overridden.
 */
export async function updateOrganization(
  ctx: AuthContext,
  input: z.infer<typeof organizationUpdateSchema>
): Promise<Organization & { eligibilityChanged?: number }> {
  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { minAttendancePercent: true, timezone: true },
  })
  const org = await prisma.organization.update({ where: { id: ctx.organizationId }, data: input })

  const changes: string[] = []
  let eligibilityChanged: number | undefined
  if (input.minAttendancePercent !== undefined && input.minAttendancePercent !== before.minAttendancePercent) {
    const threshold = input.minAttendancePercent
    const [nowEligible, nowIneligible] = await prisma.$transaction([
      prisma.student.updateMany({
        where: { organizationId: ctx.organizationId, eligibilityOverride: false, isEligible: false, attendancePercentage: { gte: threshold } },
        data: { isEligible: true },
      }),
      prisma.student.updateMany({
        where: { organizationId: ctx.organizationId, eligibilityOverride: false, isEligible: true, attendancePercentage: { lt: threshold } },
        data: { isEligible: false },
      }),
    ])
    eligibilityChanged = nowEligible.count + nowIneligible.count
    changes.push(
      `minimum attendance ${before.minAttendancePercent}% → ${threshold}% (${nowEligible.count} now eligible, ${nowIneligible.count} now ineligible)`
    )
  }
  if (input.timezone && input.timezone !== before.timezone) {
    changes.push(`timezone ${before.timezone} → ${input.timezone}`)
    await syncExamStatuses(ctx.organizationId, true)
  }
  const detailsChanged = ['name', 'address', 'logoUrl', 'domain'].some((k) => input[k as keyof typeof input] !== undefined)
  if (detailsChanged) changes.push('institution details')

  if (changes.length) {
    await audit(ctx, {
      action: 'organization.updated',
      entityType: 'organization',
      entityId: ctx.organizationId,
      summary: `Updated settings: ${changes.join('; ')}`,
    })
  }
  return { ...toOrganizationDto(org), eligibilityChanged }
}
