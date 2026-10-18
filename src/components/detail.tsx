import { cn } from '@/lib/utils'

/** Label/value pair for detail views. */
export function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 space-y-0.5', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}

export function DetailGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3', className)}>{children}</dl>
}
