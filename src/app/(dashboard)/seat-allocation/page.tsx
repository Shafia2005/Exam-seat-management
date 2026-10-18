'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardCheck,
  Download,
  Filter,
  Layers,
  LayoutGrid,
  ListOrdered,
  Search,
  Send,
  ShieldCheck,
  Shuffle,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSeatsStore, seatService } from '@/modules/seats'
import { studentService } from '@/modules/students'
import { useExamsStore } from '@/modules/exams'
import { useCatalogStore } from '@/modules/catalog'
import { teacherDutyService } from '@/modules/teacherDuty'
import { downloadCsv, formatDayRange, paperLabel } from '@/lib/format'
import { confirmAction } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import type { AllocationAlgorithm, AllocationResult } from '@/types/seat.types'
import type { Student } from '@/types/student.types'
import type { RoomTeacherDuty } from '@/types/teacherDuty.types'
import SeatMap from '@/components/seats/SeatMap'
import { NotifyDialog } from '@/components/notify-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Alert, EmptyState, PageHeader, Skeleton, StatCard } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'

const ALGORITHMS: { value: AllocationAlgorithm; label: string; hint: string; Icon: typeof ShieldCheck }[] = [
  { value: 'anti_cheating', label: 'Anti-cheating', hint: 'Avoids same-department neighbours', Icon: ShieldCheck },
  { value: 'department_wise', label: 'Department interleave', hint: 'Rotates departments seat by seat', Icon: Layers },
  { value: 'sequential', label: 'Sequential', hint: 'Roll-number order, room by room', Icon: ListOrdered },
  { value: 'random', label: 'Random', hint: 'Shuffles students and seats', Icon: Shuffle },
]

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const ALL_PAPERS = 'all'

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
    >
      {active && <Check className="size-3.5" />}
      {children}
    </button>
  )
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

export default function SeatAllocationPage() {
  const { allocateSeats, clearAllocation, fetchAllocations, isSubmitting, isLoading, error, initializeData, rooms, benches, allocations } = useSeatsStore()
  const { exams, fetchExams } = useExamsStore()
  const { departments, fetchCatalog, isLoaded: catalogLoaded } = useCatalogStore()

  const [selectedExam, setSelectedExam] = useState('')
  const [scope, setScope] = useState(ALL_PAPERS)
  const [viewSession, setViewSession] = useState('')
  const [selectedRooms, setSelectedRooms] = useState<string[]>([])
  const [algorithm, setAlgorithm] = useState<AllocationAlgorithm>('anti_cheating')
  const [result, setResult] = useState<AllocationResult | null>(null)
  const [mapRoomId, setMapRoomId] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [duties, setDuties] = useState<RoomTeacherDuty[]>([])

  // Candidates: everyone matching the filters (server-side), or a hand-picked list.
  const [mode, setMode] = useState<'filters' | 'pick'>('filters')
  const [deptFilter, setDeptFilter] = useState<string[]>([])
  const [semFilter, setSemFilter] = useState<number[]>([])
  const [matching, setMatching] = useState<number | null>(null)
  const [pickSearch, setPickSearch] = useState('')
  const [pickList, setPickList] = useState<Student[]>([])
  const [pickTotal, setPickTotal] = useState(0)
  const [pickLoading, setPickLoading] = useState(false)
  const [picked, setPicked] = useState<string[]>([])

  useEffect(() => {
    initializeData()
    fetchExams({ page: 1, limit: 100, search: '', status: 'all' })
    if (!catalogLoaded) fetchCatalog()
  }, [initializeData, fetchExams, fetchCatalog, catalogLoaded])

  const seatableExams = useMemo(() => exams.filter((e) => e.status === 'scheduled' || e.status === 'ongoing'), [exams])
  const pastExams = useMemo(() => exams.filter((e) => e.status === 'completed'), [exams])
  const exam = exams.find((e) => e.id === selectedExam)
  const editable = exam?.status === 'scheduled' || exam?.status === 'ongoing'
  const papers = useMemo(() => exam?.subjects ?? [], [exam])

  useEffect(() => {
    if (!selectedExam && (seatableExams.length || pastExams.length)) setSelectedExam((seatableExams[0] ?? pastExams[0]).id)
  }, [seatableExams, pastExams, selectedExam])
  useEffect(() => {
    if (rooms.length && selectedRooms.length === 0) setSelectedRooms(rooms.slice(0, 2).map((r) => r.id))
  }, [rooms, selectedRooms.length])
  useEffect(() => {
    setResult(null)
    setScope(ALL_PAPERS)
    if (selectedExam) fetchAllocations(selectedExam)
  }, [selectedExam, fetchAllocations])

  // Show the paper being seated, else the first paper that has seating.
  useEffect(() => {
    if (scope !== ALL_PAPERS) return setViewSession(scope)
    const seated = allocations.find((a) => a.allocations.length)
    setViewSession((current) => (allocations.some((a) => a.sessionId === current) ? current : seated?.sessionId ?? papers[0]?.id ?? ''))
  }, [scope, allocations, papers])

  useEffect(() => {
    if (!viewSession) return setDuties([])
    teacherDutyService
      .getDutyRoster(viewSession)
      .then((r) => setDuties(r.duties))
      .catch(() => setDuties([]))
  }, [viewSession])

  // Matching-candidate count (server-side, so it is never capped by page size).
  const filterQuery = useMemo(
    () => ({
      status: 'active',
      eligibility: 'eligible',
      departmentIds: deptFilter.length ? deptFilter.join(',') : undefined,
      semesters: semFilter.length ? semFilter.join(',') : undefined,
    }),
    [deptFilter, semFilter]
  )
  useEffect(() => {
    let cancelled = false
    studentService
      .getAll({ ...filterQuery, page: 1, limit: 1 })
      .then((res) => !cancelled && setMatching(res.meta.pagination.total))
      .catch(() => !cancelled && setMatching(null))
    return () => {
      cancelled = true
    }
  }, [filterQuery])

  useEffect(() => {
    if (mode !== 'pick') return
    let cancelled = false
    setPickLoading(true)
    const timer = setTimeout(() => {
      studentService
        .getAll({ ...filterQuery, search: pickSearch.trim() || undefined, page: 1, limit: 200, sortBy: 'rollNumber' })
        .then((res) => {
          if (cancelled) return
          setPickList(res.data)
          setPickTotal(res.meta.pagination.total)
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setPickLoading(false))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mode, filterQuery, pickSearch])

  const view = allocations.find((a) => a.sessionId === viewSession)
  const displayAllocations = useMemo(() => view?.allocations ?? [], [view])
  const seatedPerPaper = useMemo(() => new Map(allocations.map((a) => [a.sessionId, a.allocations.length])), [allocations])
  const markedPerPaper = useMemo(
    () => new Map(allocations.map((a) => [a.sessionId, a.allocations.filter((x) => x.attendanceStatus).length])),
    [allocations]
  )
  const anySeated = allocations.some((a) => a.allocations.length)

  const candidateCount = mode === 'filters' ? matching ?? 0 : picked.length
  const capacity = rooms.filter((r) => selectedRooms.includes(r.id)).reduce((sum, r) => sum + r.capacity, 0)
  const overCapacity = candidateCount > capacity

  const mapRooms = useMemo(() => {
    const used = new Set(displayAllocations.map((a) => a.roomId))
    return rooms.filter((r) => used.has(r.id) || (!displayAllocations.length && selectedRooms.includes(r.id)))
  }, [rooms, displayAllocations, selectedRooms])
  useEffect(() => {
    if (mapRooms.length && !mapRooms.some((r) => r.id === mapRoomId)) setMapRoomId(mapRooms[0].id)
  }, [mapRooms, mapRoomId])

  const roomDuties = useMemo(() => {
    const map = new Map<string, string[]>()
    duties.forEach((d) => map.set(d.roomId, [...(map.get(d.roomId) ?? []), `${d.teacherName} (${d.role})`]))
    return map
  }, [duties])

  const tableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    return [...displayAllocations]
      .filter((a) => !q || [a.studentRollNumber, a.studentName, a.departmentName, a.roomNumber].some((v) => (v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (a.studentRollNumber ?? '').localeCompare(b.studentRollNumber ?? '', undefined, { numeric: true }))
  }, [displayAllocations, tableSearch])

  const scopePapers = scope === ALL_PAPERS ? papers : papers.filter((p) => p.id === scope)
  const scopeLabel = scope === ALL_PAPERS ? `all ${papers.length} papers` : paperLabel(scopePapers[0] ?? { examDate: '', startTime: '', endTime: '' })
  const replacing = scopePapers.reduce((n, p) => n + (seatedPerPaper.get(p.id) ?? 0), 0)

  const handleAllocate = async () => {
    if (!selectedExam || candidateCount === 0) return
    if (replacing) {
      const ok = await confirmAction({
        title: 'Replace the current seating?',
        description: `Seating already exists for ${scopeLabel}. Allocating again replaces it${scope === ALL_PAPERS ? ' for every paper' : ''}.`,
        confirmLabel: 'Replace seating',
      })
      if (!ok) return
    }
    const res = await allocateSeats({
      examId: selectedExam,
      sessionIds: scope === ALL_PAPERS ? undefined : [scope],
      ...(mode === 'filters'
        ? { selection: { departmentIds: deptFilter.length ? deptFilter : undefined, semesters: semFilter.length ? semFilter : undefined } }
        : { studentIds: picked }),
      algorithm,
      roomIds: selectedRooms.length ? selectedRooms : undefined,
    })
    if (!res) return toast.error('Allocation failed', useSeatsStore.getState().error ?? undefined)
    setResult(res)
    if (res.allocatedStudents > 0) {
      const papersSeated = res.sessionIds?.length ?? 1
      toast.success(
        `Seated ${res.allocatedStudents} students`,
        `${papersSeated} paper${papersSeated === 1 ? '' : 's'} · ${res.adjacentSameDeptPairs ?? 0} same-department neighbours`
      )
      if (res.sessionIds?.[0]) setViewSession(res.sessionIds[0])
      if (res.allocations[0]) setMapRoomId(res.allocations[0].roomId)
    } else {
      toast.error('No seats were allocated', res.errors[0]?.error)
    }
  }

  const handleClear = async () => {
    const ok = await confirmAction({
      title: scope === ALL_PAPERS ? 'Clear seating for every paper?' : 'Clear seating for this paper?',
      description: `Seat assignments for ${scopeLabel} will be removed. Students will no longer see those seats on their hall ticket.`,
      confirmLabel: 'Clear seating',
      destructive: true,
    })
    if (!ok) return
    await clearAllocation(selectedExam, scope === ALL_PAPERS ? undefined : scope)
    const err = useSeatsStore.getState().error
    if (err) return toast.error('Could not clear seating', err)
    setResult(null)
    toast.success('Seating cleared', exam?.name)
  }

  const exportCsv = () => {
    downloadCsv(
      `seating-${(exam?.name ?? 'export').replace(/\W+/g, '-').toLowerCase()}-${(view?.subjectName ?? 'paper').replace(/\W+/g, '-').toLowerCase()}.csv`,
      ['Paper', 'Date', 'Time', 'Roll number', 'Name', 'Department', 'Room', 'Bench', 'Seat', 'Attendance', 'Invigilators'],
      tableRows.map((a) => [
        view?.subjectName,
        view?.examDate,
        view ? `${view.startTime}-${view.endTime}` : '',
        a.studentRollNumber,
        a.studentName,
        a.departmentName,
        a.roomNumber,
        a.benchNumber,
        a.seatLabel,
        a.attendanceStatus ?? '',
        (roomDuties.get(a.roomId) ?? []).join('; '),
      ])
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Seat allocation"
        description="Seat candidates for each paper with anti-cheating rules, then review the live seat map."
        actions={
          <>
            <Button variant="outline" onClick={() => setNotifyOpen(true)} disabled={!anySeated || !exam || exam.status === 'cancelled'}>
              <Send /> Notify students
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={displayAllocations.length === 0}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={!editable || !replacing || isSubmitting}>
              <Trash2 /> Clear seating
            </Button>
          </>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardContent className="grid gap-8 p-5 lg:grid-cols-3">
          <Step n={1} title="Choose an exam and paper">
            <Select aria-label="Exam" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
              {seatableExams.length === 0 && pastExams.length === 0 && <option value="">No published exams</option>}
              {seatableExams.length > 0 && (
                <optgroup label="Open for seating">
                  {seatableExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {pastExams.length > 0 && (
                <optgroup label="Completed (view only)">
                  {pastExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
            {exam && (
              <Select aria-label="Paper" value={scope} onChange={(e) => setScope(e.target.value)} disabled={!papers.length}>
                {papers.length > 1 && <option value={ALL_PAPERS}>All {papers.length} papers (same seat throughout)</option>}
                {papers.length === 1 && <option value={ALL_PAPERS}>{paperLabel(papers[0])}</option>}
                {papers.length > 1 &&
                  papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {paperLabel(p)}
                    </option>
                  ))}
              </Select>
            )}
            {exam ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{formatDayRange(exam.startDate, exam.endDate)}</p>
                {papers.length === 0 ? (
                  <p className="text-warning">
                    This exam has no papers yet.{' '}
                    <Link href="/exams" className="font-medium text-primary hover:underline">
                      Add papers
                    </Link>
                  </p>
                ) : (
                  <p>
                    {allocations.filter((a) => a.allocations.length).length} of {papers.length} papers seated
                  </p>
                )}
                {!editable && <p className="text-warning">This exam is {exam.status}; seating can be viewed but not changed.</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only published exams can be seated.{' '}
                <Link href="/exams" className="font-medium text-primary hover:underline">
                  Publish an exam
                </Link>
              </p>
            )}
          </Step>

          <Step n={2} title="Pick an algorithm">
            <div className="grid grid-cols-2 gap-2">
              {ALGORITHMS.map(({ value, label, hint, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAlgorithm(value)}
                  aria-pressed={algorithm === value}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                    algorithm === value ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'hover:bg-muted'
                  )}
                >
                  <Icon className="size-4 text-primary" />
                  <span className="text-sm font-medium leading-tight">{label}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          </Step>

          <Step n={3} title="Select rooms">
            <div className="flex flex-wrap gap-2">
              {rooms.length === 0 && <Skeleton className="h-8 w-full" />}
              {rooms.map((room) => (
                <Chip key={room.id} active={selectedRooms.includes(room.id)} onClick={() => setSelectedRooms((list) => toggle(list, room.id))}>
                  {room.name}
                  <span className="opacity-70">· {room.capacity}</span>
                </Chip>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedRooms.length} rooms · <span className="font-medium text-foreground">{capacity}</span> seats
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSelectedRooms(rooms.map((r) => r.id))}>
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRooms([])}>
                  None
                </Button>
              </div>
            </div>
          </Step>
        </CardContent>
      </Card>

      <Card>
        <CardToolbar
          title="Candidates"
          description="Only active students who meet the attendance requirement can be seated."
          actions={
            <div className="inline-flex rounded-lg border p-0.5">
              {(
                [
                  ['filters', 'Everyone matching'],
                  ['pick', 'Hand-pick'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Filter className="size-3.5" /> Departments {deptFilter.length === 0 && '· all'}
              </p>
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => (
                  <Chip key={d.id} active={deptFilter.includes(d.id)} onClick={() => setDeptFilter((list) => toggle(list, d.id))}>
                    {d.code}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Semesters {semFilter.length === 0 && '· all'}
                {exam && !semFilter.includes(exam.semester) && (
                  <button type="button" className="ml-2 normal-case text-primary hover:underline" onClick={() => setSemFilter([exam.semester])}>
                    Use exam semester ({exam.semester})
                  </button>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SEMESTERS.map((s) => (
                  <Chip key={s} active={semFilter.includes(s)} onClick={() => setSemFilter((list) => toggle(list, s))}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {mode === 'filters' ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <Users className="size-5 text-primary" />
              <p className="text-sm">
                {matching === null ? (
                  'Counting eligible students…'
                ) : (
                  <>
                    <span className="font-semibold">{matching.toLocaleString()}</span> eligible students match. All of them will be seated — the
                    list is resolved on the server, so there is no limit on how many.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-64">
                  <Input icon={<Search />} placeholder="Roll, name or email…" value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} aria-label="Search candidates" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setPicked((list) => Array.from(new Set([...list, ...pickList.map((s) => s.id)])))} disabled={!pickList.length}>
                  Select shown ({pickList.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPicked([])} disabled={!picked.length}>
                  Clear ({picked.length})
                </Button>
                {pickTotal > pickList.length && (
                  <span className="text-xs text-muted-foreground">
                    Showing {pickList.length} of {pickTotal}. Search to narrow, or use “Everyone matching” to seat all of them.
                  </span>
                )}
              </div>
              {pickLoading && pickList.length === 0 ? (
                <Skeleton className="h-40 w-full" />
              ) : pickList.length === 0 ? (
                <EmptyState icon={<Users />} title="No eligible students match" description="Check attendance and eligibility on the Students page." />
              ) : (
                <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 scrollbar-thin sm:grid-cols-2 lg:grid-cols-4">
                  {pickList.map((s) => {
                    const selected = picked.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPicked((list) => toggle(list, s.id))}
                        aria-pressed={selected}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                          selected ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted'
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                          )}
                        >
                          {selected && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs font-semibold">{s.rollNumber}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.firstName} {s.lastName} · {s.departmentName} · Sem {s.currentSemester}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
          <div className="text-sm">
            {overCapacity ? (
              <span className="inline-flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" /> {candidateCount} candidates but only {capacity} seats in the chosen rooms
              </span>
            ) : (
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{candidateCount}</span> students → {capacity} seats in {selectedRooms.length} rooms · {scopeLabel}
              </span>
            )}
          </div>
          <Button onClick={handleAllocate} loading={isSubmitting} disabled={!editable || candidateCount === 0 || selectedRooms.length === 0 || !papers.length}>
            <LayoutGrid /> Allocate seats
          </Button>
        </div>
      </Card>

      {result && (
        <Card>
          <CardToolbar title="Allocation results" description={ALGORITHMS.find((a) => a.value === result.algorithm)?.label} />
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Requested" value={result.totalStudents} icon={<Users />} tone="indigo" />
              <StatCard label="Seated" value={result.allocatedStudents} icon={<Check />} tone="emerald" />
              <StatCard label="Not seated" value={result.failedAllocations} icon={<AlertTriangle />} tone="rose" />
              <StatCard label="Same-dept neighbours" value={result.adjacentSameDeptPairs ?? 0} icon={<ShieldCheck />} tone="amber" />
            </div>
            {result.errors.length > 0 && (
              <Alert tone="danger" title={`${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}`}>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {result.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>{e.error}</li>
                  ))}
                  {result.errors.length > 8 && <li>…and {result.errors.length - 8} more</li>}
                </ul>
              </Alert>
            )}
            {result.allocatedStudents > 0 && (
              <Alert
                tone="info"
                title="Next: assign invigilators and notify students"
                action={
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/teacher-allocation">
                        <UserCheck /> Invigilators <ArrowRight />
                      </Link>
                    </Button>
                    <Button size="sm" onClick={() => setNotifyOpen(true)}>
                      <Send /> Notify
                    </Button>
                  </div>
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      {papers.length > 0 && (
        <Card>
          <CardToolbar title="Papers" description="Seating and exam-day attendance per paper" />
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Paper</TH>
                  <TH>Seated</TH>
                  <TH>Attendance taken</TH>
                  <TH className="text-right">View</TH>
                </tr>
              </THead>
              <TBody>
                {papers.map((p) => {
                  const seated = seatedPerPaper.get(p.id) ?? 0
                  const marked = markedPerPaper.get(p.id) ?? 0
                  return (
                    <TR key={p.id} className={cn(p.id === viewSession && 'bg-primary/5')}>
                      <TD className="font-medium">{paperLabel(p)}</TD>
                      <TD>{seated ? <Badge variant="success">{seated} seated</Badge> : <Badge variant="secondary">Not seated</Badge>}</TD>
                      <TD className="text-muted-foreground">{seated ? `${marked} of ${seated}` : '—'}</TD>
                      <TD className="text-right">
                        <Button variant={p.id === viewSession ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewSession(p.id)} disabled={!seated}>
                          {p.id === viewSession ? 'Viewing' : 'View'}
                        </Button>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </div>
        </Card>
      )}

      {isLoading && !allocations.length ? (
        <Skeleton className="h-64 w-full" />
      ) : displayAllocations.length > 0 ? (
        <>
          <Card>
            <CardToolbar
              title={`Seat map · ${view?.subjectName ?? ''}`}
              description={`${displayAllocations.length} students across ${new Set(displayAllocations.map((a) => a.roomId)).size} rooms`}
              actions={
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/attendance?sessionId=${viewSession}&roomId=${mapRoomId}`}>
                    <ClipboardCheck /> Attendance for this hall
                  </Link>
                </Button>
              }
            />
            <CardContent>
              <SeatMap rooms={mapRooms} benches={benches} allocations={displayAllocations} selectedRoomId={mapRoomId} onRoomChange={setMapRoomId} />
            </CardContent>
          </Card>

          <Card>
            <CardToolbar
              title="Allocation table"
              description={`${tableRows.length} rows`}
              actions={
                <div className="w-60">
                  <Input icon={<Search />} placeholder="Filter rows…" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} aria-label="Filter allocation table" />
                </div>
              }
            />
            <div className="max-h-[520px] overflow-y-auto scrollbar-thin">
              <Table>
                <THead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <TH>Roll no.</TH>
                    <TH>Student</TH>
                    <TH>Department</TH>
                    <TH>Room</TH>
                    <TH>Seat</TH>
                    <TH>Attendance</TH>
                    <TH>Invigilators</TH>
                  </tr>
                </THead>
                <TBody>
                  {tableRows.map((a) => {
                    const invigilators = roomDuties.get(a.roomId) ?? []
                    return (
                      <TR key={`${a.studentId}-${a.benchId}`}>
                        <TD className="font-mono text-xs">{a.studentRollNumber}</TD>
                        <TD className="font-medium">{a.studentName}</TD>
                        <TD className="text-muted-foreground">{a.departmentName}</TD>
                        <TD>{a.roomNumber}</TD>
                        <TD>
                          <Badge variant="secondary">{a.seatLabel}</Badge>
                        </TD>
                        <TD>
                          {a.attendanceStatus === 'present' ? (
                            <Badge variant="success">Present</Badge>
                          ) : a.attendanceStatus === 'absent' ? (
                            <Badge variant="danger">Absent</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TD>
                        <TD className={cn('max-w-[260px] truncate text-xs', invigilators.length ? '' : 'text-muted-foreground')}>
                          {invigilators.length ? invigilators.join('; ') : 'Unassigned'}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </div>
          </Card>
        </>
      ) : (
        selectedExam &&
        papers.length > 0 &&
        !result && (
          <EmptyState icon={<LayoutGrid />} title="No seating plan yet" description="Choose candidates and rooms above, then allocate seats to see the seat map." />
        )
      )}

      {exam && (
        <NotifyDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          title="Notify students"
          description={`Send every seated student their papers, halls and seats for ${exam.name}.`}
          audience="students"
          onSend={(channels) => seatService.notifyStudents(exam.id, channels)}
        />
      )}
    </div>
  )
}
