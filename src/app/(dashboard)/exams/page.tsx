'use client'

import { useEffect, useState } from 'react'
import { Ban, BookOpen, CalendarDays, Eye, GraduationCap, MoreHorizontal, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react'
import { useExamsStore, type Exam } from '@/modules/exams'
import { useRole } from '@/hooks/useRole'
import { EXAM_STATUS_BADGE, EXAM_TYPE_LABEL, formatDayRange } from '@/lib/format'
import { confirmAction } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, PageHeader, Pagination, Skeleton } from '@/components/ui/misc'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExamDetailsDialog, ExamFormDialog } from './components/exam-dialogs'

const PAGE_SIZE = 12

export default function ExamsPage() {
  const {
    exams,
    pagination,
    isLoading,
    filters,
    fetchExams,
    setFilters,
    setPage,
    publishExam,
    cancelExam,
    deleteExam,
  } = useExamsStore()
  // Teachers and students can view the schedule; only admins manage it.
  const { isAdmin: canManage } = useRole()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Exam | null>(null)
  const [viewing, setViewing] = useState<Exam | null>(null)

  useEffect(() => {
    fetchExams({ page: 1, limit: PAGE_SIZE, search: '', status: 'all', examType: undefined })
  }, [fetchExams])

  useEffect(() => {
    const term = search.trim()
    if (term === (filters.search ?? '')) return
    const t = setTimeout(() => setFilters({ search: term }), 350)
    return () => clearTimeout(t)
  }, [search, filters.search, setFilters])

  const openEdit = (exam: Exam) => {
    setViewing(null)
    setEditing(exam)
    setFormOpen(true)
  }

  const publish = async (exam: Exam) => {
    const updated = await publishExam(exam.id)
    if (updated) {
      toast.success('Exam published', 'It is now visible and ready for seat allocation.')
      if (viewing?.id === exam.id) setViewing(updated)
    } else toast.error('Could not publish the exam', useExamsStore.getState().error ?? undefined)
  }

  const cancel = async (exam: Exam) => {
    const ok = await confirmAction({
      title: `Cancel “${exam.name}”?`,
      description: 'Cancelled exams can no longer be seated. Existing seating and duties are kept for reference.',
      confirmLabel: 'Cancel exam',
      cancelLabel: 'Keep exam',
      destructive: true,
    })
    if (!ok) return
    if (await cancelExam(exam.id)) toast.success('Exam cancelled', exam.name)
    else toast.error('Could not cancel the exam', useExamsStore.getState().error ?? undefined)
  }

  const remove = async (exam: Exam) => {
    const ok = await confirmAction({
      title: `Delete “${exam.name}”?`,
      description: 'This permanently removes the exam with its papers, seat allocations, invigilation duties and attendance.',
      confirmLabel: 'Delete exam',
      destructive: true,
    })
    if (!ok) return
    if (await deleteExam(exam.id)) toast.success('Exam deleted', exam.name)
    else toast.error('Could not delete the exam', useExamsStore.getState().error ?? undefined)
  }

  return (
    <div>
      <PageHeader
        title="Exam schedule"
        description={`${pagination.total || exams.length} exams · plan sittings and publish them for seating`}
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Create exam
            </Button>
          )
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <Input icon={<Search />} placeholder="Search exams…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search exams" />
        </div>
        <Select aria-label="Filter by type" className="w-40" value={filters.examType ?? ''} onChange={(e) => setFilters({ examType: e.target.value || undefined })}>
          <option value="">All types</option>
          {Object.entries(EXAM_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" className="w-40" value={filters.status || 'all'} onChange={(e) => setFilters({ status: e.target.value })}>
          <option value="all">All statuses</option>
          {canManage && <option value="draft">Draft</option>}
          <option value="scheduled">Scheduled</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Card>

      {isLoading && exams.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No exams found"
          description={canManage ? 'Create your first exam to start planning seating.' : 'Published exams will appear here.'}
          action={
            canManage && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> Create exam
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${isLoading ? 'opacity-60' : ''}`}>
            {exams.map((exam) => (
              <Card key={exam.id} className="group flex flex-col transition-shadow hover:shadow-elevated">
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={EXAM_STATUS_BADGE[exam.status]} dot>
                      {exam.status}
                    </Badge>
                    <Badge variant="outline" className="normal-case">
                      {EXAM_TYPE_LABEL[exam.examType]}
                    </Badge>
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="-mr-2 -mt-1" aria-label={`Actions for ${exam.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => openEdit(exam)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        {exam.status === 'draft' && (
                          <DropdownMenuItem onSelect={() => publish(exam)}>
                            <Send /> Publish
                          </DropdownMenuItem>
                        )}
                        {(exam.status === 'draft' || exam.status === 'scheduled' || exam.status === 'ongoing') && (
                          <DropdownMenuItem onSelect={() => cancel(exam)}>
                            <Ban /> Cancel exam
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => remove(exam)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="flex-1 space-y-1.5 px-5">
                  <h3 className="font-semibold leading-snug">{exam.name}</h3>
                  {exam.description && <p className="line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t px-5 py-4 text-sm">
                  <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0" />
                    <span className="text-foreground">{formatDayRange(exam.startDate, exam.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="size-4 shrink-0" /> Semester <span className="text-foreground">{exam.semester}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="size-4 shrink-0" />
                    <span className="text-foreground">{exam.subjects?.length ?? 0}</span> papers
                  </div>
                </dl>
                <div className="flex gap-2 border-t p-3">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setViewing(exam)}>
                    <Eye /> Details
                  </Button>
                  {canManage && exam.status === 'draft' && (
                    <Button variant="soft" size="sm" className="flex-1" onClick={() => publish(exam)}>
                      <Send /> Publish
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <Card className="mt-6">
              <Pagination
                className="border-t-0"
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                noun="exams"
                onPageChange={setPage}
              />
            </Card>
          )}
        </>
      )}

      <ExamFormDialog open={formOpen} onOpenChange={setFormOpen} exam={editing} />
      <ExamDetailsDialog
        exam={viewing}
        canManage={canManage}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={() => viewing && openEdit(viewing)}
        onPublish={() => viewing && publish(viewing)}
        onUpdated={(updated) => {
          setViewing(updated)
          fetchExams()
        }}
      />
    </div>
  )
}
