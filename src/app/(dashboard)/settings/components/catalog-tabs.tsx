'use client'

import { useState } from 'react'
import { BookOpen, Building, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { catalogService, useCatalogStore, type Course, type Department } from '@/modules/catalog'
import { errorMessage } from '@/lib/api-client'
import { confirmAction } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Alert, EmptyState, Skeleton } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useList } from './use-list'

/** Keeps the cached department/course lists used by the student and teacher forms in sync. */
const refreshCatalog = () => useCatalogStore.getState().fetchCatalog()

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

async function confirmDelete(what: string, name: string, run: () => Promise<void>, reload: () => Promise<void>) {
  const ok = await confirmAction({ title: `Delete ${what} “${name}”?`, confirmLabel: `Delete ${what}`, destructive: true })
  if (!ok) return
  try {
    await run()
    toast.success(`${what[0].toUpperCase()}${what.slice(1)} deleted`, name)
    await reload()
    refreshCatalog()
  } catch (err) {
    toast.error(`Could not delete the ${what}`, errorMessage(err, ''))
  }
}

// ─── Departments ────────────────────────────────────────────────────────────

export function DepartmentsTab() {
  const { items, loading, error, reload } = useList(() => catalogService.getDepartments())
  const [editing, setEditing] = useState<Department | null | undefined>(undefined)
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const open = (d: Department | null) => {
    setForm({ name: d?.name ?? '', code: d?.code ?? '', description: d?.description ?? '' })
    setFormError('')
    setEditing(d)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (editing) await catalogService.updateDepartment(editing.id, form)
      else await catalogService.createDepartment(form)
      toast.success(editing ? 'Department updated' : 'Department added', form.name)
      setEditing(undefined)
      await reload()
      refreshCatalog()
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the department.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardToolbar
        title="Departments"
        description="Academic departments that own courses, students and faculty."
        actions={
          <Button onClick={() => open(null)}>
            <Plus /> Add department
          </Button>
        }
      />
      {error && (
        <CardContent>
          <Alert tone="danger">{error}</Alert>
        </CardContent>
      )}
      {loading ? (
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      ) : items.length === 0 ? (
        <CardContent>
          <EmptyState icon={<Building />} title="No departments yet" description="Add departments before creating courses, students or teachers." />
        </CardContent>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Department</TH>
              <TH>Code</TH>
              <TH className="text-right">Courses</TH>
              <TH className="text-right">Teachers</TH>
              <TH className="text-right">Students</TH>
              <TH className="w-12" />
            </tr>
          </THead>
          <TBody>
            {items.map((d) => (
              <TR key={d.id}>
                <TD>
                  <p className="font-medium">{d.name}</p>
                  {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                </TD>
                <TD className="font-mono text-xs">{d.code}</TD>
                <TD className="text-right tabular-nums">{d.courseCount ?? 0}</TD>
                <TD className="text-right tabular-nums">{d.teacherCount ?? 0}</TD>
                <TD className="text-right tabular-nums">{d.studentCount ?? 0}</TD>
                <TD>
                  <RowActions label={d.name} onEdit={() => open(d)} onDelete={() => confirmDelete('department', d.name, () => catalogService.deleteDepartment(d.id), reload)} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent size="sm">
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <DialogHeader icon={<Building />} title={editing ? 'Edit department' : 'Add department'} />
            <DialogBody className="space-y-4">
              {formError && <Alert tone="danger">{formError}</Alert>}
              <Field label="Name" htmlFor="dept-name" required>
                <Input id="dept-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Computer Science" />
              </Field>
              <Field label="Code" htmlFor="dept-code" required hint="Short unique code, e.g. CS.">
                <Input id="dept-code" required maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Description" htmlFor="dept-desc">
                <Textarea id="dept-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Save changes' : 'Add department'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ─── Courses ────────────────────────────────────────────────────────────────

export function CoursesTab() {
  const { items, loading, error, reload } = useList(() => catalogService.getCourses())
  const departments = useList(() => catalogService.getDepartments())
  const [editing, setEditing] = useState<Course | null | undefined>(undefined)
  const [form, setForm] = useState({ name: '', code: '', departmentId: '', durationYears: 4 })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const open = (c: Course | null) => {
    setForm({
      name: c?.name ?? '',
      code: c?.code ?? '',
      departmentId: c?.departmentId ?? departments.items[0]?.id ?? '',
      durationYears: c?.durationYears ?? 4,
    })
    setFormError('')
    setEditing(c)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const data = { ...form, durationYears: Number(form.durationYears) }
      if (editing) await catalogService.updateCourse(editing.id, data)
      else await catalogService.createCourse(data)
      toast.success(editing ? 'Course updated' : 'Course added', form.name)
      setEditing(undefined)
      await reload()
      refreshCatalog()
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the course.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardToolbar
        title="Courses"
        description="Programmes students enrol in, grouped by department."
        actions={
          <Button onClick={() => open(null)} disabled={departments.items.length === 0}>
            <Plus /> Add course
          </Button>
        }
      />
      {error && (
        <CardContent>
          <Alert tone="danger">{error}</Alert>
        </CardContent>
      )}
      {loading ? (
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      ) : items.length === 0 ? (
        <CardContent>
          <EmptyState
            icon={<BookOpen />}
            title="No courses yet"
            description={departments.items.length ? 'Add the programmes your students enrol in.' : 'Add a department first.'}
          />
        </CardContent>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Course</TH>
              <TH>Code</TH>
              <TH>Department</TH>
              <TH className="text-right">Duration</TH>
              <TH className="text-right">Students</TH>
              <TH className="w-12" />
            </tr>
          </THead>
          <TBody>
            {items.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.name}</TD>
                <TD className="font-mono text-xs">{c.code}</TD>
                <TD className="text-muted-foreground">{c.departmentName}</TD>
                <TD className="text-right tabular-nums">{c.durationYears} yrs</TD>
                <TD className="text-right tabular-nums">{c.studentCount ?? 0}</TD>
                <TD>
                  <RowActions label={c.name} onEdit={() => open(c)} onDelete={() => confirmDelete('course', c.name, () => catalogService.deleteCourse(c.id), reload)} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent size="sm">
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <DialogHeader icon={<BookOpen />} title={editing ? 'Edit course' : 'Add course'} />
            <DialogBody className="space-y-4">
              {formError && <Alert tone="danger">{formError}</Alert>}
              <Field label="Name" htmlFor="course-name" required>
                <Input id="course-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="B.Tech Computer Science" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code" htmlFor="course-code" required>
                  <Input id="course-code" required maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Duration (years)" htmlFor="course-years">
                  <Input id="course-years" type="number" min={1} max={10} value={form.durationYears} onChange={(e) => setForm({ ...form, durationYears: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Department" htmlFor="course-dept" required>
                <Select id="course-dept" required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                  {departments.items.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Save changes' : 'Add course'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
