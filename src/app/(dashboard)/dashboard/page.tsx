'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  DoorOpen,
  GraduationCap,
  LayoutGrid,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStudentsStore } from '@/modules/students'
import { useTeachersStore } from '@/modules/teachers'
import { useExamsStore } from '@/modules/exams'
import { useSeatsStore } from '@/modules/seats'
import { EXAM_STATUS_BADGE, EXAM_TYPE_LABEL, formatDay, greeting } from '@/lib/format'
import type { ExamStatus } from '@/types/exam.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { EmptyState, PageHeader, Progress, Skeleton, StatCard } from '@/components/ui/misc'

const STATUS_ORDER: ExamStatus[] = ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled']
const STATUS_BAR: Record<ExamStatus, 'primary' | 'success' | 'warning' | 'danger'> = {
  draft: 'warning',
  scheduled: 'primary',
  ongoing: 'success',
  completed: 'success',
  cancelled: 'danger',
}

const QUICK_ACTIONS = [
  { href: '/students', label: 'Add a student', icon: UserPlus },
  { href: '/exams', label: 'Schedule an exam', icon: CalendarPlus },
  { href: '/seat-allocation', label: 'Allocate seats', icon: LayoutGrid },
  { href: '/teacher-allocation', label: 'Assign invigilators', icon: UserCheck },
  { href: '/reports', label: 'View reports', icon: BarChart3 },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const { students, fetchStudents, pagination: studentPagination, isLoading: studentsLoading } = useStudentsStore()
  const { teachers, fetchTeachers, pagination: teacherPagination, isLoading: teachersLoading } = useTeachersStore()
  const { exams, fetchExams, isLoading: examsLoading } = useExamsStore()
  const { rooms, initializeData, summary } = useSeatsStore()

  useEffect(() => {
    fetchStudents({ page: 1, limit: 500, search: '', status: 'all', eligibility: 'all', departmentIds: undefined, semesters: undefined })
    fetchTeachers({ page: 1, limit: 100, search: '', status: 'all' })
    fetchExams({ page: 1, limit: 100, search: '', status: 'all' })
    initializeData()
  }, [fetchStudents, fetchTeachers, fetchExams, initializeData])

  const totalStudents = studentPagination.total || students.length
  const eligibleStudents = students.filter((s) => s.isEligible).length
  const activeExams = exams.filter((e) => e.status === 'scheduled' || e.status === 'ongoing').length
  const availableRooms = rooms.filter((r) => r.isAvailable)
  const seatCapacity = availableRooms.reduce((sum, r) => sum + r.capacity, 0)
  // Students seated per exam (each student counted once, however many papers they sit).
  const seatsByExam = useMemo(() => new Map((summary?.exams ?? []).map((e) => [e.examId, e.students])), [summary])
  const liveExamIds = useMemo(() => new Set(exams.filter((e) => e.status === 'scheduled' || e.status === 'ongoing').map((e) => e.id)), [exams])
  const allocatedCount = (summary?.exams ?? []).filter((e) => liveExamIds.has(e.examId)).reduce((sum, e) => sum + e.seats, 0)

  const deptData = useMemo(() => {
    const counts = new Map<string, number>()
    students.forEach((s) => counts.set(s.departmentName || 'Unknown', (counts.get(s.departmentName || 'Unknown') ?? 0) + 1))
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [students])

  const statusCounts = useMemo(() => {
    const counts: Record<ExamStatus, number> = { draft: 0, scheduled: 0, ongoing: 0, completed: 0, cancelled: 0 }
    exams.forEach((e) => counts[e.status]++)
    return counts
  }, [exams])

  const upcoming = useMemo(
    () =>
      exams
        .filter((e) => e.status !== 'cancelled' && e.status !== 'completed')
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5),
    [exams]
  )

  const loading = studentsLoading && students.length === 0

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.firstName ?? 'there'}`}
        description="Here's what's happening across your institution today."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/exams">
                <CalendarPlus /> New exam
              </Link>
            </Button>
            <Button asChild>
              <Link href="/seat-allocation">
                <LayoutGrid /> Allocate seats
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={totalStudents}
          icon={<GraduationCap />}
          tone="indigo"
          loading={loading}
          hint={`${eligibleStudents} eligible for exams`}
        />
        <StatCard
          label="Teachers"
          value={teacherPagination.total || teachers.length}
          icon={<Users />}
          tone="sky"
          loading={teachersLoading && teachers.length === 0}
          hint={`${teachers.filter((t) => t.isAvailable && t.status === 'active').length} available for duty`}
        />
        <StatCard
          label="Active exams"
          value={activeExams}
          icon={<CalendarDays />}
          tone="amber"
          loading={examsLoading && exams.length === 0}
          hint={`${statusCounts.draft} in draft`}
        />
        <StatCard
          label="Seats allocated"
          value={allocatedCount}
          icon={<DoorOpen />}
          tone="emerald"
          hint={`Across active exams' papers · ${availableRooms.length} rooms, ${seatCapacity} seats`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardToolbar title="Students by department" description="Enrolment across departments" />
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : deptData.length === 0 ? (
              <EmptyState icon={<GraduationCap />} title="No students yet" description="Add students to see the breakdown." />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={170}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(v) => [v, 'Students']}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardToolbar title="Exam pipeline" description={`${exams.length} exams in total`} />
          <CardContent className="space-y-4">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{status}</span>
                  <span className="font-medium tabular-nums">{statusCounts[status]}</span>
                </div>
                <Progress value={exams.length ? (statusCounts[status] / exams.length) * 100 : 0} tone={STATUS_BAR[status]} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardToolbar
            title="Upcoming exams"
            description="Seating progress for scheduled and draft exams"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/exams">
                  View all <ArrowRight />
                </Link>
              </Button>
            }
          />
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <div className="p-5 pt-0">
                <EmptyState icon={<CalendarDays />} title="No upcoming exams" description="Create an exam to start planning." />
              </div>
            ) : (
              <ul className="divide-y">
                {upcoming.map((exam) => {
                  const seated = seatsByExam.get(exam.id) ?? 0
                  const [month, day] = formatDay(exam.startDate, { year: undefined }).split(' ')
                  return (
                    <li key={exam.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border bg-muted/40 py-1.5">
                        <span className="text-[0.65rem] font-medium uppercase text-muted-foreground">{month}</span>
                        <span className="text-lg font-semibold leading-none">{day?.replace(',', '')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{exam.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {EXAM_TYPE_LABEL[exam.examType]} · Semester {exam.semester} · {exam.subjects?.length ?? 0} papers
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium tabular-nums">{seated}</p>
                        <p className="text-xs text-muted-foreground">seated</p>
                      </div>
                      <Badge variant={EXAM_STATUS_BADGE[exam.status]}>{exam.status}</Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardToolbar title="Quick actions" />
          <CardContent className="grid gap-2">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                {label}
                <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
