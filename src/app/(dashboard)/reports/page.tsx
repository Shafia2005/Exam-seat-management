'use client'

import { useEffect, useMemo } from 'react'
import { AttendanceReport } from './attendance-report'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BarChart3, CalendarCheck, CalendarDays, ClipboardCheck, Download, GraduationCap, ShieldCheck } from 'lucide-react'
import { useStudentsStore } from '@/modules/students'
import { useExamsStore } from '@/modules/exams'
import { useMinAttendance } from '@/hooks/useMinAttendance'
import { EXAM_STATUS_BADGE, EXAM_TYPE_LABEL, downloadCsv, formatDayRange } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { EmptyState, PageHeader, Progress, Skeleton, StatCard } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/** Attendance bands around the institution's eligibility threshold. */
function attendanceBands(min: number) {
  const atRisk = Math.min(60, min)
  return [
    { key: 'excellent', label: 'Excellent (≥ 90%)', color: '#10b981', min: Math.max(90, min) },
    { key: 'good', label: `Eligible (${min}–${Math.max(89, min)}%)`, color: '#6366f1', min },
    { key: 'average', label: `At risk (${atRisk}–${min - 1}%)`, color: '#f59e0b', min: atRisk },
    { key: 'poor', label: `Poor (< ${atRisk}%)`, color: '#f43f5e', min: 0 },
  ].filter((b, i, all) => i === 0 || b.min < all[i - 1].min)
}

export default function ReportsPage() {
  const { students, fetchStudents, isLoading: studentsLoading } = useStudentsStore()
  const { exams, fetchExams, isLoading: examsLoading } = useExamsStore()
  const minAttendance = useMinAttendance()

  useEffect(() => {
    fetchStudents({ page: 1, limit: 500, search: '', status: 'all', eligibility: 'all', departmentId: undefined })
    fetchExams({ page: 1, limit: 100, search: '', status: 'all' })
  }, [fetchStudents, fetchExams])

  const loading = (studentsLoading && students.length === 0) || (examsLoading && exams.length === 0)
  const eligible = students.filter((s) => s.isEligible).length
  const activeExams = exams.filter((e) => e.status === 'scheduled' || e.status === 'ongoing').length
  const completedExams = exams.filter((e) => e.status === 'completed').length
  const avgAttendance = students.length ? students.reduce((s, x) => s + x.attendancePercentage, 0) / students.length : 0

  const departments = useMemo(() => {
    const map = new Map<string, { total: number; eligible: number; attendance: number }>()
    students.forEach((s) => {
      const key = s.departmentName || 'Unknown'
      const d = map.get(key) ?? { total: 0, eligible: 0, attendance: 0 }
      d.total++
      if (s.isEligible) d.eligible++
      d.attendance += s.attendancePercentage
      map.set(key, d)
    })
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, avg: d.attendance / d.total }))
      .sort((a, b) => b.total - a.total)
  }, [students])

  const bands = useMemo(() => {
    const defs = attendanceBands(minAttendance)
    return defs.map((b, i) => ({
      ...b,
      value: students.filter((s) => s.attendancePercentage >= b.min && (i === 0 || s.attendancePercentage < defs[i - 1].min)).length,
    }))
  }, [students, minAttendance])

  const exportStudents = () =>
    downloadCsv(
      'students-report.csv',
      ['Roll number', 'Name', 'Email', 'Department', 'Course', 'Semester', 'Attendance %', 'Eligible', 'Status'],
      students.map((s) => [s.rollNumber, `${s.firstName} ${s.lastName}`, s.email, s.departmentName, s.courseName, s.currentSemester, s.attendancePercentage, s.isEligible ? 'Yes' : 'No', s.status])
    )

  const exportExams = () =>
    downloadCsv(
      'exams-report.csv',
      ['Name', 'Type', 'Status', 'Academic year', 'Semester', 'Start', 'End', 'Papers'],
      exams.map((e) => [e.name, EXAM_TYPE_LABEL[e.examType], e.status, e.academicYear, e.semester, e.startDate, e.endDate, e.subjects?.length ?? 0])
    )

  return (
    <div>
      <PageHeader title="Reports" description="Attendance, eligibility and examination analytics." />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 /> Overview
          </TabsTrigger>
          <TabsTrigger value="students">
            <GraduationCap /> Students
          </TabsTrigger>
          <TabsTrigger value="exams">
            <CalendarDays /> Exams
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <ClipboardCheck /> Exam-day attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Students" value={students.length} icon={<GraduationCap />} tone="indigo" loading={loading} />
            <StatCard
              label="Eligible"
              value={students.length ? `${Math.round((eligible / students.length) * 100)}%` : '—'}
              icon={<ShieldCheck />}
              tone="emerald"
              loading={loading}
              hint={`${eligible} of ${students.length} students`}
            />
            <StatCard label="Average attendance" value={`${avgAttendance.toFixed(1)}%`} icon={<CalendarCheck />} tone="sky" loading={loading} />
            <StatCard label="Active exams" value={activeExams} icon={<CalendarDays />} tone="amber" loading={loading} hint={`${completedExams} completed`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardToolbar title="Attendance distribution" description={`Minimum for eligibility: ${minAttendance}% (Settings → Institution)`} />
              <CardContent>
                {loading ? (
                  <Skeleton className="h-56 w-full" />
                ) : students.length === 0 ? (
                  <EmptyState title="No students yet" />
                ) : (
                  <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                    <div className="size-44 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={bands} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                            {bands.map((b) => (
                              <Cell key={b.key} fill={b.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                              fontSize: 12,
                              color: 'hsl(var(--popover-foreground))',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="w-full space-y-2 text-sm">
                      {bands.map((b) => (
                        <li key={b.key} className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                          <span className="flex-1 text-muted-foreground">{b.label}</span>
                          <span className="font-medium tabular-nums">{b.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardToolbar title="Eligibility by department" />
              <CardContent className="space-y-4">
                {loading ? (
                  <Skeleton className="h-56 w-full" />
                ) : departments.length === 0 ? (
                  <EmptyState title="No department data" />
                ) : (
                  departments.map((d) => (
                    <div key={d.name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{d.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          <span className="font-medium text-foreground">{d.eligible}</span>/{d.total} eligible
                        </span>
                      </div>
                      <Progress value={(d.eligible / d.total) * 100} tone={d.eligible / d.total >= 0.9 ? 'success' : d.eligible / d.total >= 0.7 ? 'primary' : 'warning'} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardToolbar
              title="Department summary"
              description={`${students.length} students`}
              actions={
                <Button variant="outline" onClick={exportStudents} disabled={!students.length}>
                  <Download /> Download student report
                </Button>
              }
            />
            {departments.length === 0 ? (
              <CardContent>
                <EmptyState title="No student records" />
              </CardContent>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Department</TH>
                    <TH className="text-right">Students</TH>
                    <TH className="text-right">Eligible</TH>
                    <TH className="text-right">Not eligible</TH>
                    <TH className="w-48">Avg. attendance</TH>
                  </tr>
                </THead>
                <TBody>
                  {departments.map((d) => (
                    <TR key={d.name}>
                      <TD className="font-medium">{d.name}</TD>
                      <TD className="text-right tabular-nums">{d.total}</TD>
                      <TD className="text-right tabular-nums text-success">{d.eligible}</TD>
                      <TD className="text-right tabular-nums text-destructive">{d.total - d.eligible}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Progress value={d.avg} tone={d.avg >= minAttendance ? 'success' : 'danger'} />
                          <span className="w-12 text-right text-xs tabular-nums">{d.avg.toFixed(1)}%</span>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="exams">
          <Card>
            <CardToolbar
              title="Examinations"
              description={`${exams.length} exams`}
              actions={
                <Button variant="outline" onClick={exportExams} disabled={!exams.length}>
                  <Download /> Download exam report
                </Button>
              }
            />
            {exams.length === 0 ? (
              <CardContent>
                <EmptyState icon={<CalendarDays />} title="No exams to report" />
              </CardContent>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Exam</TH>
                    <TH>Type</TH>
                    <TH>Dates</TH>
                    <TH className="text-right">Papers</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {exams.map((e) => (
                    <TR key={e.id}>
                      <TD>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.academicYear} · Semester {e.semester}
                        </p>
                      </TD>
                      <TD className="text-muted-foreground">{EXAM_TYPE_LABEL[e.examType]}</TD>
                      <TD className="whitespace-nowrap text-muted-foreground">{formatDayRange(e.startDate, e.endDate)}</TD>
                      <TD className="text-right tabular-nums">{e.subjects?.length ?? 0}</TD>
                      <TD>
                        <Badge variant={EXAM_STATUS_BADGE[e.status]} dot>
                          {e.status}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceReport exams={exams} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
