import * as React from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

// ─── Skeleton ───────────────────────────────────────────────────────────────

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

const AVATAR_TONES = [
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
]

/** Strips honorifics so "Dr. Mohan Patel" → "MP". */
export function initials(name: string): string {
  const parts = name.replace(/\b(dr|prof|mr|mrs|ms)\.?\s+/gi, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]
  const sizes = { sm: 'size-7 text-[0.65rem]', md: 'size-9 text-xs', lg: 'size-11 text-sm', xl: 'size-14 text-base' }
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold', tone, sizes[size], className)}
    >
      {initials(name)}
    </span>
  )
}

// ─── Progress ───────────────────────────────────────────────────────────────

export function Progress({
  value,
  tone = 'primary',
  className,
}: {
  value: number
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const colors = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive' }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ─── Page header ────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  )
}

// ─── Stat card ──────────────────────────────────────────────────────────────

const STAT_TONES = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
} as const

export type StatTone = keyof typeof STAT_TONES

export function StatCard({
  label,
  value,
  icon,
  tone = 'indigo',
  hint,
  loading,
}: {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  tone?: StatTone
  hint?: React.ReactNode
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>}
        </div>
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5', STAT_TONES[tone])}>{icon}</div>
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  noun = 'results',
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  total: number
  limit: number
  noun?: string
  onPageChange: (page: number) => void
  className?: string
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm', className)}>
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–<span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft /> Previous
        </Button>
        <span className="px-1 text-muted-foreground tabular-nums">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

// ─── Alert ──────────────────────────────────────────────────────────────────

const ALERT_TONES = {
  info: { cls: 'border-sky-500/30 bg-sky-500/5 text-sky-800 dark:text-sky-300', Icon: Info },
  success: { cls: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300', Icon: CheckCircle2 },
  warning: { cls: 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300', Icon: AlertTriangle },
  danger: { cls: 'border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300', Icon: AlertCircle },
} as const

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_TONES
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const { cls, Icon } = ALERT_TONES[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
