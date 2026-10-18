'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ClipboardCheck, Clock, Download, UserX } from 'lucide-react'
import { attendanceService } from '@/modules/admin'
import { seatService } from '@/modules/seats'
import { errorMessage } from '@/lib/api-client'
import { downloadCsv, formatSlot } from '@/lib/format'
import type { AttendanceSummaryRow } from '@/types/admin.types'
import type { Exam } from '@/types/exam.types'
import type { SeatAllocation } from '@/types/seat.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Alert, EmptyState, Progress, Skeleton, StatCard } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'

const rate = (present: number, absent: number) => (present + absent ? (present / (present + absent)) * 100 : 0)

/** Exam-day attendance per paper and hall, with the list of absentees. */
export function AttendanceReport({ exams }: { exams: Exam[] }) {
  const published = useMemo(() => exams.filter((e) => e.status === 'ongoing' || e.status === 'completed' || e.status === 'scheduled'), [exams])
  const [examId, setExamId] = useState('')
  const [rows, setRows] = useState<AttendanceSummaryRow[] | null>(null)
  const [plans, setPlans] = useState<SeatAllocation[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!examId && published.length) setExamId((published.find((e) => e.status === 'ongoing') ?? published.find((e) => e.status === 'completed') ?? published[0]).id)
  }, [published, examId])

  useEffect(() => {
    if (!examId) return
    setRows(null)
    Promise.all([attendanceService.summary(examId), seatService.getAllocations({ examId })])
      .then(([summary, allocations]) => {
        setRows(summary)
        setPlans(allocations)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'Could not load attendance.')))
  }, [examId])

  const totals = useMemo(() => {
    const t = { total: 0, present: 0, absent: 0, pending: 0 }
    rows?.forEach((r) => {
      t.total += r.totals.total
      t.present += r.totals.present
      t.absent += r.totals.absent
      t.pending += r.totals.pending
    })
    return t
  }, [rows])

  const absentees = useMemo(
    () =>
      plans.flatMap((p) =>
        p.allocations
          .filter((a) => a.attendanceStatus === 'absent')
          .map((a) => ({ ...a, subjectName: p.subjectName, examDate: p.examDate, startTime: p.startTime, endTime: p.endTime }))
      ),
    [plans]
  )

  const exam = published.find((e) => e.id === examId)

  const exportCsv = () =>
    downloadCsv(
      `attendance-${(exam?.name ?? 'exam').replace(/\W+/g, '-').toLowerCase()}.csv`,
      ['Paper', 'Date', 'Time', 'Roll number', 'Name', 'Department', 'Room', 'Seat', 'Attendance'],
      plans.flatMap((p) =>
        p.allocations.map((a) => [p.subjectName, p.examDate, `${p.startTime}-${p.endTime}`, a.studentRollNumber, a.studentName, a.departmentName, a.roomNumber, a.seatLabel, a.attendanceStatus ?? 'not marked'])
      )
    )

  if (!published.length) {
    return (
      <Card>
        <CardContent>
          <EmptyState icon={<ClipboardCheck />} title="No published exams" description="Attendance appears here once invigilators start marking it." />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="Exam" value={examId} onChange={(e) => setExamId(e.target.value)} className="max-w-sm">
          {published.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.status})
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={!plans.length}>
          <Download /> Download attendance
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Seats" value={totals.total} icon={<ClipboardCheck />} tone="indigo" loading={!rows} />
        <StatCard label="Present" value={totals.present} icon={<Check />} tone="emerald" loading={!rows} hint={`${rate(totals.present, totals.absent).toFixed(1)}% of marked`} />
        <StatCard label="Absent" value={totals.absent} icon={<UserX />} tone="rose" loading={!rows} />
        <StatCard label="Not marked" value={totals.pending} icon={<Clock />} tone="amber" loading={!rows} hint="Future papers, or halls still in progress" />
      </div>

      <Card>
        <CardToolbar title="By paper" description="Expand a paper to see each hall" />
        {!rows ? (
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        ) : rows.length === 0 ? (
          <CardContent>
            <EmptyState title="This exam has no papers" />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Paper</TH>
                <TH className="text-right">Seated</TH>
                <TH className="text-right">Present</TH>
                <TH className="text-right">Absent</TH>
                <TH className="text-right">Not marked</TH>
                <TH className="w-48">Turnout</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Fragment key={r.sessionId}>
                  <TR className="cursor-pointer" onClick={() => setExpanded(expanded === r.sessionId ? null : r.sessionId)}>
                    <TD>
                      <div className="flex items-center gap-2">
                        {expanded === r.sessionId ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        <div>
                          <p className="font-medium">{r.subjectName}</p>
                          <p className="text-xs text-muted-foreground">{formatSlot(r.examDate, r.startTime, r.endTime)}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">{r.totals.total}</TD>
                    <TD className="text-right tabular-nums text-success">{r.totals.present}</TD>
                    <TD className="text-right tabular-nums text-destructive">{r.totals.absent}</TD>
                    <TD className="text-right tabular-nums text-muted-foreground">{r.totals.pending}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Progress value={rate(r.totals.present, r.totals.absent)} tone={r.totals.absent ? 'warning' : 'success'} />
                        <span className="w-12 text-right text-xs tabular-nums">
                          {r.totals.present + r.totals.absent ? `${rate(r.totals.present, r.totals.absent).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    </TD>
                  </TR>
                  {expanded === r.sessionId &&
                    r.rooms.map((room) => (
                      <TR key={room.roomId} className="bg-muted/30">
                        <TD className="pl-12 text-sm">{room.roomName}</TD>
                        <TD className="text-right tabular-nums">{room.total}</TD>
                        <TD className="text-right tabular-nums">{room.present}</TD>
                        <TD className="text-right tabular-nums">{room.absent}</TD>
                        <TD className="text-right tabular-nums">{room.pending}</TD>
                        <TD />
                      </TR>
                    ))}
                </Fragment>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardToolbar title="Absentees" description={rows ? `${absentees.length} absences recorded` : 'Loading…'} />
        {!rows ? (
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        ) : absentees.length === 0 ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">No absences recorded for this exam.</p>
          </CardContent>
        ) : (
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            <Table>
              <THead className="sticky top-0 bg-muted">
                <tr>
                  <TH>Roll no.</TH>
                  <TH>Student</TH>
                  <TH>Department</TH>
                  <TH>Paper</TH>
                  <TH>Hall · seat</TH>
                </tr>
              </THead>
              <TBody>
                {absentees.map((a) => (
                  <TR key={`${a.sessionId}-${a.studentId}`}>
                    <TD className="font-mono text-xs">{a.studentRollNumber}</TD>
                    <TD className="font-medium">{a.studentName}</TD>
                    <TD className="text-muted-foreground">{a.departmentName}</TD>
                    <TD>
                      {a.subjectName}
                      <span className="block text-xs text-muted-foreground">{formatSlot(a.examDate, a.startTime, a.endTime)}</span>
                    </TD>
                    <TD>
                      {a.roomNumber} · {a.seatLabel}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
