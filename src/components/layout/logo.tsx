import { cn } from '@/lib/utils'

/** SeatGuard mark: a shield holding seats in the alternating pattern the anti-cheating layout produces. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30',
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[62%]" aria-hidden>
        <path
          d="M12 2.5l7.5 2.8v6.1c0 4.6-3.1 8.6-7.5 10.1-4.4-1.5-7.5-5.5-7.5-10.1V5.3L12 2.5z"
          fill="currentColor"
          fillOpacity=".15"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <rect x="7.6" y="7.6" width="3.8" height="2.8" rx=".8" fill="currentColor" />
        <rect x="12.6" y="7.6" width="3.8" height="2.8" rx=".8" fill="currentColor" opacity=".5" />
        <rect x="7.6" y="11.6" width="3.8" height="2.8" rx=".8" fill="currentColor" opacity=".5" />
        <rect x="12.6" y="11.6" width="3.8" height="2.8" rx=".8" fill="currentColor" />
      </svg>
    </span>
  )
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="min-w-0 leading-tight">
        <span className="block font-semibold tracking-tight">SeatGuard</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  )
}
