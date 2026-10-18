'use client'

import { useEffect, useState } from 'react'
import { Pencil, UserPlus, Users } from 'lucide-react'
import { useTeachersStore, type Teacher } from '@/modules/teachers'
import { useCatalogStore } from '@/modules/catalog'
import { TEACHER_STATUS_BADGE, formatDay, humanize } from '@/lib/format'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { Alert, Avatar } from '@/components/ui/misc'
import { Switch } from '@/components/ui/switch'
import { PasswordInput } from '@/components/password-input'
import { Detail, DetailGrid } from '@/components/detail'

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Lab Instructor']

interface FormState {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  departmentId: string
  designation: string
  specialization: string
  qualification: string
  experienceYears: number
  joiningDate: string
  maxDutiesPerDay: number
  isAvailable: boolean
  status: Teacher['status']
  password: string
}

function toForm(t?: Teacher | null): FormState {
  return {
    employeeId: t?.employeeId ?? '',
    firstName: t?.firstName ?? '',
    lastName: t?.lastName ?? '',
    email: t?.email ?? '',
    phone: t?.phone ?? '',
    departmentId: t?.departmentId ?? '',
    designation: t?.designation ?? 'Assistant Professor',
    specialization: t?.specialization ?? '',
    qualification: t?.qualification ?? '',
    experienceYears: t?.experienceYears ?? 0,
    joiningDate: t?.joiningDate ?? '',
    maxDutiesPerDay: t?.maxDutiesPerDay ?? 2,
    isAvailable: t?.isAvailable ?? true,
    status: t?.status ?? 'active',
    password: '',
  }
}

/** Add (no `teacher`) or edit a teacher. */
export function TeacherFormDialog({
  open,
  onOpenChange,
  teacher,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher?: Teacher | null
}) {
  const editing = !!teacher
  const { createTeacher, updateTeacher, isSubmitting } = useTeachersStore()
  const { departments, isLoaded, fetchCatalog } = useCatalogStore()
  const [form, setForm] = useState<FormState>(() => toForm(teacher))
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(toForm(teacher))
      setError('')
      if (!isLoaded) fetchCatalog()
    }
  }, [open, teacher, isLoaded, fetchCatalog])

  useEffect(() => {
    if (open && !form.departmentId && departments.length) setForm((f) => ({ ...f, departmentId: departments[0].id }))
  }, [open, departments, form.departmentId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const data = {
      employeeId: form.employeeId,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      departmentId: form.departmentId,
      designation: form.designation,
      specialization: form.specialization,
      qualification: form.qualification,
      experienceYears: Number(form.experienceYears),
      joiningDate: form.joiningDate || undefined,
      maxDutiesPerDay: Number(form.maxDutiesPerDay),
    }
    const saved = editing
      ? await updateTeacher(teacher.id, { ...data, isAvailable: form.isAvailable, status: form.status })
      : await createTeacher({ ...data, password: form.password })
    if (!saved) {
      setError(useTeachersStore.getState().error || 'Could not save the teacher.')
      return
    }
    toast.success(editing ? 'Teacher updated' : 'Teacher added', `${saved.firstName} ${saved.lastName} · ${saved.employeeId}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader
            icon={editing ? <Pencil /> : <UserPlus />}
            title={editing ? 'Edit teacher' : 'Add teacher'}
            description={editing ? `${teacher.firstName} ${teacher.lastName} · ${teacher.employeeId}` : 'Creates the faculty record and their sign-in account.'}
          />
          <DialogBody className="space-y-6">
            {error && <Alert tone="danger">{error}</Alert>}
            <section className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="t-first" required>
                <Input id="t-first" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Dr. Asha" />
              </Field>
              <Field label="Last name" htmlFor="t-last" required>
                <Input id="t-last" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="t-email" required>
                <Input id="t-email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="t-phone">
                <Input id="t-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </section>

            <section className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Employment</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Employee ID" htmlFor="t-emp" required>
                  <Input id="t-emp" required value={form.employeeId} onChange={(e) => set('employeeId', e.target.value.toUpperCase())} placeholder="TCH013" />
                </Field>
                <Field label="Department" htmlFor="t-dept" required>
                  <Select id="t-dept" required value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                    {departments.length === 0 && <option value="">Loading…</option>}
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Designation" htmlFor="t-designation" required>
                  <Input id="t-designation" list="designations" required value={form.designation} onChange={(e) => set('designation', e.target.value)} />
                  <datalist id="designations">
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Specialization" htmlFor="t-spec">
                  <Input id="t-spec" value={form.specialization} onChange={(e) => set('specialization', e.target.value)} />
                </Field>
                <Field label="Qualification" htmlFor="t-qual">
                  <Input id="t-qual" value={form.qualification} onChange={(e) => set('qualification', e.target.value)} placeholder="Ph.D. in Computer Science" />
                </Field>
                <Field label="Joining date" htmlFor="t-join">
                  <Input id="t-join" type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} />
                </Field>
                <Field label="Experience (years)" htmlFor="t-exp">
                  <Input id="t-exp" type="number" min={0} max={70} value={form.experienceYears} onChange={(e) => set('experienceYears', Number(e.target.value))} />
                </Field>
                <Field label="Max invigilation duties / day" htmlFor="t-max">
                  <Input id="t-max" type="number" min={0} max={10} value={form.maxDutiesPerDay} onChange={(e) => set('maxDutiesPerDay', Number(e.target.value))} />
                </Field>
              </div>
            </section>

            {editing ? (
              <section className="grid gap-4 sm:grid-cols-2">
                <Field label="Status" htmlFor="t-status">
                  <Select id="t-status" value={form.status} onChange={(e) => set('status', e.target.value as Teacher['status'])}>
                    <option value="active">Active</option>
                    <option value="on_leave">On leave</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </Field>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 sm:mt-6">
                  <div>
                    <p className="text-sm font-medium">Available for duty</p>
                    <p className="text-xs text-muted-foreground">Included in automatic rosters</p>
                  </div>
                  <Switch checked={form.isAvailable} onCheckedChange={(v) => set('isAvailable', v)} aria-label="Available for duty" />
                </div>
              </section>
            ) : (
              <Field label="Initial password" htmlFor="t-password" required hint="They sign in with their email or employee ID.">
                <PasswordInput id="t-password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" />
              </Field>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save changes' : 'Add teacher'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeacherDetailsDialog({
  teacher,
  onOpenChange,
  onEdit,
}: {
  teacher: Teacher | null
  onOpenChange: (open: boolean) => void
  onEdit?: () => void
}) {
  return (
    <Dialog open={!!teacher} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {teacher && (
          <>
            <DialogHeader icon={<Users />} title="Faculty profile" description={teacher.employeeId} />
            <DialogBody className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={`${teacher.firstName} ${teacher.lastName}`} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">
                    {teacher.firstName} {teacher.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {teacher.designation} · {teacher.departmentName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={TEACHER_STATUS_BADGE[teacher.status]} dot>
                      {humanize(teacher.status)}
                    </Badge>
                    <Badge variant={teacher.isAvailable ? 'success' : 'secondary'}>{teacher.isAvailable ? 'Available for duty' : 'Unavailable'}</Badge>
                  </div>
                </div>
              </div>
              <DetailGrid>
                <Detail label="Employee ID">{teacher.employeeId}</Detail>
                <Detail label="Email">{teacher.email}</Detail>
                <Detail label="Phone">{teacher.phone}</Detail>
                <Detail label="Department">{teacher.departmentName}</Detail>
                <Detail label="Specialization">{teacher.specialization}</Detail>
                <Detail label="Qualification">{teacher.qualification}</Detail>
                <Detail label="Experience">{`${teacher.experienceYears} years`}</Detail>
                <Detail label="Joined">{teacher.joiningDate && formatDay(teacher.joiningDate)}</Detail>
                <Detail label="Max duties / day">{String(teacher.maxDutiesPerDay)}</Detail>
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
