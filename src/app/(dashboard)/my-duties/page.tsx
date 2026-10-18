'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, CalendarDays, ClipboardCheck, ClipboardList, Clock, DoorOpen, Printer, Users } from 'lucide-react'
import { teacherDutyService, type MyDutiesResponse } from '@/modules/teacherDuty'
import { useTeachersStore } from '@/modules/teachers'
import { useExamsStore } from '@/modules/exams'
import { useRole } from '@/hooks/useRole'
import { errorMessage } from '@/lib/api-client'
import { formatDay } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/input'
import { Alert, Avatar, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc'

export default function MyDutiesPage() {
  const { isAdmin: isAdminViewer } = useRole()
  const { teachers, fetchTeachers } = useTeachersStore()
  const { exams, fetchExams } = useExamsStore()

  // Teachers always see their own duties; admins can preview any faculty member.
  const [activeTeacherId, setActiveTeacherId] = useState('')
  const [selectedExamId, setSelectedExamId] = useState('')
  const [myDuties, setMyDuties] = useState<MyDutiesResponse | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetchExams({ page: 1, limit: 100, search: '', status: 'all' })
    if (isAdminViewer) fetchTeachers({ page: 1, limit: 100, search: '', status: 'all', departmentId: undefined })
  }, [isAdminViewer, fetchExams, fetchTeachers])

  useEffect(() => {
    teacherDutyService
      .getMyDuties(isAdminViewer && activeTeacherId ? { teacherId: activeTeacherId } : {})
      .then((res) => {
        setMyDuties(res)
        setLoadError('')
        if (!activeTeacherId) setActiveTeacherId(res.teacher.id)
      })
      .catch((err) => setLoadError(errorMessage(err, 'Failed to load invigilation duties')))
  }, [activeTeacherId, isAdminViewer])

  // Default to the running or next exam with a duty for this teacher, else any exam with a duty.
  useEffect(() => {
    if (selectedExamId || exams.length === 0 || !myDuties) return
    const withDuty = exams.filter((e) => myDuties.duties.some((d) => d.examId === e.id))
    const live = withDuty.find((e) => e.status === 'ongoing') ?? withDuty.find((e) => e.status === 'scheduled')
    setSelectedExamId((live || withDuty[0] || exams[0]).id)
  }, [exams, myDuties, selectedExamId])

  const teacher = myDuties?.teacher
  const examDuties = useMemo(
    () =>
      (myDuties?.duties ?? [])
        .filter((d) => d.examId === selectedExamId)
        .sort((a, b) => `${a.sessionDate}${a.startTime}`.localeCompare(`${b.sessionDate}${b.startTime}`)),
    [myDuties, selectedExamId]
  )

  return (
    <div>
      <PageHeader
        title="My invigilation duties"
        badge={<Badge variant="info">{isAdminViewer ? 'Faculty portal preview' : 'Faculty portal'}</Badge>}
        description="Your hall assignments, timings and co-invigilators."
        actions={
          <Button variant="outline" onClick={() => window.print()} disabled={!examDuties.length}>
            <Printer /> Print duty slip
          </Button>
        }
      />

      {loadError && <Alert tone="danger" className="mb-6">{loadError}</Alert>}

      <div className="mb-6 flex flex-wrap gap-4 print:hidden">
        <Field label="Exam" htmlFor="duty-exam" className="min-w-[240px] flex-1 sm:max-w-sm">
          <Select id="duty-exam" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
            {exams.map((exam) => {
              const n = myDuties?.duties.filter((d) => d.examId === exam.id).length ?? 0
              return (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                  {n ? ` (${n} ${n === 1 ? 'duty' : 'duties'})` : ''}
                </option>
              )
            })}
          </Select>
        </Field>
        {isAdminViewer && (
          <Field label="Preview as faculty" htmlFor="duty-teacher" className="min-w-[240px] flex-1 sm:max-w-sm">
            <Select id="duty-teacher" aria-label="Faculty profile" value={activeTeacherId} onChange={(e) => setActiveTeacherId(e.target.value)}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName} · {t.departmentName}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {!teacher && !loadError ? (
        <Skeleton className="h-36 w-full rounded-xl" />
      ) : (
        teacher && (
          <Card className="relative mb-6 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 print:hidden" />
            <div className="relative flex flex-wrap items-end gap-5 px-6 pb-5 pt-10">
              <div className="rounded-full bg-card p-1 shadow-sm">
                <Avatar name={`${teacher.firstName} ${teacher.lastName}`} size="xl" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold">
                  {teacher.firstName} {teacher.lastName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {teacher.employeeId} · {teacher.designation} · {teacher.departmentName}
                </p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{examDuties.length}</p>
                  <p className="text-xs text-muted-foreground">This exam</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{myDuties?.duties.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">All exams</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{teacher.maxDutiesPerDay}</p>
                  <p className="text-xs text-muted-foreground">Daily cap</p>
                </div>
              </div>
            </div>
          </Card>
        )
      )}

      {myDuties && examDuties.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="No duties for this exam"
          description="You have not been scheduled to invigilate this exam. Check back once the roster is finalised."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {examDuties.map((duty) => (
            <Card key={duty.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <DoorOpen className="size-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-tight">Hall {duty.roomNumber}</p>
                    <p className="text-sm text-muted-foreground">{duty.blockName}</p>
                  </div>
                </div>
                <Badge variant={duty.role === 'Chief Invigilator' ? 'violet' : 'info'} className="normal-case">
                  {duty.role}
                </Badge>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2 flex items-center gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <span className="font-medium">{duty.subjectName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <span>{duty.sessionDate ? formatDay(duty.sessionDate) : 'Date to be announced'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span>{duty.sessionSlot || 'Time to be announced'}</span>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{duty.attendance.total || duty.studentCount || 0}</span> students in this hall
                    {duty.attendance.total > 0 && (duty.attendance.present > 0 || duty.attendance.absent > 0) && (
                      <span className="text-muted-foreground">
                        {' '}
                        · {duty.attendance.present} present, {duty.attendance.absent} absent
                        {duty.attendance.pending > 0 && `, ${duty.attendance.pending} not marked`}
                      </span>
                    )}
                  </span>
                </div>
              </dl>

              {duty.attendance.total > 0 && (
                <div className="mt-4 print:hidden">
                  {duty.attendanceOpen ? (
                    <Button asChild className="w-full" variant={duty.attendance.pending ? 'default' : 'outline'}>
                      <Link href={`/attendance?sessionId=${duty.sessionId}&roomId=${duty.roomId}`}>
                        <ClipboardCheck /> {duty.attendance.pending === duty.attendance.total ? 'Take attendance' : duty.attendance.pending ? 'Continue attendance' : 'Review attendance'}
                      </Link>
                    </Button>
                  ) : (
                    <p className="rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
                      Attendance opens on {duty.sessionDate ? formatDay(duty.sessionDate) : 'the day of the paper'}.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Co-invigilators</p>
                {duty.coInvigilators.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You are the only invigilator in this hall.</p>
                ) : (
                  <ul className="space-y-2">
                    {duty.coInvigilators.map((co) => (
                      <li key={co.id} className="flex items-center gap-2.5 text-sm">
                        <Avatar name={co.teacherName} size="sm" />
                        <span className="flex-1 font-medium">{co.teacherName}</span>
                        <span className="text-xs text-muted-foreground">{co.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
