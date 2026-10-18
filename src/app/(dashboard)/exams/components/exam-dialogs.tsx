'use client'

import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, CalendarPlus, Clock, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { examService, useExamsStore, type Exam, type ExamStatus, type ExamType } from '@/modules/exams'
import { errorMessage } from '@/lib/api-client'
import { confirmAction } from '@/lib/confirm'
import { EXAM_STATUS_BADGE, EXAM_TYPE_LABEL, formatDay } from '@/lib/format'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Alert, EmptyState } from '@/components/ui/misc'
import { Detail, DetailGrid } from '@/components/detail'

function currentAcademicYear(): string {
  const now = new Date()
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

interface FormState {
  name: string
  examType: ExamType
  academicYear: string
  semester: number
  startDate: string
  endDate: string
  description: string
  instructions: string
  /** What an admin chooses; once published, dates decide scheduled → ongoing → completed. */
  status: 'draft' | 'scheduled' | 'cancelled'
}

const toFormStatus = (s?: ExamStatus): FormState['status'] => (s === 'draft' || s === 'cancelled' ? s : s ? 'scheduled' : 'draft')

const toForm = (exam?: Exam | null): FormState => ({
  name: exam?.name ?? '',
  examType: exam?.examType ?? 'mid_sem',
  academicYear: exam?.academicYear ?? currentAcademicYear(),
  semester: exam?.semester ?? 1,
  startDate: exam?.startDate ?? '',
  endDate: exam?.endDate ?? '',
  description: exam?.description ?? '',
  instructions: exam?.instructions ?? '',
  status: toFormStatus(exam?.status),
})

/** Create (no `exam`) or edit an exam. New exams start as drafts. */
export function ExamFormDialog({ open, onOpenChange, exam }: { open: boolean; onOpenChange: (open: boolean) => void; exam?: Exam | null }) {
  const editing = !!exam
  const { createExam, updateExam, isSubmitting } = useExamsStore()
  const [form, setForm] = useState<FormState>(() => toForm(exam))
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(toForm(exam))
      setError('')
    }
  }, [open, exam])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.endDate < form.startDate) return setError('The end date cannot be before the start date.')
    const data = {
      name: form.name,
      examType: form.examType,
      academicYear: form.academicYear,
      semester: Number(form.semester),
      startDate: form.startDate,
      endDate: form.endDate,
      description: form.description,
      instructions: form.instructions,
    }
    const saved = editing ? await updateExam(exam.id, { ...data, status: form.status }) : await createExam(data)
    if (!saved) {
      setError(useExamsStore.getState().error || 'Could not save the exam.')
      return
    }
    toast.success(editing ? 'Exam updated' : 'Exam created', editing ? saved.name : 'Saved as a draft — publish it when ready for seating.')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader
            icon={editing ? <Pencil /> : <CalendarPlus />}
            title={editing ? 'Edit exam' : 'Create exam'}
            description={editing ? exam.name : 'New exams start as drafts and are hidden from teachers and students.'}
          />
          <DialogBody className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Exam name" htmlFor="e-name" required>
              <Input id="e-name" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="End-Semester Examination 2026" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type" htmlFor="e-type" required>
                <Select id="e-type" value={form.examType} onChange={(e) => set('examType', e.target.value as ExamType)}>
                  {Object.entries(EXAM_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Academic year" htmlFor="e-year" required>
                <Input id="e-year" required value={form.academicYear} onChange={(e) => set('academicYear', e.target.value)} placeholder="2026-27" />
              </Field>
              <Field label="Semester" htmlFor="e-sem" required>
                <Input id="e-sem" type="number" min={1} max={12} required value={form.semester} onChange={(e) => set('semester', Number(e.target.value))} />
              </Field>
              <Field label="Start date" htmlFor="e-start" required>
                <Input id="e-start" type="date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </Field>
              <Field label="End date" htmlFor="e-end" required>
                <Input id="e-end" type="date" required min={form.startDate || undefined} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </Field>
              {editing && (
                <Field label="Status" htmlFor="e-status" hint={form.status === 'scheduled' ? 'Becomes ongoing, then completed, by date.' : undefined}>
                  <Select id="e-status" value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])}>
                    <option value="draft">Draft (hidden)</option>
                    <option value="scheduled">Published{exam.status !== 'draft' && exam.status !== 'cancelled' ? ` (${exam.status})` : ''}</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </Field>
              )}
            </div>
            <Field label="Description" htmlFor="e-desc">
              <Textarea id="e-desc" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Instructions for candidates" htmlFor="e-inst" hint="Shown to students with their hall ticket.">
              <Textarea id="e-inst" value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save changes' : 'Create exam'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const emptySubject = { subjectName: '', subjectId: '', examDate: '', startTime: '09:30', endTime: '12:30' }
const NEW_PAPER = 'new'

const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

export function ExamDetailsDialog({
  exam,
  canManage,
  onOpenChange,
  onEdit,
  onPublish,
  onUpdated,
}: {
  exam: Exam | null
  canManage: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onPublish: () => void
  onUpdated: (exam: Exam) => void
}) {
  // The paper being added (NEW_PAPER) or edited (its id); null while the form is closed.
  const [editingPaper, setEditingPaper] = useState<string | null>(null)
  const [subject, setSubject] = useState(emptySubject)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const adding = editingPaper !== null
  const locked = exam?.status === 'completed' || exam?.status === 'cancelled'

  useEffect(() => {
    setEditingPaper(null)
    setSubject(emptySubject)
    setError('')
  }, [exam?.id])

  const openPaper = (paper?: Exam['subjects'][number]) => {
    setError('')
    setSubject(
      paper
        ? { subjectName: paper.subjectName ?? '', subjectId: paper.subjectId ?? '', examDate: paper.examDate, startTime: paper.startTime, endTime: paper.endTime }
        : { ...emptySubject, startTime: subject.startTime, endTime: subject.endTime }
    )
    setEditingPaper(paper ? paper.id : NEW_PAPER)
  }

  const savePaper = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exam || !editingPaper) return
    setError('')
    const duration = minutesBetween(subject.startTime, subject.endTime)
    if (duration <= 0) return setError('The end time must be after the start time.')
    setSaving(true)
    try {
      const updated =
        editingPaper === NEW_PAPER
          ? await examService.addSubject(exam.id, {
              subjectName: subject.subjectName,
              subjectId: subject.subjectId || undefined,
              examDate: subject.examDate,
              startTime: subject.startTime,
              endTime: subject.endTime,
              durationMinutes: duration,
            })
          : await examService.updateSubject(exam.id, editingPaper, {
              subjectName: subject.subjectName,
              subjectCode: subject.subjectId || null,
              examDate: subject.examDate,
              startTime: subject.startTime,
              endTime: subject.endTime,
            })
      onUpdated(updated)
      toast.success(editingPaper === NEW_PAPER ? 'Paper added' : 'Paper updated', subject.subjectName)
      setEditingPaper(null)
    } catch (err) {
      setError(errorMessage(err, 'Could not save the paper.'))
    } finally {
      setSaving(false)
    }
  }

  const deletePaper = async (paper: Exam['subjects'][number]) => {
    if (!exam) return
    const ok = await confirmAction({
      title: `Remove “${paper.subjectName || paper.subjectId}”?`,
      description: 'Its seating plan, invigilation duties and any recorded attendance for this paper are deleted too.',
      confirmLabel: 'Remove paper',
      destructive: true,
    })
    if (!ok) return
    try {
      onUpdated(await examService.deleteSubject(exam.id, paper.id))
      toast.success('Paper removed', paper.subjectName)
    } catch (err) {
      toast.error('Could not remove the paper', errorMessage(err, ''))
    }
  }

  return (
    <Dialog open={!!exam} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {exam && (
          <>
            <DialogHeader icon={<CalendarDays />} title={exam.name} description={`${EXAM_TYPE_LABEL[exam.examType]} · ${exam.academicYear}`} />
            <DialogBody className="space-y-6">
              {exam.status === 'draft' && canManage && (
                <Alert
                  tone="warning"
                  title="This exam is a draft"
                  action={
                    <Button size="sm" onClick={onPublish}>
                      <Send /> Publish
                    </Button>
                  }
                >
                  Publish it to make it visible and ready for seat allocation.
                </Alert>
              )}
              <DetailGrid>
                <Detail label="Status">
                  <Badge variant={EXAM_STATUS_BADGE[exam.status]} dot>
                    {exam.status}
                  </Badge>
                </Detail>
                <Detail label="Dates">
                  {formatDay(exam.startDate)} – {formatDay(exam.endDate)}
                </Detail>
                <Detail label="Semester">{String(exam.semester)}</Detail>
                {exam.description && (
                  <Detail label="Description" className="col-span-2 sm:col-span-3">
                    {exam.description}
                  </Detail>
                )}
                {exam.instructions && (
                  <Detail label="Instructions" className="col-span-2 sm:col-span-3">
                    {exam.instructions}
                  </Detail>
                )}
              </DetailGrid>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Papers ({exam.subjects?.length ?? 0})</h4>
                  {canManage && !adding && !locked && (
                    <Button size="sm" variant="outline" onClick={() => openPaper()}>
                      <Plus /> Add paper
                    </Button>
                  )}
                </div>

                {adding && (
                  <form onSubmit={savePaper} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">{editingPaper === NEW_PAPER ? 'New paper' : 'Edit paper'}</p>
                    {error && <Alert tone="danger">{error}</Alert>}
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                      <Field label="Subject name" htmlFor="sub-name" required>
                        <Input id="sub-name" required value={subject.subjectName} onChange={(e) => setSubject({ ...subject, subjectName: e.target.value })} placeholder="Data Structures" />
                      </Field>
                      <Field label="Code" htmlFor="sub-code">
                        <Input id="sub-code" value={subject.subjectId} onChange={(e) => setSubject({ ...subject, subjectId: e.target.value.toUpperCase() })} placeholder="CS301" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Date" htmlFor="sub-date" required>
                        <Input id="sub-date" type="date" required min={exam.startDate} max={exam.endDate} value={subject.examDate} onChange={(e) => setSubject({ ...subject, examDate: e.target.value })} />
                      </Field>
                      <Field label="Starts" htmlFor="sub-start" required>
                        <Input id="sub-start" type="time" required value={subject.startTime} onChange={(e) => setSubject({ ...subject, startTime: e.target.value })} />
                      </Field>
                      <Field label="Ends" htmlFor="sub-end" required>
                        <Input id="sub-end" type="time" required value={subject.endTime} onChange={(e) => setSubject({ ...subject, endTime: e.target.value })} />
                      </Field>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPaper(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" loading={saving}>
                        {editingPaper === NEW_PAPER ? 'Add paper' : 'Save paper'}
                      </Button>
                    </div>
                  </form>
                )}

                {exam.subjects?.length ? (
                  <ul className="divide-y rounded-lg border">
                    {exam.subjects.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                        <BookOpen className="size-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1 font-medium">{s.subjectName || s.subjectId}</span>
                        <span className="text-muted-foreground">{formatDay(s.examDate)}</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3.5" /> {s.startTime}–{s.endTime}
                        </span>
                        <Badge variant="secondary">{s.maximumMarks} marks</Badge>
                        {canManage && !locked && (
                          <span className="flex gap-1">
                            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.subjectName}`} onClick={() => openPaper(s)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${s.subjectName}`}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deletePaper(s)}
                            >
                              <Trash2 />
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  !adding && <EmptyState icon={<BookOpen />} title="No papers yet" description="Add the papers sat during this exam. Each paper gets its own seating and invigilators." className="py-8" />
                )}
              </section>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {canManage && (
                <Button onClick={onEdit}>
                  <Pencil /> Edit exam
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
