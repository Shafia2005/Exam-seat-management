import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { isAdminRole } from '@/lib/auth/roles'
import { signHallTicketToken, verifyHallTicketToken } from '@/lib/auth/jwt'
import { badRequest, conflict, notFound } from '../http'
import { fullName, toDateOnly } from '../mappers'
import type { AuthContext } from '../session'
import { appUrl } from '../notify'

export interface HallTicketPaper {
  subjectName: string
  subjectCode?: string
  examDate: string
  startTime: string
  endTime: string
  roomName: string
  blockName: string
  seatLabel: string
  attendance: 'present' | 'absent' | null
}

export interface HallTicketVerification {
  valid: boolean
  reason?: string
  organizationName?: string
  examName?: string
  examStatus?: string
  studentName?: string
  rollNumber?: string
  departmentName?: string
  isEligible?: boolean
  papers?: HallTicketPaper[]
}

async function loadTicket(organizationId: string, examId: string, studentId: string) {
  const [exam, student, seats] = await Promise.all([
    prisma.exam.findFirst({
      where: { id: examId, organizationId },
      select: {
        id: true,
        name: true,
        status: true,
        academicYear: true,
        semester: true,
        instructions: true,
        organization: { select: { name: true, address: true } },
      },
    }),
    prisma.student.findFirst({
      where: { id: studentId, organizationId },
      select: {
        id: true,
        rollNumber: true,
        registrationNumber: true,
        currentSemester: true,
        section: true,
        isEligible: true,
        user: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
        course: { select: { name: true } },
      },
    }),
    prisma.seatAllocation.findMany({
      where: { organizationId, examId, studentId },
      select: {
        seatLabel: true,
        attendanceStatus: true,
        room: { select: { name: true, block: { select: { name: true } } } },
        session: { select: { subjectName: true, subjectCode: true, examDate: true, startTime: true, endTime: true } },
      },
      orderBy: [{ session: { examDate: 'asc' } }, { session: { startTime: 'asc' } }],
    }),
  ])
  if (!exam) throw notFound('Exam not found')
  if (!student) throw notFound('Student not found')

  const papers: HallTicketPaper[] = seats.map((s) => ({
    subjectName: s.session.subjectName,
    subjectCode: s.session.subjectCode ?? undefined,
    examDate: toDateOnly(s.session.examDate),
    startTime: s.session.startTime,
    endTime: s.session.endTime,
    roomName: s.room.name,
    blockName: s.room.block.name,
    seatLabel: s.seatLabel,
    attendance: s.attendanceStatus ? (s.attendanceStatus.toLowerCase() as 'present' | 'absent') : null,
  }))
  return { exam, student, papers }
}

// ─── PDF ────────────────────────────────────────────────────────────────────

/** The standard PDF fonts only cover Latin-1; fold accents and replace anything else. */
function pdfSafe(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

const INK = rgb(0.06, 0.09, 0.16)
const MUTED = rgb(0.42, 0.45, 0.5)
const BRAND = rgb(0.31, 0.27, 0.9)
const LINE = rgb(0.89, 0.91, 0.94)
const DANGER = rgb(0.8, 0.15, 0.15)

/** Draws the QR code as filled squares (one rectangle per horizontal run of dark modules). */
function drawQr(page: PDFPage, text: string, x: number, y: number, size: number) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = modules.size
  const cell = size / n
  for (let row = 0; row < n; row++) {
    let col = 0
    while (col < n) {
      if (!modules.get(row, col)) {
        col++
        continue
      }
      const start = col
      while (col < n && modules.get(row, col)) col++
      page.drawRectangle({
        x: x + start * cell,
        y: y + size - (row + 1) * cell,
        width: (col - start) * cell,
        height: cell,
        color: INK,
      })
    }
  }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  text.split(/\r?\n/).forEach((paragraph) => {
    let line = ''
    paragraph.split(/\s+/).forEach((word) => {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    })
    if (line) lines.push(line)
  })
  return lines
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1)
  return `${t}...`
}

const DEFAULT_INSTRUCTIONS = [
  'Bring this hall ticket and your institution ID card to every paper.',
  'Be seated 15 minutes before the paper starts. Late entry may be refused.',
  'Sit only in the hall and seat printed for each paper.',
  'Phones, smart watches and notes are not allowed in the hall.',
]

export async function buildHallTicketPdf(ctx: AuthContext, examId: string, studentId?: string): Promise<{ pdf: Uint8Array; fileName: string }> {
  let targetId = studentId
  if (!isAdminRole(ctx.role)) {
    const own = await prisma.student.findFirst({ where: { organizationId: ctx.organizationId, userId: ctx.userId }, select: { id: true } })
    if (!own) throw notFound('No student profile is linked to this account')
    targetId = own.id
  }
  if (!targetId) throw badRequest('studentId: Choose a student')

  const { exam, student, papers } = await loadTicket(ctx.organizationId, examId, targetId)
  if (exam.status === 'DRAFT' && !isAdminRole(ctx.role)) throw notFound('Exam not found')
  if (exam.status === 'CANCELLED') throw conflict('This exam was cancelled.', 'EXAM_LOCKED')
  if (!papers.length) throw conflict('No seats are allocated to this student for this exam yet.', 'NO_ALLOCATION')

  const token = await signHallTicketToken({ studentId: student.id, examId: exam.id, organizationId: ctx.organizationId })
  const verifyUrl = `${appUrl()}/verify/${token}`

  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`Hall ticket - ${exam.name} - ${student.rollNumber}`))
  doc.setAuthor(pdfSafe(exam.organization.name))
  doc.setCreator('SeatGuard')
  const page = doc.addPage([595.28, 841.89])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const M = 40
  const text = (s: string, x: number, y: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) =>
    page.drawText(pdfSafe(s), { x, y, size: opts.size ?? 10, font: opts.font ?? regular, color: opts.color ?? INK })

  // Header band
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: BRAND })
  let y = height - M - 10
  text(exam.organization.name, M, y, { size: 18, font: bold })
  y -= 16
  if (exam.organization.address) {
    text(fit(pdfSafe(exam.organization.address), regular, 9, width - 2 * M - 140), M, y, { size: 9, color: MUTED })
    y -= 14
  }
  y -= 8
  text('HALL TICKET', M, y, { size: 11, font: bold, color: BRAND })
  y -= 18
  text(fit(pdfSafe(exam.name), bold, 14, width - 2 * M - 140), M, y, { size: 14, font: bold })
  y -= 15
  text(`Academic year ${exam.academicYear}  |  Semester ${exam.semester}`, M, y, { size: 9, color: MUTED })

  // QR code (top right)
  const qrSize = 112
  drawQr(page, verifyUrl, width - M - qrSize, height - M - qrSize - 4, qrSize)
  text('Scan to verify', width - M - qrSize + 26, height - M - qrSize - 16, { size: 8, color: MUTED })

  // Candidate details
  y = height - M - qrSize - 46
  page.drawLine({ start: { x: M, y: y + 14 }, end: { x: width - M, y: y + 14 }, thickness: 1, color: LINE })
  const details: [string, string][] = [
    ['Candidate', fullName(student.user)],
    ['Roll number', student.rollNumber],
    ['Registration no.', student.registrationNumber ?? '-'],
    ['Department', student.department.name],
    ['Course', student.course.name],
    ['Semester / section', `${student.currentSemester}${student.section ? ` / ${student.section}` : ''}`],
  ]
  const colW = (width - 2 * M) / 2
  details.forEach(([label, value], i) => {
    const x = M + (i % 2) * colW
    const rowY = y - Math.floor(i / 2) * 30
    text(label.toUpperCase(), x, rowY, { size: 7.5, font: bold, color: MUTED })
    text(fit(pdfSafe(value), bold, 11, colW - 12), x, rowY - 13, { size: 11, font: bold })
  })
  y -= Math.ceil(details.length / 2) * 30 + 6

  if (!student.isEligible) {
    page.drawRectangle({ x: M, y: y - 8, width: width - 2 * M, height: 22, color: rgb(1, 0.94, 0.94), borderColor: DANGER, borderWidth: 0.8 })
    text('NOT ELIGIBLE - report to the examination office before the first paper.', M + 8, y, { size: 9.5, font: bold, color: DANGER })
    y -= 30
  }

  // Papers table
  y -= 10
  const cols = [
    { label: '#', w: 22 },
    { label: 'Paper', w: 196 },
    { label: 'Date', w: 88 },
    { label: 'Time', w: 72 },
    { label: 'Hall', w: 89.28 },
    { label: 'Seat', w: 48 },
  ]
  const rowH = 22
  page.drawRectangle({ x: M, y: y - 7, width: width - 2 * M, height: rowH, color: rgb(0.95, 0.96, 0.99) })
  let x = M + 6
  cols.forEach((c) => {
    text(c.label.toUpperCase(), x, y, { size: 8, font: bold, color: MUTED })
    x += c.w
  })
  y -= rowH
  papers.forEach((p, i) => {
    if (y < 200) return // A4 holds ~20 papers; more than that is not a realistic hall ticket.
    // Show the subject code only when it fits next to the name.
    const withCode = p.subjectCode ? pdfSafe(`${p.subjectName} (${p.subjectCode})`) : ''
    const paperName = withCode && regular.widthOfTextAtSize(withCode, 9.5) <= cols[1].w - 8 ? withCode : p.subjectName
    const cells = [String(i + 1), paperName, formatDate(p.examDate), `${p.startTime} - ${p.endTime}`, p.roomName, p.seatLabel]
    x = M + 6
    cells.forEach((cell, j) => {
      const isSeat = j === cells.length - 1
      text(fit(pdfSafe(cell), isSeat ? bold : regular, 9.5, cols[j].w - 8), x, y, { size: 9.5, font: isSeat ? bold : regular })
      x += cols[j].w
    })
    page.drawLine({ start: { x: M, y: y - 8 }, end: { x: width - M, y: y - 8 }, thickness: 0.6, color: LINE })
    y -= rowH
  })

  // Instructions
  y -= 14
  text('INSTRUCTIONS', M, y, { size: 8, font: bold, color: MUTED })
  y -= 14
  const instructions = exam.instructions?.trim() ? exam.instructions.split(/\r?\n/).filter(Boolean) : DEFAULT_INSTRUCTIONS
  instructions.forEach((line) => {
    wrap(pdfSafe(line.replace(/^[-*•]\s*/, '')), regular, 9, width - 2 * M - 12).forEach((l, k) => {
      if (y < 110) return
      if (k === 0) text('-', M, y, { size: 9 })
      text(l, M + 10, y, { size: 9 })
      y -= 12
    })
  })

  // Signatures and footer
  const sigY = 90
  page.drawLine({ start: { x: M, y: sigY }, end: { x: M + 170, y: sigY }, thickness: 0.8, color: MUTED })
  page.drawLine({ start: { x: width - M - 170, y: sigY }, end: { x: width - M, y: sigY }, thickness: 0.8, color: MUTED })
  text("Candidate's signature", M, sigY - 12, { size: 8.5, color: MUTED })
  text('Controller of Examinations', width - M - 170, sigY - 12, { size: 8.5, color: MUTED })
  text(
    `Generated by SeatGuard on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Scan the QR code to confirm this ticket is genuine.`,
    M,
    40,
    { size: 7.5, color: MUTED }
  )

  const pdf = await doc.save()
  const safeName = `${exam.name}-${student.rollNumber}`.replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-')
  return { pdf, fileName: `hall-ticket-${safeName}.pdf` }
}

// ─── Public verification ────────────────────────────────────────────────────

/** Used by the public /verify page that the QR code points to. Exposes only what an invigilator needs. */
export async function verifyHallTicket(token: string): Promise<HallTicketVerification> {
  const claims = await verifyHallTicketToken(token)
  if (!claims) return { valid: false, reason: 'This hall ticket is not genuine or has expired.' }

  try {
    const { exam, student, papers } = await loadTicket(claims.organizationId, claims.examId, claims.studentId)
    const org = await prisma.organization.findUnique({ where: { id: claims.organizationId }, select: { name: true, isActive: true } })
    if (!org?.isActive) return { valid: false, reason: 'The issuing institution is no longer active.' }

    const base = {
      organizationName: org.name,
      examName: exam.name,
      examStatus: exam.status.toLowerCase(),
      studentName: fullName(student.user),
      rollNumber: student.rollNumber,
      departmentName: student.department.name,
      isEligible: student.isEligible,
      papers,
    }
    if (exam.status === 'CANCELLED') return { valid: false, reason: 'This exam was cancelled.', ...base }
    if (exam.status === 'DRAFT' || !papers.length) {
      return { valid: false, reason: 'This candidate no longer has seats for this exam.', ...base, papers: [] }
    }
    return { valid: true, ...base }
  } catch {
    return { valid: false, reason: 'The candidate or exam on this ticket no longer exists.' }
  }
}
