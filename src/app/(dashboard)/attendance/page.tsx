'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, CheckCheck, ClipboardCheck, DoorOpen, Search, UserX, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { attendanceService } from '@/modules/admin'
import { teacherDutyService, type MyDutyAssignment } from '@/modules/teacherDuty'
import { useExamsStore } from '@/modules/exams'
import { useSeatsStore } from '@/modules/seats'
import { useRole } from '@/hooks/useRole'
import { errorMessage } from '@/lib/api-client'
import { downloadCsv, formatDay, paperLabel } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { HallAttendance } from '@/types/admin.types'
import type { AttendanceMark } from '@/types/seat.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/input'
import { Alert, EmptyState, PageHeader, Progress, Skeleton, StatCard } from '@/components/ui/misc'

/** Pick a hall: admins browse exam → paper → room; teachers pick one of their duties. */
function HallPicker({ onPick }: { onPick: (sessionId: string, roomId: string) => void }) {
  const { isAdmin } = useRole()
  const { exams, fetchExams } = useExamsStore()
  const { rooms, summary, initializeData } = useSeatsStore()
  const [duties, setDuties] = useState<MyDutyAssignment[] | null>(null)
  const [examId, setExamId] = useState('')
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    if (isAdmin) {
      initializeData()
      fetchExams({ page: 1, limit: 100, search: '', status: 'all' })
    } else {
      teacherDutyService
        .getMyDuties()
        .then((r) => setDuties(r.duties))
        .catch(() => setDuties([]))
    }
  }, [isAdmin, initializeData, fetchExams])

  const live = useMemo(() => exams.filter((e) => e.status === 'ongoing' || e.status === 'completed' || e.status === 'scheduled'), [exams])
  useEffect(() => {
    if (!examId && live.length) setExamId((live.find((e) => e.status === 'ongoing') ?? live[0]).id)
  }, [live, examId])
  const papers = useMemo(() => live.find((e) => e.id === examId)?.subjects ?? [], [live, examId])
  useEffect(() => {
    if (papers.length && !papers.some((p) => p.id === sessionId)) {
      const today = new Date().toISOString().slice(0, 10)
      setSessionId((papers.find((p) => p.examDate === today) ?? papers[0]).id)
    }
  }, [papers, sessionId])
  const halls = useMemo(() => summary?.rooms.filter((r) => r.sessionId === sessionId) ?? [], [summary, sessionId])

  if (!isAdmin) {
    if (!duties) return <Skeleton className="h-40 w-full" />
    const open = duties.filter((d) => d.attendance.total > 0).sort((a, b) => `${a.sessionDate}${a.startTime}`.localeCompare(`${b.sessionDate}${b.startTime}`))
    if (!open.length) {
      return <EmptyState icon={<ClipboardCheck />} title="No halls to take attendance in" description="Attendance is available for halls where you are invigilating a seated paper." />
    }
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {open.map((d) => (
          <Card key={d.id} className="flex items-center gap-4 p-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DoorOpen className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {d.roomNumber} · {d.subjectName}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.sessionDate && formatDay(d.sessionDate)} · {d.sessionSlot} · {d.attendance.present + d.attendance.absent}/{d.attendance.total} marked
              </p>
            </div>
            <Button size="sm" variant={d.attendanceOpen ? 'default' : 'outline'} disabled={!d.attendanceOpen} onClick={() => onPick(d.sessionId, d.roomId)}>
              {d.attendanceOpen ? 'Open' : 'Not yet'}
            </Button>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap gap-4">
          <Field label="Exam" htmlFor="att-exam" className="min-w-[220px] flex-1">
            <Select id="att-exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
              {live.length === 0 && <option value="">No published exams</option>}
              {live.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paper" htmlFor="att-paper" className="min-w-[260px] flex-[2]">
            <Select id="att-paper" value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={!papers.length}>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {paperLabel(p)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {halls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students are seated for this paper yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {halls.map((h) => (
              <Button key={h.roomId} variant="outline" onClick={() => onPick(sessionId, h.roomId)}>
                <DoorOpen /> {rooms.find((r) => r.id === h.roomId)?.name ?? 'Hall'} <span className="text-muted-foreground">· {h.count}</span>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HallSheet({ sessionId, roomId, onBack }: { sessionId: string; roomId: string; onBack: () => void }) {
  const [hall, setHall] = useState<HallAttendance | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'present' | 'absent'>('all')
  const [saving, setSaving] = useState(false)
  const pending = useRef(0)

  const load = useCallback(() => {
    attendanceService
      .getHall(sessionId, roomId)
      .then((h) => {
        setHall(h)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'Could not load this hall.')))
  }, [sessionId, roomId])
  useEffect(load, [load])

  const save = async (marks: { allocationId: string; status: AttendanceMark | null }[]) => {
    if (!hall || !marks.length) return
    // Optimistic update so marking a full hall stays quick on a phone.
    const byId = new Map(marks.map((m) => [m.allocationId, m.status]))
    setHall({ ...hall, seats: hall.seats.map((s) => (byId.has(s.allocationId) ? { ...s, status: byId.get(s.allocationId) ?? null } : s)) })
    pending.current++
    setSaving(true)
    try {
      const updated = await attendanceService.mark(sessionId, roomId, marks)
      pending.current--
      // Only take the server copy once every in-flight save has landed.
      if (pending.current === 0) setHall(updated)
    } catch (err) {
      pending.current--
      toast.error('Attendance not saved', errorMessage(err, 'Please try again.'))
      load()
    } finally {
      if (pending.current === 0) setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const s = { total: 0, present: 0, absent: 0, pending: 0 }
    hall?.seats.forEach((seat) => {
      s.total++
      if (seat.status === 'present') s.present++
      else if (seat.status === 'absent') s.absent++
      else s.pending++
    })
    return s
  }, [hall])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (hall?.seats ?? []).filter((s) => {
      if (filter === 'pending' && s.status) return false
      if (filter !== 'all' && filter !== 'pending' && s.status !== filter) return false
      return !q || [s.rollNumber, s.studentName, s.seatLabel].some((v) => v.toLowerCase().includes(q))
    })
  }, [hall, search, filter])

  if (error) {
    return (
      <div className="space-y-4">
        <Alert tone="danger">{error}</Alert>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft /> Choose another hall
        </Button>
      </div>
    )
  }
  if (!hall) return <Skeleton className="h-96 w-full" />

  const exportCsv = () =>
    downloadCsv(
      `attendance-${hall.roomName}-${hall.subjectName}`.replace(/\W+/g, '-').toLowerCase() + '.csv',
      ['Seat', 'Roll number', 'Name', 'Department', 'Status', 'Marked at'],
      hall.seats.map((s) => [s.seatLabel, s.rollNumber, s.studentName, s.departmentName, s.status ?? 'not marked', s.markedAt ?? ''])
    )

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DoorOpen className="size-6" />
          </div>
          <div className="min-w-[12rem] flex-1">
            <p className="text-lg font-semibold">
              {hall.roomName} <span className="font-normal text-muted-foreground">· {hall.blockName}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {hall.examName} · {hall.subjectName} · {formatDay(hall.examDate)} · {hall.startTime}–{hall.endTime}
            </p>
            {hall.invigilators.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Invigilators: {hall.invigilators.map((i) => `${i.teacherName} (${i.role})`).join(', ')}</p>
            )}
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft /> Halls
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {summary.present + summary.absent} of {summary.total} marked
            </span>
            <span>{saving ? 'Saving…' : 'All changes saved'}</span>
          </div>
          <Progress value={summary.total ? ((summary.present + summary.absent) / summary.total) * 100 : 0} tone={summary.pending ? 'primary' : 'success'} />
        </div>
      </Card>

      {!hall.canMark && (
        <Alert tone="info" title="Attendance is read-only">
          {hall.open ? 'You cannot change attendance for this hall.' : `Attendance opens on ${formatDay(hall.examDate)}, the day of the paper.`}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Present" value={summary.present} icon={<Check />} tone="emerald" />
        <StatCard label="Absent" value={summary.absent} icon={<UserX />} tone="rose" />
        <StatCard label="Not marked" value={summary.pending} icon={<ClipboardCheck />} tone="amber" />
      </div>

      <Card>
        <CardToolbar
          title="Candidates"
          description="Tap Present or Absent for each seat. Changes save automatically."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-52">
                <Input icon={<Search />} placeholder="Roll, name or seat…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search candidates" />
              </div>
              <Select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-36">
                <option value="all">All seats</option>
                <option value="pending">Not marked</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </Select>
              {hall.canMark && (
                <Button
                  size="sm"
                  disabled={!summary.pending}
                  onClick={() => save(hall.seats.filter((s) => !s.status).map((s) => ({ allocationId: s.allocationId, status: 'present' as const })))}
                >
                  <CheckCheck /> Mark remaining present
                </Button>
              )}
            </div>
          }
        />
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No seats match.</p>
          ) : (
            rows.map((s) => (
              <div
                key={s.allocationId}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  s.status === 'present' && 'border-emerald-500/30 bg-emerald-500/5',
                  s.status === 'absent' && 'border-red-500/30 bg-red-500/5'
                )}
              >
                <Badge variant="secondary" className="w-12 justify-center font-mono">
                  {s.seatLabel}
                </Badge>
                <div className="min-w-[9rem] flex-1">
                  <p className="truncate text-sm font-medium">{s.studentName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{s.rollNumber}</span> · {s.departmentName}
                  </p>
                </div>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    size="sm"
                    variant={s.status === 'present' ? 'success' : 'outline'}
                    disabled={!hall.canMark}
                    onClick={() => save([{ allocationId: s.allocationId, status: s.status === 'present' ? null : 'present' }])}
                    aria-pressed={s.status === 'present'}
                  >
                    <Check /> Present
                  </Button>
                  <Button
                    size="sm"
                    variant={s.status === 'absent' ? 'destructive' : 'outline'}
                    disabled={!hall.canMark}
                    onClick={() => save([{ allocationId: s.allocationId, status: s.status === 'absent' ? null : 'absent' }])}
                    aria-pressed={s.status === 'absent'}
                  >
                    <X /> Absent
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AttendanceContent() {
  const params = useSearchParams()
  const router = useRouter()
  const sessionId = params.get('sessionId') ?? ''
  const roomId = params.get('roomId') ?? ''

  const pick = (s: string, r: string) => router.push(`/attendance?sessionId=${encodeURIComponent(s)}&roomId=${encodeURIComponent(r)}`)

  return (
    <div>
      <PageHeader
        title="Exam-day attendance"
        description="Mark each candidate present or absent in your hall. Absences show up in Reports."
        actions={
          <Button variant="outline" asChild>
            <Link href="/my-duties">My duties</Link>
          </Button>
        }
      />
      {sessionId && roomId ? <HallSheet sessionId={sessionId} roomId={roomId} onBack={() => router.push('/attendance')} /> : <HallPicker onPick={pick} />}
    </div>
  )
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AttendanceContent />
    </Suspense>
  )
}
