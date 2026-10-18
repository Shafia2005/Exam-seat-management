'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, DoorOpen, Download, Plus, Printer, Search, Send, Sparkles, Trash2, UserCheck, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  teacherDutyService,
  useTeacherDutyStore,
  type AutoAllocateDutiesResult,
  type AutoAllocationStrategy,
  type InvigilationRole,
  type RoomTeacherDuty,
} from '@/modules/teacherDuty'
import { useExamsStore } from '@/modules/exams'
import { useSeatsStore } from '@/modules/seats'
import { useRole } from '@/hooks/useRole'
import { ApiClientError, errorMessage } from '@/lib/api-client'
import { downloadCsv, paperLabel } from '@/lib/format'
import { confirmAction } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { NotifyDialog } from '@/components/notify-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { Alert, Avatar, EmptyState, PageHeader, Progress, Skeleton, StatCard } from '@/components/ui/misc'
import { Switch } from '@/components/ui/switch'

const STRATEGIES: { value: AutoAllocationStrategy; label: string }[] = [
  { value: 'inter_departmental', label: 'Inter-departmental (avoid conflicts)' },
  { value: 'fair_distribution', label: 'Fair distribution (balance load)' },
  { value: 'seniority_based', label: 'Seniority (professors as chief)' },
]

interface RoomView {
  id: string
  name: string
  blockName?: string
  capacity: number
  seated: number
}

export default function TeacherAllocationPage() {
  const { duties, workloads, isLoading, isSubmitting, loadSession, autoAllocate, assignDuty, removeDuty, clearDuties } = useTeacherDutyStore()
  const { exams, fetchExams } = useExamsStore()
  const { rooms, summary, initializeData } = useSeatsStore()
  const { isAdmin } = useRole()

  const [examId, setExamId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [strategy, setStrategy] = useState<AutoAllocationStrategy>('inter_departmental')
  const [perRoom, setPerRoom] = useState(2)
  const [autoScope, setAutoScope] = useState<'paper' | 'all'>('all')
  const [lastRun, setLastRun] = useState<AutoAllocateDutiesResult | null>(null)
  const [search, setSearch] = useState('')
  const [showAllRooms, setShowAllRooms] = useState(false)
  const [assignTo, setAssignTo] = useState<RoomView | null>(null)
  const [assignTeacher, setAssignTeacher] = useState('')
  const [assignRole, setAssignRole] = useState<InvigilationRole>('Invigilator')
  const [notifyOpen, setNotifyOpen] = useState(false)

  useEffect(() => {
    initializeData()
    fetchExams({ page: 1, limit: 100, search: '', status: 'all' })
  }, [initializeData, fetchExams])

  const visibleExams = useMemo(() => exams.filter((e) => e.status !== 'cancelled'), [exams])
  const exam = exams.find((e) => e.id === examId)
  const papers = useMemo(() => exam?.subjects ?? [], [exam])
  const paper = papers.find((p) => p.id === sessionId)
  const locked = exam?.status === 'completed' || exam?.status === 'cancelled'
  const canEdit = isAdmin && !locked

  useEffect(() => {
    if (!visibleExams.length || visibleExams.some((e) => e.id === examId)) return
    setExamId((visibleExams.find((e) => e.status === 'ongoing' || e.status === 'scheduled') ?? visibleExams[0]).id)
  }, [visibleExams, examId])

  // Default to today's or the next upcoming paper.
  useEffect(() => {
    if (!papers.length) return setSessionId('')
    if (papers.some((p) => p.id === sessionId)) return
    const today = new Date().toISOString().slice(0, 10)
    setSessionId((papers.find((p) => p.examDate >= today) ?? papers[0]).id)
  }, [papers, sessionId])

  useEffect(() => {
    setLastRun(null)
    loadSession(sessionId)
  }, [sessionId, loadSession])

  const dutiesByRoom = useMemo(() => {
    const map = new Map<string, RoomTeacherDuty[]>()
    duties.forEach((d) => map.set(d.roomId, [...(map.get(d.roomId) ?? []), d]))
    return map
  }, [duties])

  const seatedByRoom = useMemo(() => {
    const map = new Map<string, number>()
    summary?.rooms.filter((r) => r.sessionId === sessionId).forEach((r) => map.set(r.roomId, r.count))
    return map
  }, [summary, sessionId])

  // Rooms used by this paper: seated rooms plus any room that already has staff.
  const roomViews: RoomView[] = useMemo(() => {
    const inUse = new Set(Array.from(seatedByRoom.keys()).concat(Array.from(dutiesByRoom.keys())))
    const q = search.trim().toLowerCase()
    return rooms
      .filter((r) => showAllRooms || inUse.has(r.id))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.blockName ?? '').toLowerCase().includes(q))
      .map((r) => ({ id: r.id, name: r.name, blockName: r.blockName, capacity: r.capacity, seated: seatedByRoom.get(r.id) ?? 0 }))
  }, [rooms, seatedByRoom, dutiesByRoom, showAllRooms, search])

  const seatedRoomCount = seatedByRoom.size
  const staffedRooms = Array.from(seatedByRoom.keys()).filter((id) => (dutiesByRoom.get(id)?.length ?? 0) >= perRoom).length
  const facultyOnDuty = new Set(duties.map((d) => d.teacherId)).size
  const canTakeDuty = (w: (typeof workloads)[number]) => w.isAvailable && w.status === 'active' && !w.busy

  const handleAutoAllocate = async () => {
    if (!examId) return
    const scopeText = autoScope === 'all' ? `all ${papers.length} papers of this exam` : 'this paper'
    const ok = await confirmAction({
      title: 'Generate the invigilation roster?',
      description: `Existing duties for ${scopeText} are replaced. Daily limits count duties from every exam on the same day.`,
      confirmLabel: 'Generate roster',
    })
    if (!ok) return
    try {
      const res = await autoAllocate({
        examId,
        sessionIds: autoScope === 'paper' && sessionId ? [sessionId] : undefined,
        strategy,
        invigilatorsPerRoom: perRoom,
      })
      setLastRun(res)
      if (res.warnings.length) toast.error(`Assigned ${res.created} duties with ${res.warnings.length} warning(s)`, res.warnings[0])
      else toast.success(`Assigned ${res.created} invigilation duties`, `${res.sessions} paper${res.sessions === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error('Auto-allocation failed', errorMessage(e, 'Please try again.'))
    }
  }

  const handleClear = async () => {
    const ok = await confirmAction({
      title: 'Clear the invigilation roster?',
      description: `Every duty for ${paper ? paperLabel(paper) : 'this paper'} will be removed.`,
      confirmLabel: 'Clear roster',
      destructive: true,
    })
    if (!ok) return
    await clearDuties(examId, sessionId)
    const err = useTeacherDutyStore.getState().error
    if (err) toast.error('Could not clear the roster', err)
    else toast.success('Roster cleared', paper?.subjectName)
  }

  const handleRemove = async (duty: RoomTeacherDuty) => {
    if (await removeDuty(duty.id)) toast.success('Duty removed', `${duty.teacherName} · ${duty.roomNumber}`)
    else toast.error('Could not remove the duty', useTeacherDutyStore.getState().error ?? undefined)
  }

  const openAssign = (room: RoomView) => {
    const roomTeacherIds = new Set((dutiesByRoom.get(room.id) ?? []).map((d) => d.teacherId))
    const candidate = [...workloads]
      .filter((w) => canTakeDuty(w) && w.currentDutiesCount < w.maxDutiesPerDay)
      .sort((a, b) => a.currentDutiesCount - b.currentDutiesCount)
      .find((w) => !roomTeacherIds.has(w.teacherId))
    setAssignTeacher(candidate?.teacherId ?? workloads.find(canTakeDuty)?.teacherId ?? '')
    setAssignRole((dutiesByRoom.get(room.id) ?? []).some((d) => d.role === 'Chief Invigilator') ? 'Invigilator' : 'Chief Invigilator')
    setAssignTo(room)
  }

  const saveAssignment = async (override = false) => {
    if (!assignTo || !assignTeacher || !sessionId) return
    try {
      const duty = await assignDuty({ sessionId, roomId: assignTo.id, teacherId: assignTeacher, role: assignRole, override })
      toast.success('Invigilator assigned', `${duty.teacherName} → ${assignTo.name}${override ? ' (over daily limit)' : ''}`)
      setAssignTo(null)
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DUTY_LIMIT') {
        const ok = await confirmAction({ title: 'Over the daily duty limit', description: `${err.message} Assign anyway?`, confirmLabel: 'Assign anyway' })
        if (ok) await saveAssignment(true)
        return
      }
      toast.error('Could not assign the invigilator', errorMessage(err, 'Please try again.'))
    }
  }

  const exportRoster = () =>
    downloadCsv(
      `invigilation-${(exam?.name ?? 'roster').replace(/\W+/g, '-').toLowerCase()}-${(paper?.subjectName ?? 'paper').replace(/\W+/g, '-').toLowerCase()}.csv`,
      ['Exam', 'Paper', 'Date', 'Time', 'Room', 'Block', 'Role', 'Teacher', 'Employee ID', 'Department', 'Designation', 'Status'],
      duties.map((d) => [d.examName, d.subjectName, d.sessionDate, d.sessionSlot, d.roomNumber, d.blockName, d.role, d.teacherName, d.employeeId, d.teacherDepartment, d.designation, d.status])
    )

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Invigilation"
        description={isAdmin ? 'Staff every exam hall for each paper with balanced, conflict-free duties.' : 'Invigilation roster for each exam hall.'}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" onClick={() => setNotifyOpen(true)} disabled={!exam || exam.status === 'draft' || locked}>
                <Send /> Notify invigilators
              </Button>
            )}
            <Button variant="outline" onClick={exportRoster} disabled={!duties.length}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </>
        }
      />

      <Card className="print:hidden">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Exam" htmlFor="duty-exam" className="min-w-[220px] flex-[2]">
              <Select id="duty-exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
                {visibleExams.length === 0 && <option value="">No exams</option>}
                {visibleExams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.status === 'draft' ? ' (draft)' : e.status === 'completed' ? ' (completed)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Paper" htmlFor="duty-paper" className="min-w-[260px] flex-[3]">
              <Select id="duty-paper" value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={!papers.length}>
                {papers.length === 0 && <option value="">No papers</option>}
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {paperLabel(p)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-end gap-4 border-t pt-4">
              <Field label="Strategy" htmlFor="duty-strategy" className="min-w-[220px] flex-[2]">
                <Select id="duty-strategy" value={strategy} onChange={(e) => setStrategy(e.target.value as AutoAllocationStrategy)}>
                  {STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Staff per room" htmlFor="duty-per-room" className="w-36">
                <Select id="duty-per-room" value={perRoom} onChange={(e) => setPerRoom(Number(e.target.value))}>
                  <option value={1}>1 invigilator</option>
                  <option value={2}>2 invigilators</option>
                  <option value={3}>3 invigilators</option>
                </Select>
              </Field>
              <Field label="Generate for" htmlFor="duty-scope" className="w-44">
                <Select id="duty-scope" value={autoScope} onChange={(e) => setAutoScope(e.target.value as 'paper' | 'all')}>
                  <option value="all">All papers</option>
                  <option value="paper">This paper only</option>
                </Select>
              </Field>
              <div className="flex gap-2">
                <Button onClick={handleAutoAllocate} loading={isSubmitting} disabled={!examId || !papers.length}>
                  <Sparkles /> Auto-allocate
                </Button>
                <Button variant="outline" onClick={handleClear} disabled={isSubmitting || !duties.length}>
                  <Trash2 /> Clear paper
                </Button>
              </div>
            </div>
          )}
          {isAdmin && locked && <Alert tone="info">This exam is {exam?.status}; its roster is kept for the record and can no longer change.</Alert>}
        </CardContent>
      </Card>

      {lastRun && lastRun.warnings.length > 0 && (
        <Alert tone="warning" title={`${lastRun.warnings.length} hall${lastRun.warnings.length === 1 ? '' : 's'} could not be fully staffed`}>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {lastRun.warnings.slice(0, 6).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {lastRun.warnings.length > 6 && <li>…and {lastRun.warnings.length - 6} more</li>}
          </ul>
          <p className="mt-1">Nobody was assigned beyond their daily limit. Raise a limit on the Teachers page or assign someone manually.</p>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Halls in use" value={seatedRoomCount} icon={<DoorOpen />} tone="indigo" hint={`${Array.from(seatedByRoom.values()).reduce((s, n) => s + n, 0)} students seated`} />
        <StatCard
          label="Fully staffed"
          value={`${staffedRooms} / ${seatedRoomCount}`}
          icon={<UserCheck />}
          tone={seatedRoomCount && staffedRooms === seatedRoomCount ? 'emerald' : 'amber'}
          hint={`${perRoom} invigilator${perRoom > 1 ? 's' : ''} per hall`}
        />
        <StatCard label="Faculty on duty" value={facultyOnDuty} icon={<Users />} tone="sky" hint={`of ${workloads.length} faculty members`} />
        <StatCard label="Duty slots" value={duties.length} icon={<Sparkles />} tone="violet" hint="For this paper" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardToolbar
            title="Hall roster"
            description={paper ? paperLabel(paper) : undefined}
            actions={
              <div className="flex flex-wrap items-center gap-3 print:hidden">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch checked={showAllRooms} onCheckedChange={setShowAllRooms} aria-label="Show all rooms" /> All rooms
                </label>
                <div className="w-48">
                  <Input icon={<Search />} placeholder="Find a hall…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search halls" />
                </div>
              </div>
            }
          />
          <CardContent className="space-y-3">
            {isLoading && duties.length === 0 && roomViews.length === 0 ? (
              <Skeleton className="h-40 w-full" />
            ) : roomViews.length === 0 ? (
              <EmptyState
                icon={<DoorOpen />}
                title={search ? 'No halls match your search' : 'No halls in use for this paper'}
                description={search ? undefined : 'Seat students for this paper first, or turn on “All rooms” to staff halls manually.'}
                action={
                  isAdmin &&
                  !search && (
                    <Button variant="outline" asChild>
                      <Link href="/seat-allocation">Go to seat allocation</Link>
                    </Button>
                  )
                }
              />
            ) : (
              roomViews.map((room) => {
                const roomDuties = dutiesByRoom.get(room.id) ?? []
                const staffed = roomDuties.length >= perRoom
                return (
                  <div key={room.id} className="rounded-xl border p-4 transition-colors hover:border-primary/30">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <DoorOpen className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{room.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {room.blockName} · {room.seated ? `${room.seated} of ${room.capacity} seated` : `${room.capacity} seats`}
                        </p>
                      </div>
                      <Badge variant={staffed ? 'success' : roomDuties.length ? 'warning' : 'secondary'}>
                        {roomDuties.length}/{perRoom} staffed
                      </Badge>
                      {room.seated > 0 && (
                        <Button variant="ghost" size="sm" asChild className="print:hidden">
                          <Link href={`/attendance?sessionId=${sessionId}&roomId=${room.id}`}>
                            <ClipboardCheck /> Attendance
                          </Link>
                        </Button>
                      )}
                      {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => openAssign(room)} className="print:hidden">
                          <Plus /> Assign
                        </Button>
                      )}
                    </div>
                    {roomDuties.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {roomDuties.map((d) => (
                          <div key={d.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                            <Avatar name={d.teacherName} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{d.teacherName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {d.employeeId} · {d.teacherDepartment}
                              </p>
                            </div>
                            <Badge variant={d.role === 'Chief Invigilator' ? 'violet' : d.role === 'Reliever' ? 'secondary' : 'info'} className="normal-case">
                              {d.role === 'Chief Invigilator' ? 'Chief' : d.role}
                            </Badge>
                            {canEdit && (
                              <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(d)} aria-label={`Remove ${d.teacherName}`} className="text-muted-foreground hover:text-destructive print:hidden">
                                <X />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-20 print:hidden">
          <CardToolbar title="Faculty workload" description={paper ? `Duties on ${paper.examDate} across all exams` : 'Duties vs. daily limit'} />
          <CardContent className="max-h-[calc(100vh-14rem)] space-y-3 overflow-y-auto scrollbar-thin">
            {workloads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No faculty yet.</p>
            ) : (
              [...workloads]
                .sort((a, b) => b.currentDutiesCount - a.currentDutiesCount || a.teacherName.localeCompare(b.teacherName))
                .map((w) => {
                  const ratio = w.maxDutiesPerDay ? w.currentDutiesCount / w.maxDutiesPerDay : 0
                  return (
                    <div key={w.teacherId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className={cn('min-w-0 truncate font-medium', !w.isAvailable && 'text-muted-foreground line-through')}>{w.teacherName}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {w.busy && (
                            <Badge variant="warning" className="normal-case">
                              Busy this slot
                            </Badge>
                          )}
                          <span className={cn('text-xs tabular-nums', ratio >= 1 ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                            {w.currentDutiesCount}/{w.maxDutiesPerDay}
                          </span>
                        </span>
                      </div>
                      <Progress value={Math.min(ratio, 1) * 100} tone={ratio >= 1 ? 'danger' : ratio > 0.5 ? 'warning' : 'success'} />
                    </div>
                  )
                })
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!assignTo} onOpenChange={(o) => !o && setAssignTo(null)}>
        <DialogContent size="sm">
          <DialogHeader icon={<UserCheck />} title={`Assign to ${assignTo?.name ?? ''}`} description={paper ? paperLabel(paper) : undefined} />
          <DialogBody className="space-y-4">
            <Field label="Faculty member" htmlFor="assign-teacher" hint="Counts are duties that day across every exam, against the daily limit.">
              <Select id="assign-teacher" value={assignTeacher} onChange={(e) => setAssignTeacher(e.target.value)}>
                {workloads.map((w) => {
                  const reason = !w.isAvailable || w.status !== 'active' ? ' — unavailable' : w.busy ? ' — busy at this time' : w.currentDutiesCount >= w.maxDutiesPerDay ? ' — at daily limit' : ''
                  return (
                    <option key={w.teacherId} value={w.teacherId} disabled={!canTakeDuty(w)}>
                      {w.teacherName} · {w.departmentName} ({w.currentDutiesCount}/{w.maxDutiesPerDay}){reason}
                    </option>
                  )
                })}
              </Select>
            </Field>
            <Field label="Role" htmlFor="assign-role">
              <Select id="assign-role" value={assignRole} onChange={(e) => setAssignRole(e.target.value as InvigilationRole)}>
                <option value="Chief Invigilator">Chief Invigilator</option>
                <option value="Invigilator">Invigilator</option>
                <option value="Reliever">Reliever</option>
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTo(null)}>
              Cancel
            </Button>
            <Button onClick={() => saveAssignment()} loading={isSubmitting} disabled={!assignTeacher}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {exam && (
        <NotifyDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          title="Notify invigilators"
          description={`Send every assigned invigilator their halls and times for ${exam.name}.`}
          audience="invigilators"
          onSend={(channels) => teacherDutyService.notifyInvigilators(exam.id, channels)}
        />
      )}
    </div>
  )
}
