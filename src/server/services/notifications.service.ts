import type { NotificationChannel as DbChannel, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { NotificationChannel, NotificationDeliveryStatus, NotificationLogEntry, NotifyResult } from '@/types/admin.types'
import { audit } from '../audit'
import { conflict, notFound } from '../http'
import { DUTY_ROLE_LABEL, fullName, toDateOnly, toNotificationDto } from '../mappers'
import { appUrl, deliveryStatus, renderEmailHtml, sendMessages, toE164, type OutgoingMessage } from '../notify'
import { slotLabel } from '../scheduling/time'
import type { AuthContext } from '../session'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

async function findPublishedExam(ctx: AuthContext, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, organizationId: ctx.organizationId },
    select: { id: true, name: true, status: true, organization: { select: { name: true } } },
  })
  if (!exam) throw notFound('Exam not found')
  if (exam.status === 'DRAFT') throw conflict('Publish the exam before notifying anyone.', 'EXAM_NOT_PUBLISHED')
  if (exam.status === 'CANCELLED') throw conflict('This exam was cancelled.', 'EXAM_LOCKED')
  return exam
}

interface Recipient {
  name: string
  email: string
  phone: string | null
  lines: { paper: string; when: string; where: string }[]
}

function buildMessages(
  recipients: Recipient[],
  channels: NotificationChannel[],
  copy: { subject: string; heading: string; intro: (r: Recipient) => string; ctaPath: string; smsLead: string },
  related: { type: string; id: string }
): { messages: OutgoingMessage[]; skipped: number } {
  const messages: OutgoingMessage[] = []
  let skipped = 0
  const ctaUrl = `${appUrl()}${copy.ctaPath}`

  recipients.forEach((r) => {
    const text = [
      copy.intro(r),
      '',
      ...r.lines.map((l) => `• ${l.paper} — ${l.when} — ${l.where}`),
      '',
      `Details: ${ctaUrl}`,
    ].join('\n')

    if (channels.includes('email')) {
      messages.push({
        channel: 'EMAIL',
        to: r.email,
        toName: r.name,
        subject: copy.subject,
        text,
        html: renderEmailHtml({
          heading: copy.heading,
          intro: copy.intro(r),
          rowHeader: ['Paper', 'When', 'Where'],
          rows: r.lines.map((l) => [l.paper, l.when, l.where]),
          ctaUrl,
          ctaLabel: 'Open SeatGuard',
          footer: 'Please arrive 15 minutes early and carry your ID card.',
        }),
        relatedType: related.type,
        relatedId: related.id,
      })
    }
    if (channels.includes('sms')) {
      const to = toE164(r.phone)
      if (!to) {
        skipped++
        return
      }
      // Keep SMS short: first two papers, then a pointer to the portal.
      const shown = r.lines.slice(0, 2).map((l) => `${l.paper} ${l.when} @ ${l.where}`)
      const more = r.lines.length > 2 ? ` +${r.lines.length - 2} more` : ''
      messages.push({
        channel: 'SMS',
        to,
        toName: r.name,
        text: `${copy.smsLead}: ${shown.join('; ')}${more}. ${ctaUrl}`,
        relatedType: related.type,
        relatedId: related.id,
      })
    }
  })
  return { messages, skipped }
}

/** Emails/texts every seated student their seats for an exam. */
export async function notifySeating(ctx: AuthContext, examId: string, channels: NotificationChannel[]): Promise<NotifyResult> {
  const exam = await findPublishedExam(ctx, examId)
  const rows = await prisma.seatAllocation.findMany({
    where: { organizationId: ctx.organizationId, examId },
    select: {
      studentId: true,
      seatLabel: true,
      room: { select: { name: true, block: { select: { name: true } } } },
      session: { select: { subjectName: true, examDate: true, startTime: true, endTime: true } },
      student: { select: { phone: true, user: { select: { firstName: true, lastName: true, email: true, isActive: true } } } },
    },
    orderBy: [{ session: { examDate: 'asc' } }, { session: { startTime: 'asc' } }],
  })
  if (!rows.length) throw conflict('No seats are allocated for this exam yet.', 'NO_ALLOCATION')

  const byStudent = new Map<string, Recipient>()
  rows.forEach((r) => {
    if (!r.student.user.isActive) return
    const recipient =
      byStudent.get(r.studentId) ??
      ({ name: fullName(r.student.user), email: r.student.user.email, phone: r.student.phone, lines: [] } as Recipient)
    recipient.lines.push({
      paper: r.session.subjectName,
      when: `${formatDate(toDateOnly(r.session.examDate))}, ${slotLabel(r.session.startTime, r.session.endTime)}`,
      where: `${r.room.name} (${r.room.block.name}), seat ${r.seatLabel}`,
    })
    byStudent.set(r.studentId, recipient)
  })

  const recipients = Array.from(byStudent.values())
  const { messages, skipped } = buildMessages(
    recipients,
    channels,
    {
      subject: `Your seats for ${exam.name}`,
      heading: `Seating for ${exam.name}`,
      intro: (r) => `Hello ${r.name}, your seats for ${exam.name} at ${exam.organization.name} are below. Your hall ticket is available in SeatGuard.`,
      ctaPath: '/my-seat',
      smsLead: `SeatGuard: ${exam.name} seats`,
    },
    { type: 'seating', id: examId }
  )
  const counts = await sendMessages(ctx.organizationId, messages)
  await audit(ctx, {
    action: 'notification.seating-sent',
    entityType: 'exam',
    entityId: examId,
    summary: `Sent seating notices for “${exam.name}” to ${recipients.length} students by ${channels.join(' and ')}`,
    metadata: { ...counts, skipped },
  })
  return { recipients: recipients.length, skipped, ...counts }
}

/** Emails/texts every assigned invigilator their duties for an exam. */
export async function notifyDuties(ctx: AuthContext, examId: string, channels: NotificationChannel[]): Promise<NotifyResult> {
  const exam = await findPublishedExam(ctx, examId)
  const duties = await prisma.invigilationDuty.findMany({
    where: { organizationId: ctx.organizationId, examId },
    select: {
      teacherId: true,
      role: true,
      room: { select: { name: true, block: { select: { name: true } } } },
      session: { select: { subjectName: true, examDate: true, startTime: true, endTime: true } },
      teacher: { select: { phone: true, user: { select: { firstName: true, lastName: true, email: true, isActive: true } } } },
    },
    orderBy: [{ session: { examDate: 'asc' } }, { session: { startTime: 'asc' } }],
  })
  if (!duties.length) throw conflict('No invigilators are assigned for this exam yet.', 'NO_DUTIES')

  const byTeacher = new Map<string, Recipient>()
  duties.forEach((d) => {
    if (!d.teacher.user.isActive) return
    const recipient =
      byTeacher.get(d.teacherId) ??
      ({ name: fullName(d.teacher.user), email: d.teacher.user.email, phone: d.teacher.phone, lines: [] } as Recipient)
    recipient.lines.push({
      paper: `${d.session.subjectName} (${DUTY_ROLE_LABEL[d.role]})`,
      when: `${formatDate(toDateOnly(d.session.examDate))}, ${slotLabel(d.session.startTime, d.session.endTime)}`,
      where: `${d.room.name} (${d.room.block.name})`,
    })
    byTeacher.set(d.teacherId, recipient)
  })

  const recipients = Array.from(byTeacher.values())
  const { messages, skipped } = buildMessages(
    recipients,
    channels,
    {
      subject: `Invigilation duties for ${exam.name}`,
      heading: `Your invigilation duties`,
      intro: (r) => `Hello ${r.name}, you are on invigilation duty for ${exam.name}. Take attendance from “My duties” in SeatGuard on the day.`,
      ctaPath: '/my-duties',
      smsLead: `SeatGuard: ${exam.name} duty`,
    },
    { type: 'duties', id: examId }
  )
  const counts = await sendMessages(ctx.organizationId, messages)
  await audit(ctx, {
    action: 'notification.duties-sent',
    entityType: 'exam',
    entityId: examId,
    summary: `Sent duty notices for “${exam.name}” to ${recipients.length} invigilators by ${channels.join(' and ')}`,
    metadata: { ...counts, skipped },
  })
  return { recipients: recipients.length, skipped, ...counts }
}

export async function listNotifications(
  ctx: AuthContext,
  q: { page: number; limit: number; channel?: NotificationChannel; status?: 'sent' | 'logged' | 'failed' }
): Promise<{ rows: NotificationLogEntry[]; total: number }> {
  const where: Prisma.NotificationLogWhereInput = {
    organizationId: ctx.organizationId,
    channel: q.channel ? (q.channel.toUpperCase() as DbChannel) : undefined,
    status: q.status ? (q.status.toUpperCase() as Prisma.NotificationLogWhereInput['status']) : undefined,
  }
  const [total, rows] = await prisma.$transaction([
    prisma.notificationLog.count({ where }),
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ])
  return { rows: rows.map(toNotificationDto), total }
}

export function getDeliveryStatus(): NotificationDeliveryStatus {
  return deliveryStatus()
}
