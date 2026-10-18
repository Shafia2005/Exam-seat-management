'use client'

import { useEffect, useState } from 'react'
import { CalendarCheck, Eye, FileSpreadsheet, GraduationCap, KeyRound, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { studentService, useStudentsStore, type Student } from '@/modules/students'
import { useCatalogStore } from '@/modules/catalog'
import { useMinAttendance } from '@/hooks/useMinAttendance'
import { STUDENT_STATUS_BADGE } from '@/lib/format'
import { confirmAction } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Alert, Avatar, EmptyState, PageHeader, Pagination, Progress, Skeleton } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ResetPasswordDialog } from '@/components/reset-password-dialog'
import { ImportDialog } from '@/components/import-dialog'
import { STUDENT_IMPORT_COLUMNS } from '@/lib/import-columns'
import { AttendanceDialog, StudentDetailsDialog, StudentFormDialog } from './components/student-dialogs'

const PAGE_SIZE = 10

export default function StudentsPage() {
  const { students, pagination, isLoading, error, filters, fetchStudents, setFilters, setPage, deleteStudent } = useStudentsStore()
  const { departments, isLoaded: catalogLoaded, fetchCatalog } = useCatalogStore()
  const minAttendance = useMinAttendance()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [viewing, setViewing] = useState<Student | null>(null)
  const [attendanceFor, setAttendanceFor] = useState<Student | null>(null)
  const [resetFor, setResetFor] = useState<Student | null>(null)

  useEffect(() => {
    fetchStudents({ page: 1, limit: PAGE_SIZE, search: '', status: 'all', eligibility: 'all', departmentId: undefined })
    if (!catalogLoaded) fetchCatalog()
  }, [fetchStudents, fetchCatalog, catalogLoaded])

  // Debounced search
  useEffect(() => {
    const term = search.trim()
    if (term === (filters.search ?? '')) return
    const t = setTimeout(() => setFilters({ search: term }), 350)
    return () => clearTimeout(t)
  }, [search, filters.search, setFilters])

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (student: Student) => {
    setViewing(null)
    setEditing(student)
    setFormOpen(true)
  }

  const remove = async (student: Student) => {
    const ok = await confirmAction({
      title: `Delete ${student.firstName} ${student.lastName}?`,
      description: 'This removes the student, their sign-in account and all their seat allocations. This cannot be undone.',
      confirmLabel: 'Delete student',
      destructive: true,
    })
    if (!ok) return
    if (await deleteStudent(student.id)) toast.success('Student deleted', student.rollNumber)
    else toast.error('Could not delete the student', useStudentsStore.getState().error ?? undefined)
  }

  const hasFilters = !!(filters.search || filters.departmentId || (filters.status && filters.status !== 'all') || (filters.eligibility && filters.eligibility !== 'all'))

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${pagination.total} students enrolled · manage records, attendance and eligibility`}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet /> Import
            </Button>
            <Button onClick={openAdd}>
              <Plus /> Add student
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="min-w-[220px] flex-1">
            <Input
              icon={<Search />}
              placeholder="Search name, roll number or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search students"
            />
          </div>
          <Select
            aria-label="Filter by department"
            className="w-48"
            value={filters.departmentId ?? ''}
            onChange={(e) => setFilters({ departmentId: e.target.value || undefined })}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" className="w-36" value={filters.status || 'all'} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select
            aria-label="Filter by eligibility"
            className="w-40"
            value={filters.eligibility || 'all'}
            onChange={(e) => setFilters({ eligibility: e.target.value })}
          >
            <option value="all">Any eligibility</option>
            <option value="eligible">Eligible</option>
            <option value="ineligible">Not eligible</option>
          </Select>
        </div>

        {error && !isLoading && (
          <div className="p-4 pb-0">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        {isLoading && students.length === 0 ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<GraduationCap />}
              title={hasFilters ? 'No students match your filters' : 'No students yet'}
              description={hasFilters ? 'Try a different search or clear the filters.' : 'Add your first student to get started.'}
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('')
                      setFilters({ search: '', departmentId: undefined, status: 'all', eligibility: 'all' })
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={openAdd}>
                    <Plus /> Add student
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            <Table className={isLoading ? 'opacity-60 transition-opacity' : undefined}>
              <THead>
                <tr>
                  <TH>Student</TH>
                  <TH>Roll no.</TH>
                  <TH>Department</TH>
                  <TH className="text-center">Sem</TH>
                  <TH>Attendance</TH>
                  <TH>Status</TH>
                  <TH className="w-12">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {students.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <button onClick={() => setViewing(s)} className="flex items-center gap-3 text-left">
                        <Avatar name={`${s.firstName} ${s.lastName}`} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">
                            {s.firstName} {s.lastName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{s.email}</span>
                        </span>
                      </button>
                    </TD>
                    <TD className="font-mono text-xs">{s.rollNumber}</TD>
                    <TD className="max-w-[220px] truncate text-muted-foreground">{s.departmentName}</TD>
                    <TD className="text-center tabular-nums">{s.currentSemester}</TD>
                    <TD>
                      <div className="flex w-28 items-center gap-2">
                        <Progress value={s.attendancePercentage} tone={s.attendancePercentage >= minAttendance ? 'success' : 'danger'} />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(s.attendancePercentage)}%</span>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={STUDENT_STATUS_BADGE[s.status]} dot>
                          {s.status}
                        </Badge>
                        {!s.isEligible && <Badge variant="danger">Not eligible</Badge>}
                      </div>
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.firstName} ${s.lastName}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setViewing(s)}>
                            <Eye /> View profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEdit(s)}>
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setAttendanceFor(s)}>
                            <CalendarCheck /> Record attendance
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setResetFor(s)}>
                            <KeyRound /> Reset password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => remove(s)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              noun="students"
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <StudentFormDialog open={formOpen} onOpenChange={setFormOpen} student={editing} />
      <StudentDetailsDialog student={viewing} onOpenChange={(o) => !o && setViewing(null)} onEdit={() => viewing && openEdit(viewing)} />
      <AttendanceDialog student={attendanceFor} onOpenChange={(o) => !o && setAttendanceFor(null)} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} kind="students" columns={STUDENT_IMPORT_COLUMNS} onImported={() => fetchStudents()} />

      <ResetPasswordDialog
        open={!!resetFor}
        onOpenChange={(o) => !o && setResetFor(null)}
        name={resetFor ? `${resetFor.firstName} ${resetFor.lastName}` : ''}
        onReset={(password) => studentService.resetPassword(resetFor!.id, password)}
      />
    </div>
  )
}
