'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BadgeCheck, Check, Fingerprint, Loader2, Lock, QrCode, ShieldCheck, Shuffle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Animated hall preview for the landing page. It loops through the product flow on one
 * hall: verify candidates, interleave departments, catch and fix a same-department
 * neighbour, then lock the plan and scan a hall ticket at the door.
 *
 * The first frame is the finished plan, so the server render matches the client. The
 * loop pauses while the card is off-screen or the tab is hidden, and never starts for
 * visitors who prefer reduced motion.
 */

const ROWS = 6
const COLS = 10
const SEATS_ALLOCATED = 1248

// Department colours, in the order the interleave pattern uses them.
const DEPARTMENTS = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-rose-500', 'bg-violet-500']
const departmentOf = (row: number, col: number) => (row * 4 + col) % DEPARTMENTS.length

// This seat first lands beside a same-department neighbour, until the safeguard re-seats it.
const CONFLICT = { row: 2, col: 5 }
const NEIGHBOUR = { row: 2, col: 4 }
// The seat whose hall ticket is scanned (row B, seat 8).
const SCANNED = { row: 1, col: 7 }

type Phase = 'done' | 'reset' | 'scan' | 'allocate' | 'conflict' | 'resolve' | 'lock' | 'ticket'

const SEQUENCE: { phase: Phase; ms: number }[] = [
  { phase: 'done', ms: 2200 },
  { phase: 'reset', ms: 700 },
  { phase: 'scan', ms: 1500 },
  { phase: 'allocate', ms: 1500 },
  { phase: 'conflict', ms: 1400 },
  { phase: 'resolve', ms: 1000 },
  { phase: 'lock', ms: 1500 },
  { phase: 'ticket', ms: 2400 },
]

const STATUS: Record<Phase, string> = {
  done: '60 seats · 6 departments interleaved',
  reset: 'Starting a new allocation…',
  scan: 'Verifying 60 eligible candidates…',
  allocate: 'Interleaving 6 departments…',
  conflict: 'Same-department neighbours found',
  resolve: 'Re-seating 1 candidate…',
  lock: 'Seating locked and signed',
  ticket: 'Hall ticket scanned at the door',
}

const STEPS = [
  { label: 'Verify', icon: Fingerprint },
  { label: 'Interleave', icon: Shuffle },
  { label: 'Safeguard', icon: ShieldCheck },
  { label: 'Lock', icon: Lock },
]

// Index of the active step; STEPS.length means every step is complete.
const ACTIVE_STEP: Record<Phase, number> = {
  reset: -1,
  scan: 0,
  allocate: 1,
  conflict: 2,
  resolve: 2,
  lock: 3,
  ticket: 4,
  done: 4,
}

function conflictBadge(phase: Phase) {
  if (phase === 'conflict') {
    return { label: '1 conflict', icon: AlertTriangle, spin: false, className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' }
  }
  if (phase === 'reset' || phase === 'scan' || phase === 'allocate') {
    return { label: 'Checking', icon: Loader2, spin: true, className: 'bg-muted text-muted-foreground' }
  }
  return { label: '0 conflicts', icon: ShieldCheck, spin: false, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' }
}

const isSeat = (seat: { row: number; col: number }, row: number, col: number) => seat.row === row && seat.col === col

export function HeroSeatDemo() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [countUp, setCountUp] = useState(0)

  const phase = SEQUENCE[step].phase
  const filled = phase !== 'reset' && phase !== 'scan'
  const locked = phase === 'lock' || phase === 'ticket' || phase === 'done'
  const allocated = phase === 'allocate' ? countUp : filled ? SEATS_ALLOCATED : 0
  const activeStep = ACTIVE_STEP[phase]
  const badge = conflictBadge(phase)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = false
    const update = () => {
      if (reducedMotion.matches) setStep(0)
      setPlaying(inView && !document.hidden && !reducedMotion.matches)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
        update()
      },
      { threshold: 0.25 }
    )
    observer.observe(root)
    document.addEventListener('visibilitychange', update)
    reducedMotion.addEventListener('change', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
      reducedMotion.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setStep((s) => (s + 1) % SEQUENCE.length), SEQUENCE[step].ms)
    return () => clearTimeout(timer)
  }, [playing, step])

  // Count the allocated seats up while the hall fills.
  useEffect(() => {
    if (phase !== 'allocate') return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200)
      setCountUp(Math.round(SEATS_ALLOCATED * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Animated preview: SeatGuard verifies candidates, interleaves departments, fixes a same-department neighbour, then locks the seating and verifies a hall ticket."
      className="relative"
    >
      <div className="rounded-2xl border bg-card p-5 shadow-elevated">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Hall CS-101</p>
            <p key={phase} className="text-xs text-muted-foreground duration-300 animate-in fade-in">
              {STATUS[phase]}
            </p>
          </div>
          <span
            key={badge.label}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium duration-200 animate-in fade-in zoom-in-95',
              badge.className
            )}
          >
            <badge.icon className={cn('size-3', badge.spin && 'animate-spin')} />
            {badge.label}
          </span>
        </div>

        <ol className="mb-4 grid grid-cols-4 gap-2">
          {STEPS.map(({ label, icon: Icon }, i) => {
            const state = i < activeStep ? 'complete' : i === activeStep ? 'active' : 'idle'
            return (
              <li key={label} className="space-y-1.5">
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width,background-color] ease-out',
                      state === 'complete' && 'w-full bg-emerald-500 duration-300',
                      state === 'active' && 'w-full bg-primary duration-[1200ms]',
                      state === 'idle' && 'w-0 bg-primary duration-0'
                    )}
                  />
                </div>
                <p
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-medium transition-colors',
                    state === 'complete' && 'text-emerald-600 dark:text-emerald-400',
                    state === 'active' && 'text-primary',
                    state === 'idle' && 'text-muted-foreground'
                  )}
                >
                  {state === 'complete' ? (
                    <Check className="size-3 shrink-0" />
                  ) : (
                    <Icon className={cn('size-3 shrink-0', state === 'active' && 'animate-pulse')} />
                  )}
                  <span className="truncate">{label}</span>
                </p>
              </li>
            )
          })}
        </ol>

        <div className="relative mb-3 rounded-md bg-muted py-1 text-center text-[0.65rem] font-medium tracking-[0.3em] text-muted-foreground">
          FRONT
          <Lock
            className={cn(
              'absolute right-2 top-1/2 size-3 -translate-y-1/2 text-primary transition-opacity duration-300',
              locked ? 'opacity-100' : 'opacity-0'
            )}
          />
        </div>

        <div className="relative">
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: ROWS * COLS }, (_, i) => {
              const row = Math.floor(i / COLS)
              const col = i % COLS
              const conflictSeat = isSeat(CONFLICT, row, col)
              const pair = conflictSeat || isSeat(NEIGHBOUR, row, col)
              const scanned = isSeat(SCANNED, row, col) && phase === 'ticket'
              // Spotlight the seats in question by dimming the rest of the hall.
              const dimmed =
                phase === 'conflict' || phase === 'resolve' ? !pair : phase === 'ticket' ? !scanned : false
              const department =
                conflictSeat && (phase === 'allocate' || phase === 'conflict')
                  ? departmentOf(NEIGHBOUR.row, NEIGHBOUR.col)
                  : departmentOf(row, col)
              // Seats fill in a diagonal wave, light up row by row under the scan, and clear in reverse.
              const wave = row + col
              const delay =
                phase === 'allocate' ? wave * 45 : phase === 'scan' ? row * 200 : phase === 'reset' ? (ROWS + COLS - 2 - wave) * 20 : 0
              return (
                <span
                  key={i}
                  style={{ transitionDelay: `${delay}ms` }}
                  className={cn(
                    'relative aspect-square rounded-[5px] transition-[background-color,opacity,transform,box-shadow] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none',
                    filled
                      ? `${DEPARTMENTS[department]} scale-100 ${dimmed ? 'opacity-35' : 'opacity-90'}`
                      : phase === 'scan'
                        ? 'scale-90 bg-primary/25'
                        : 'scale-75 bg-muted opacity-70',
                    pair &&
                      phase === 'conflict' &&
                      'ring-2 ring-rose-500 ring-offset-2 ring-offset-card shadow-[0_0_16px_rgb(244_63_94/0.6)]',
                    pair && phase === 'resolve' && 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-card',
                    conflictSeat && phase === 'resolve' && 'animate-seat-flip',
                    scanned && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                  )}
                >
                  {scanned && <span className="absolute inset-0 animate-ping rounded-[5px] bg-primary/60" />}
                </span>
              )
            })}
          </div>

          {phase === 'scan' && (
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
              <span className="absolute inset-x-0 top-0 h-1/4 animate-seat-scan border-b-2 border-primary bg-gradient-to-b from-transparent via-primary/10 to-primary/30 shadow-[0_6px_16px_-2px_hsl(var(--primary)/0.6)]" />
            </span>
          )}

          {phase === 'lock' && (
            <>
              <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
                <span className="absolute inset-y-0 left-0 w-1/3 animate-seat-sheen bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </span>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-2 rounded-full border bg-card/90 px-3.5 py-1.5 text-xs font-semibold shadow-elevated backdrop-blur duration-300 animate-in fade-in zoom-in-90">
                  <Lock className="size-3.5 text-primary" /> Seating locked · signed
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="absolute -bottom-6 -left-6 hidden w-44 rounded-xl border bg-card p-4 shadow-elevated sm:block">
        <p className="text-xs text-muted-foreground">Seats allocated</p>
        <p className="text-2xl font-semibold tabular-nums">{allocated.toLocaleString('en-US')}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            style={{ width: `${(allocated / SEATS_ALLOCATED) * 100}%` }}
          />
        </div>
      </div>

      {phase === 'ticket' && (
        <div className="absolute -bottom-6 -right-4 hidden items-center gap-3 rounded-xl border bg-card p-3 pr-4 shadow-elevated duration-300 animate-in fade-in slide-in-from-bottom-2 sm:flex">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <QrCode className="size-5" />
          </span>
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold">
              <BadgeCheck className="size-3.5 text-emerald-500" /> Hall ticket verified
            </p>
            <p className="text-[11px] text-muted-foreground">Seat B8 · signature valid</p>
          </div>
        </div>
      )}
    </div>
  )
}
