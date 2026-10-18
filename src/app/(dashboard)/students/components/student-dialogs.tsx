'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, GraduationCap, Pencil, UserPlus } from 'lucide-react'
import { useStudentsStore, type Student } from '@/modules/students'
import { useCatalogStore } from '@/modules/catalog'
import { useMinAttendance } from '@/hooks/useMinAttendance'
import { STUDENT_STATUS_BADGE, formatDay } from '@/lib/format'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Alert, Avatar, Progress } from '@/components/ui/misc'
import { Switch } from '@/components/ui/switch'
import { PasswordInput } from '@/components/password-input'
import { Detail, DetailGrid } from '@/components/detail'

type StudentStatus = Student['status']

interface FormState {
  rollNumber: string
  registrationNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: Student['gender']
  dateOfBirth: string
  departmentId: string
  courseId: string
  currentSemester: number
  section: string
  batchYear: number
  password: string
  status: StudentStatus
  attendancePercentage: number
  eligibilityOverride: boolean
  isEligible: boolean
}

function toForm(student?: Student | null): FormState {
  return {
    rollNumber: student?.rollNumber ?? '',
    registrationNumber: student?.registrationNumber ?? '',
    firstName: student?.firstName ?? '',
    lastName: student?.lastName ?? '',
    email: student?.email ?? '',
    phone: student?.phone ?? '',
    gender: student?.gender ?? 'male',
    dateOfBirth: student?.dateOfBirth ?? '',
    departmentId: student?.departmentId ?? '',
    courseId: student?.courseId ?? '',
    currentSemester: student?.currentSemester ?? 1,
    section: student?.section ?? 'A',
    batchYear: student?.batchYear ?? new Date().getFullYear(),
    password: '',
    status: student?.status ?? 'active',
    attendancePercentage: student?.attendancePercentage ?? 100,
    eligibilityOverride: student?.eligibilityOverride ?? false,
    isEligible: student?.isEligible ?? true,
  }
}

const randomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const values = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

/** Add (no `student`) or edit a student. */
export function StudentFormDialog({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  student?: Student | null
  onSaved?: (student: Student) => void
}) {
  const editing = !!student
  const minAttendance = useMinAttendance()
  const { createStudent, updateStudent, isSubmitting } = useStudentsStore()
  const { departments, courses, isLoaded, fetchCatalog } = useCatalogStore()
  const [form, setForm] = useState<FormState>(() => toForm(student))
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(toForm(student))
      setError('')
      if (!isLoaded) fetchCatalog()
    }
  }, [open, student, isLoaded, fetchCatalog])

  // Default to the first department and one of its courses once the catalog loads.
  useEffect(() => {
    if (!open || form.departmentId || departments.length === 0) return
    const departmentId = departments[0].id
    setForm((f) => ({ ...f, departmentId, courseId: courses.find((c) => c.departmentId === departmentId)?.id ?? '' }))
  }, [open, departments, courses, form.departmentId])

  const departmentCourses = useMemo(() => courses.filter((c) => c.departmentId === form.departmentId), [courses, form.departmentId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const common = {
      rollNumber: form.rollNumber,
      registrationNumber: form.registrationNumber,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      gender: form.gender,
      dateOfBirth: form.dateOfBirth || undefined,
      departmentId: form.departmentId,
      courseId: form.courseId,
      currentSemester: Number(form.currentSemester),
      section: form.section,
      batchYear: Number(form.batchYear),
    }
    const saved = editing
      ? await updateStudent(student.id, {
          ...common,
          status: form.status,
          attendancePercentage: Number(form.attendancePercentage),
          eligibilityOverride: form.eligibilityOverride,
          // With an override the admin decides; otherwise the server derives it from attendance.
          isEligible: form.eligibilityOverride ? form.isEligible : undefined,
        })
      : await createStudent({ ...common, password: form.password })

    if (!saved) {
      setError(useStudentsStore.getState().error || 'Could not save the student.')
      return
    }
    toast.success(editing ? 'Student updated' : 'Student added', `${saved.firstName} ${saved.lastName} · ${saved.rollNumber}`)
    onSaved?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader
            icon={editing ? <Pencil /> : <UserPlus />}
            title={editing ? 'Edit student' : 'Add student'}
            description={editing ? `${student.firstName} ${student.lastName} · ${student.rollNumber}` : 'Creates the student record and their sign-in account.'}
          />
          <DialogBody className="space-y-6">
            {error && <Alert tone="danger">{error}</Alert>}

            <section className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="s-first" required>
                <Input id="s-first" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              </Field>
              <Field label="Last name" htmlFor="s-last" required>
                <Input id="s-last" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="s-email" required>
                <Input id="s-email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="student@college.edu" />
              </Field>
              <Field label="Phone" htmlFor="s-phone">
                <Input id="s-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="Gender" htmlFor="s-gender" required>
                <Select id="s-gender" value={form.gender} onChange={(e) => set('gender', e.target.value as Student['gender'])}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Date of birth" htmlFor="s-dob">
                <Input id="s-dob" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </Field>
            </section>

            <section className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Academic</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Roll number" htmlFor="s-roll" required>
                  <Input id="s-roll" required value={form.rollNumber} onChange={(e) => set('rollNumber', e.target.value)} placeholder="CS2026001" />
                </Field>
                <Field label="Registration number" htmlFor="s-reg">
                  <Input id="s-reg" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} />
                </Field>
                <Field label="Department" htmlFor="s-dept" required>
                  <Select
                    id="s-dept"
                    required
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        departmentId: e.target.value,
                        courseId: courses.find((c) => c.departmentId === e.target.value)?.id ?? '',
                      }))
                    }
                  >
                    {departments.length === 0 && <option value="">Loading…</option>}
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Course" htmlFor="s-course" required>
                  <Select id="s-course" required value={form.courseId} onChange={(e) => set('courseId', e.target.value)}>
                    {departmentCourses.length === 0 && <option value="">No courses in this department</option>}
                    {departmentCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                  <Field label="Semester" htmlFor="s-sem" required>
                    <Input id="s-sem" type="number" min={1} max={12} required value={form.currentSemester} onChange={(e) => set('currentSemester', Number(e.target.value))} />
                  </Field>
                  <Field label="Section" htmlFor="s-section">
                    <Input id="s-section" maxLength={10} value={form.section} onChange={(e) => set('section', e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Batch year" htmlFor="s-batch" required>
                    <Input id="s-batch" type="number" min={1950} max={2100} required value={form.batchYear} onChange={(e) => set('batchYear', Number(e.target.value))} />
                  </Field>
                </div>
              </div>
            </section>

            {editing ? (
              <section className="space-y-4">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status & eligibility</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status" htmlFor="s-status">
                    <Select id="s-status" value={form.status} onChange={(e) => set('status', e.target.value as StudentStatus)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="graduated">Graduated</option>
                      <option value="suspended">Suspended</option>
                    </Select>
                  </Field>
                  <Field label="Attendance %" htmlFor="s-att" hint={`Below ${minAttendance}% makes the student ineligible unless overridden.`}>
                    <Input id="s-att" type="number" min={0} max={100} step={0.1} value={form.attendancePercentage} onChange={(e) => set('attendancePercentage', Number(e.target.value))} />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Override eligibility</p>
                    <p className="text-xs text-muted-foreground">Decide eligibility manually instead of from attendance.</p>
                  </div>
                  <Switch checked={form.eligibilityOverride} onCheckedChange={(v) => set('eligibilityOverride', v)} aria-label="Override eligibility" />
                  {form.eligibilityOverride && (
                    <label className="flex w-full items-center justify-between gap-3 border-t pt-3 text-sm">
                      Eligible for exams
                      <Switch checked={form.isEligible} onCheckedChange={(v) => set('isEligible', v)} aria-label="Eligible for exams" />
                    </label>
                  )}
                </div>
              </section>
            ) : (
              <Field
                label="Initial password"
                htmlFor="s-password"
                required
                hint={
                  <>
                    The student signs in with their email or roll number.{' '}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => set('password', randomPassword())}>
                      Generate one
                    </button>
                  </>
                }
              >
                <PasswordInput id="s-password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" />
              </Field>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save changes' : 'Add student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function StudentDetailsDialog({
  student,
  onOpenChange,
  onEdit,
}: {
  student: Student | null
  onOpenChange: (open: boolean) => void
  onEdit?: () => void
}) {
  const minAttendance = useMinAttendance()
  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {student && (
          <>
            <DialogHeader icon={<GraduationCap />} title="Student profile" description={student.rollNumber} />
            <DialogBody className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={`${student.firstName} ${student.lastName}`} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={STUDENT_STATUS_BADGE[student.status]} dot>
                      {student.status}
                    </Badge>
                    <Badge variant={student.isEligible ? 'success' : 'danger'}>
                      {student.isEligible ? 'Eligible' : 'Not eligible'}
                      {student.eligibilityOverride && ' (override)'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Attendance</span>
                  <span className="font-semibold tabular-nums">{student.attendancePercentage}%</span>
                </div>
                <Progress value={student.attendancePercentage} tone={student.attendancePercentage >= minAttendance ? 'success' : 'danger'} />
              </div>

              <DetailGrid>
                <Detail label="Roll number">{student.rollNumber}</Detail>
                <Detail label="Registration no.">{student.registrationNumber}</Detail>
                <Detail label="Department">{student.departmentName}</Detail>
                <Detail label="Course">{student.courseName}</Detail>
                <Detail label="Semester / section">
                  {student.currentSemester}
                  {student.section && ` · ${student.section}`}
                </Detail>
                <Detail label="Batch">{student.batchYear}</Detail>
                <Detail label="Gender">
                  <span className="capitalize">{student.gender}</span>
                </Detail>
                <Detail label="Date of birth">{student.dateOfBirth && formatDay(student.dateOfBirth)}</Detail>
                <Detail label="Phone">{student.phone}</Detail>
                <Detail label="Blood group">{student.bloodGroup}</Detail>
                <Detail label="Emergency contact">
                  {student.emergencyContactName}
                  {student.emergencyContactPhone && ` · ${student.emergencyContactPhone}`}
                </Detail>
                <Detail label="Address" className="col-span-2 sm:col-span-3">
                  {student.address}
                </Detail>
              </DetailGrid>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {onEdit && (
                <Button onClick={onEdit}>
                  <Pencil /> Edit
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

const ATTENDANCE_DELTA = { present: 1, late: 0.5, excused: 0, absent: -2 } as const
type AttendanceMark = keyof typeof ATTENDANCE_DELTA

export function AttendanceDialog({ student, onOpenChange }: { student: Student | null; onOpenChange: (open: boolean) => void }) {
  const { updateStudent, isSubmitting } = useStudentsStore()
  const minAttendance = useMinAttendance()
  const [mark, setMark] = useState<AttendanceMark>('present')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (student) {
      setMark('present')
      setRemarks('')
    }
  }, [student])

  if (!student) return <Dialog open={false} onOpenChange={onOpenChange} />

  const current = student.attendancePercentage ?? 0
  const next = Math.max(0, Math.min(100, Math.round((current + ATTENDANCE_DELTA[mark]) * 10) / 10))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const updated = await updateStudent(student.id, { attendancePercentage: next })
    if (!updated) {
      toast.error('Could not record attendance', useStudentsStore.getState().error ?? undefined)
      return
    }
    toast.success(`Marked ${mark}`, `${updated.firstName} ${updated.lastName}: ${updated.attendancePercentage}% · ${updated.isEligible ? 'eligible' : 'not eligible'}`)
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={<CalendarCheck />} title="Record attendance" description={`${student.firstName} ${student.lastName} · ${student.rollNumber}`} />
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="att-date">
                <Input id="att-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Status" htmlFor="att-status">
                <Select id="att-status" value={mark} onChange={(e) => setMark(e.target.value as AttendanceMark)}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                  <option value="absent">Absent</option>
                </Select>
              </Field>
            </div>
            <Field label="Remarks" htmlFor="att-remarks">
              <Textarea id="att-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes" />
            </Field>
            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Attendance</span>
              <span className="font-medium tabular-nums">
                {current}% → <span className={next >= minAttendance ? 'text-success' : 'text-destructive'}>{next}%</span>
              </span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" loading={isSubmitting}>
              Save attendance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
