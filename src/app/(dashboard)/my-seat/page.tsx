'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Armchair, CalendarDays, DoorOpen, Download, Printer, ShieldCheck, Ticket, UserCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useStudentsStore } from '@/modules/students'
import { seatService } from '@/modules/seats'
import { useExamsStore } from '@/modules/exams'
import { useRole } from '@/hooks/useRole'
import { useMinAttendance } from '@/hooks/useMinAttendance'
import { errorMessage } from '@/lib/api-client'
import { formatDay, formatDayRange, todayIn } from '@/lib/format'
import type { MySeatResponse } from '@/types/seat.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/input'
import { Alert, Avatar, PageHeader, Skeleton } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'

const STANDARD_INSTRUCTIONS = [
  'Carry this hall ticket and your official student identity card to every paper.',
  'Report 20 minutes before each paper starts. Entry is not permitted 30 minutes after the start.',
  'Your hall and seat can differ between papers — check the table for each one.',
  'Mobile phones, smartwatches and programmable calculators are prohibited in the hall.',
]

function useQrCode(text: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return setSrc(null)
    let cancelled = false
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null))
    return () => {
      cancelled = true
    }
  }, [text])
  return src
}

export default function MySeatPage() {
  const organization = useAuthStore((s) => s.organization)
  const minAttendance = useMinAttendance()
  const { isAdmin: isAdminViewer } = useRole()
  const { students, fetchStudents } = useStudentsStore()
  const { exams, fetchExams } = useExamsStore()

  // Students always see their own seats; admins can preview any student.
  const [activeStudentId, setActiveStudentId] = useState('')
  const [selectedExamId, setSelectedExamId] = useState('')
  const [mySeat, setMySeat] = useState<MySeatResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [origin, setOrigin] = useState('')

  useEffect(() => setOrigin(window.location.origin), [])

  useEffect(() => {
    fetchExams({ page: 1, limit: 100, search: '', status: 'all' })
    if (isAdminViewer) fetchStudents({ page: 1, limit: 500, search: '', status: 'all', eligibility: 'all', departmentId: undefined })
  }, [isAdminViewer, fetchExams, fetchStudents])

  useEffect(() => {
    seatService
      .getMySeat(isAdminViewer && activeStudentId ? activeStudentId : undefined)
      .then((res) => {
        setMySeat(res)
        setLoadError('')
        if (!activeStudentId) setActiveStudentId(res.student.id)
      })
      .catch((err) => setLoadError(errorMessage(err, 'Failed to load your seat allotment')))
  }, [activeStudentId, isAdminViewer])

  // Default to the next exam with a seat for this student, else the first exam.
  useEffect(() => {
    if (selectedExamId || exams.length === 0 || !mySeat) return
    const withSeat = exams.filter((e) => mySeat.allocations.some((a) => a.examId === e.id))
    const upcoming = withSeat.find((e) => e.status === 'ongoing' || e.status === 'scheduled')
    setSelectedExamId((upcoming || withSeat[0] || exams[0]).id)
  }, [exams, mySeat, selectedExamId])

  const student = mySeat?.student
  const seats = useMemo(() => (mySeat?.allocations ?? []).filter((a) => a.examId === selectedExamId), [mySeat, selectedExamId])
  const exam = exams.find((e) => e.id === selectedExamId)
  const eligible = student?.isEligible ?? false
  const token = mySeat?.hallTickets.find((t) => t.examId === selectedExamId)?.token ?? null
  const qr = useQrCode(token && origin ? `${origin}/verify/${token}` : null)

  const today = todayIn(organization?.timezone)
  const next = seats.find((s) => s.examDate >= today) ?? seats[seats.length - 1]
  const papersWithoutSeat = (exam?.subjects ?? []).filter((p) => !seats.some((s) => s.sessionId === p.id))

  const pdfUrl = selectedExamId && seats.length ? seatService.hallTicketUrl(selectedExamId, isAdminViewer ? activeStudentId : undefined) : null

  return (
    <div>
      <PageHeader
        title="My seat & hall ticket"
        badge={<Badge variant="success">{isAdminViewer ? 'Student portal preview' : 'Student portal'}</Badge>}
        description="Your hall, seat and invigilators for every paper."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()} disabled={!seats.length}>
              <Printer /> Print
            </Button>
            {pdfUrl ? (
              <Button asChild>
                <a href={pdfUrl} download>
                  <Download /> Download PDF
                </a>
              </Button>
            ) : (
              <Button disabled>
                <Download /> Download PDF
              </Button>
            )}
          </>
        }
      />

      {loadError && <Alert tone="danger" className="mb-6">{loadError}</Alert>}

      <div className="mb-6 flex flex-wrap gap-4 print:hidden">
        <Field label="Exam" htmlFor="seat-exam" className="min-w-[240px] flex-1 sm:max-w-sm">
          <Select id="seat-exam" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {mySeat?.allocations.some((a) => a.examId === e.id) ? ' ✓' : ''}
              </option>
            ))}
          </Select>
        </Field>
        {isAdminViewer && (
          <Field label="Preview as student" htmlFor="seat-student" className="min-w-[240px] flex-1 sm:max-w-sm">
            <Select id="seat-student" value={activeStudentId} onChange={(e) => setActiveStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rollNumber} — {s.firstName} {s.lastName}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {!student ? (
        !loadError && <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : (
        <Card className="mx-auto max-w-4xl overflow-hidden print:max-w-none print:border-2 print:shadow-none">
          {/* Header band */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 px-6 py-5 text-white print:bg-none print:text-foreground">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-100 print:text-muted-foreground">
                {organization?.name ?? 'Examination board'} · Hall ticket
              </p>
              <h2 className="mt-1 text-xl font-semibold">{exam?.name ?? 'Examination'}</h2>
              {exam && <p className="text-sm text-indigo-100 print:text-muted-foreground">{formatDayRange(exam.startDate, exam.endDate)}</p>}
            </div>
            <div className="rounded-lg bg-white/15 px-4 py-2 text-right ring-1 ring-white/25 print:ring-border">
              <p className="text-[0.65rem] uppercase tracking-wider text-indigo-100 print:text-muted-foreground">Roll number</p>
              <p className="font-mono text-lg font-semibold">{student.rollNumber}</p>
            </div>
          </div>

          {/* Candidate */}
          <div className="flex flex-wrap items-center gap-5 border-b px-6 py-5">
            <Avatar name={`${student.firstName} ${student.lastName}`} size="xl" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">
                {student.firstName} {student.lastName}
              </p>
              <p className="text-sm text-muted-foreground">
                Roll {student.rollNumber}
                {student.registrationNumber && ` · Reg. ${student.registrationNumber}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {student.courseName} · Semester {student.currentSemester}
                {student.section && ` · Section ${student.section}`}
              </p>
            </div>
            <div className="rounded-lg border px-4 py-2.5 text-right">
              <p className="text-xs text-muted-foreground">Attendance (min. {minAttendance}%)</p>
              <p className={`text-lg font-semibold ${student.attendancePercentage >= minAttendance ? 'text-success' : 'text-destructive'}`}>
                {student.attendancePercentage}%
              </p>
              <Badge variant={eligible ? 'success' : 'danger'}>{eligible ? 'Eligible' : 'Not eligible'}</Badge>
            </div>
            {qr && (
              <div className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser */}
                <img src={qr} alt="Hall ticket verification QR code" className="size-28 rounded-md border bg-white p-1" />
                <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                  <ShieldCheck className="size-3" /> Scan to verify
                </span>
              </div>
            )}
          </div>

          <div className="space-y-6 p-6">
            {!seats.length ? (
              <Alert tone="info" title="Seats not allotted yet">
                Your seats for this exam will appear here once the seating plan is published.
              </Alert>
            ) : (
              next && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border bg-indigo-500/5 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                      <DoorOpen className="size-3.5" /> {next.examDate >= today ? 'Next paper' : 'Last paper'}
                    </p>
                    <p className="mt-2 truncate text-lg font-semibold">{next.subjectName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDay(next.examDate)} · {next.startTime}–{next.endTime}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-violet-500/5 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      <Armchair className="size-3.5" /> Hall & seat
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {next.roomNumber} · {next.seatLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {next.blockName} · Bench {next.benchNumber}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-emerald-500/5 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      <UserCheck className="size-3.5" /> Invigilators
                    </p>
                    {next.invigilators.length ? (
                      <ul className="mt-2 space-y-1">
                        {next.invigilators.map((inv) => (
                          <li key={inv.employeeId} className="text-sm">
                            <span className="font-semibold">{inv.teacherName}</span>
                            <span className="block text-xs text-muted-foreground">{inv.role}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-lg font-semibold">To be announced</p>
                    )}
                  </div>
                </div>
              )
            )}

            {(seats.length > 0 || papersWithoutSeat.length > 0) && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-muted-foreground" /> Papers, halls and seats
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <THead>
                      <tr>
                        <TH>Date</TH>
                        <TH>Time</TH>
                        <TH>Paper</TH>
                        <TH>Hall</TH>
                        <TH>Seat</TH>
                        <TH>Invigilators</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {seats.map((s) => (
                        <TR key={s.sessionId}>
                          <TD className="whitespace-nowrap text-muted-foreground">{formatDay(s.examDate)}</TD>
                          <TD className="whitespace-nowrap text-muted-foreground">
                            {s.startTime}–{s.endTime}
                          </TD>
                          <TD className="font-medium">{s.subjectName}</TD>
                          <TD className="whitespace-nowrap">
                            {s.roomNumber} <span className="text-xs text-muted-foreground">· {s.blockName}</span>
                          </TD>
                          <TD>
                            <Badge variant="secondary">{s.seatLabel}</Badge>
                            {s.attendanceStatus && (
                              <Badge variant={s.attendanceStatus === 'present' ? 'success' : 'danger'} className="ml-1.5">
                                {s.attendanceStatus}
                              </Badge>
                            )}
                          </TD>
                          <TD className="text-xs text-muted-foreground">{s.invigilators.map((i) => i.teacherName).join(', ') || '—'}</TD>
                        </TR>
                      ))}
                      {papersWithoutSeat.map((p) => (
                        <TR key={p.id}>
                          <TD className="whitespace-nowrap text-muted-foreground">{formatDay(p.examDate)}</TD>
                          <TD className="whitespace-nowrap text-muted-foreground">
                            {p.startTime}–{p.endTime}
                          </TD>
                          <TD className="font-medium">{p.subjectName || p.subjectId}</TD>
                          <TD colSpan={3} className="text-xs text-muted-foreground">
                            Seat not allotted for this paper
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </section>
            )}

            <section className="rounded-lg bg-muted/50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Ticket className="size-4 text-muted-foreground" /> Instructions
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {exam?.instructions && <li>{exam.instructions}</li>}
                {STANDARD_INSTRUCTIONS.map((i) => (
                  <li key={i}>{i}</li>
                ))}
                {qr && <li>Invigilators may scan the QR code to confirm this hall ticket is genuine.</li>}
              </ul>
            </section>
          </div>
        </Card>
      )}
    </div>
  )
}
