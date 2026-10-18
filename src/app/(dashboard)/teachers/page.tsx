'use client'

import { useEffect, useState } from 'react'
import { Eye, FileSpreadsheet, KeyRound, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { teacherService, useTeachersStore, type Teacher } from '@/modules/teachers'
import { useCatalogStore } from '@/modules/catalog'
import { TEACHER_STATUS_BADGE, humanize } from '@/lib/format'
import { confirmAction } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Alert, Avatar, EmptyState, PageHeader, Pagination, Skeleton } from '@/components/ui/misc'
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
import { TEACHER_IMPORT_COLUMNS } from '@/lib/import-columns'
import { TeacherDetailsDialog, TeacherFormDialog } from './components/teacher-dialogs'

const PAGE_SIZE = 10

export default function TeachersPage() {
  const { teachers, pagination, isLoading, error, filters, fetchTeachers, setFilters, setPage, deleteTeacher } = useTeachersStore()
  const { departments, isLoaded: catalogLoaded, fetchCatalog } = useCatalogStore()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [viewing, setViewing] = useState<Teacher | null>(null)
  const [resetFor, setResetFor] = useState<Teacher | null>(null)

  useEffect(() => {
    fetchTeachers({ page: 1, limit: PAGE_SIZE, search: '', status: 'all', departmentId: undefined })
    if (!catalogLoaded) fetchCatalog()
  }, [fetchTeachers, fetchCatalog, catalogLoaded])

  useEffect(() => {
    const term = search.trim()
    if (term === (filters.search ?? '')) return
    const t = setTimeout(() => setFilters({ search: term }), 350)
    return () => clearTimeout(t)
  }, [search, filters.search, setFilters])

  const openEdit = (t: Teacher) => {
    setViewing(null)
    setEditing(t)
    setFormOpen(true)
  }

  const remove = async (t: Teacher) => {
    const ok = await confirmAction({
      title: `Delete ${t.firstName} ${t.lastName}?`,
      description: 'This removes the teacher, their sign-in account and all their invigilation duties. This cannot be undone.',
      confirmLabel: 'Delete teacher',
      destructive: true,
    })
    if (!ok) return
    if (await deleteTeacher(t.id)) toast.success('Teacher deleted', t.employeeId)
    else toast.error('Could not delete the teacher', useTeachersStore.getState().error ?? undefined)
  }

  const hasFilters = !!(filters.search || filters.departmentId || (filters.status && filters.status !== 'all'))

  return (
    <div>
      <PageHeader
        title="Teachers"
        description={`${pagination.total} faculty members · invigilation capacity and availability`}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet /> Import
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Add teacher
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="min-w-[220px] flex-1">
            <Input
              icon={<Search />}
              placeholder="Search name, employee ID, email or designation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search teachers"
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
            <option value="on_leave">On leave</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        {error && !isLoading && (
          <div className="p-4 pb-0">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        {isLoading && teachers.length === 0 ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Users />}
              title={hasFilters ? 'No teachers match your filters' : 'No teachers yet'}
              description={hasFilters ? 'Try a different search or clear the filters.' : 'Add faculty members to build invigilation rosters.'}
              action={
                hasFilters && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('')
                      setFilters({ search: '', departmentId: undefined, status: 'all' })
                    }}
                  >
                    Clear filters
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
                  <TH>Faculty member</TH>
                  <TH>Employee ID</TH>
                  <TH>Department</TH>
                  <TH>Designation</TH>
                  <TH className="text-center">Duties / day</TH>
                  <TH>Status</TH>
                  <TH className="w-12">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {teachers.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <button onClick={() => setViewing(t)} className="flex items-center gap-3 text-left">
                        <Avatar name={`${t.firstName} ${t.lastName}`} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">
                            {t.firstName} {t.lastName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{t.email}</span>
                        </span>
                      </button>
                    </TD>
                    <TD className="font-mono text-xs">{t.employeeId}</TD>
                    <TD className="max-w-[220px] truncate text-muted-foreground">{t.departmentName}</TD>
                    <TD className="text-muted-foreground">{t.designation}</TD>
                    <TD className="text-center tabular-nums">{t.maxDutiesPerDay}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={TEACHER_STATUS_BADGE[t.status]} dot>
                          {humanize(t.status)}
                        </Badge>
                        {!t.isAvailable && <Badge variant="secondary">Unavailable</Badge>}
                      </div>
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.firstName} ${t.lastName}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setViewing(t)}>
                            <Eye /> View profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEdit(t)}>
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setResetFor(t)}>
                            <KeyRound /> Reset password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => remove(t)}>
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
              noun="teachers"
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <TeacherFormDialog open={formOpen} onOpenChange={setFormOpen} teacher={editing} />
      <TeacherDetailsDialog teacher={viewing} onOpenChange={(o) => !o && setViewing(null)} onEdit={() => viewing && openEdit(viewing)} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} kind="teachers" columns={TEACHER_IMPORT_COLUMNS} onImported={() => fetchTeachers()} />

      <ResetPasswordDialog
        open={!!resetFor}
        onOpenChange={(o) => !o && setResetFor(null)}
        name={resetFor ? `${resetFor.firstName} ${resetFor.lastName}` : ''}
        onReset={(password) => teacherService.resetPassword(resetFor!.id, password)}
      />
    </div>
  )
}
