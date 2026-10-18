import type { BadgeProps } from '@/components/ui/badge'
import type { ExamStatus, ExamType } from '@/types/exam.types'
import type { Student } from '@/types/student.types'
import type { Teacher } from '@/types/teacher.types'

type BadgeVariant = NonNullable<BadgeProps['variant']>

export const EXAM_STATUS_BADGE: Record<ExamStatus, BadgeVariant> = {
  draft: 'secondary',
  scheduled: 'info',
  ongoing: 'success',
  completed: 'violet',
  cancelled: 'danger',
}

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  mid_sem: 'Mid-semester',
  internal: 'Internal',
  final: 'Final',
  supplementary: 'Supplementary',
  practical: 'Practical',
}

export const STUDENT_STATUS_BADGE: Record<Student['status'], BadgeVariant> = {
  active: 'success',
  inactive: 'secondary',
  graduated: 'info',
  suspended: 'warning',
}

export const TEACHER_STATUS_BADGE: Record<Teacher['status'], BadgeVariant> = {
  active: 'success',
  inactive: 'secondary',
  on_leave: 'warning',
}

export const humanize = (value: string) => value.replace(/_/g, ' ')

/** Parses `YYYY-MM-DD` as a local calendar date (avoids UTC off-by-one shifts). */
function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function formatDay(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—'
  const date = parseDay(value) ?? new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...options })
}

export function formatDayRange(start?: string | null, end?: string | null): string {
  if (!start) return '—'
  if (!end || end === start) return formatDay(start)
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${formatDay(start, sameYear ? { year: undefined } : undefined)} – ${formatDay(end)}`
}

/** Downloads rows as a CSV file, quoting every field. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** "Oct 15 · 09:30–12:30" for a paper's sitting. */
export function formatSlot(date: string, startTime: string, endTime: string): string {
  return `${formatDay(date, { year: undefined })} · ${startTime}–${endTime}`
}

/** A paper as shown in pickers: "Deep Learning · Oct 15 · 09:30–12:30". */
export function paperLabel(p: { subjectName?: string; subjectId?: string; examDate: string; startTime: string; endTime: string }): string {
  return `${p.subjectName || p.subjectId || 'Paper'} · ${formatSlot(p.examDate, p.startTime, p.endTime)}`
}

/** "Today" as YYYY-MM-DD in an IANA timezone (falls back to the browser's zone). */
export function todayIn(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  }
}
