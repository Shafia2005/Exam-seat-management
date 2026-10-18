import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  LayoutGrid,
  ShieldCheck,
  Ticket,
  UserCheck,
} from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/theme'
import { Button } from '@/components/ui/button'

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Anti-cheating seating',
    body: 'Interleaves departments so no two neighbours share a paper — across every hall, in seconds.',
  },
  {
    icon: UserCheck,
    title: 'Invigilation rosters',
    body: 'Auto-assign chief and room invigilators with fair workloads and no departmental conflicts.',
  },
  {
    icon: Ticket,
    title: 'Digital hall tickets',
    body: 'Students see their hall, bench and invigilators the moment seating is published.',
  },
  {
    icon: CalendarDays,
    title: 'Exam scheduling',
    body: 'Plan exams and subject sittings, then publish when they are ready for allocation.',
  },
  {
    icon: BarChart3,
    title: 'Reports & exports',
    body: 'Attendance, eligibility and seating reports with one-click CSV downloads.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    body: 'Isolated workspaces per institution, role-based access and encrypted sessions.',
  },
]

// Seat colours for the decorative preview grid (department pattern).
const PREVIEW = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-rose-500', 'bg-violet-500']

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/register">Register institution</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-sky-500/20 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <Building2 className="size-3.5 text-primary" /> Built for colleges, universities and schools
              </span>
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Exam seating and invigilation,{' '}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
                  done right
                </span>
                .
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                Schedule exams, seat every candidate without same-department neighbours, staff each hall fairly and publish
                hall tickets — from one workspace.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">
                    Sign in to your workspace <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/register">Create an organization</Link>
                </Button>
              </div>
            </div>

            {/* Product preview */}
            <div className="relative">
              <div className="rounded-2xl border bg-card p-5 shadow-elevated">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Hall CS-101</p>
                    <p className="text-xs text-muted-foreground">60 seats · 6 departments interleaved</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    0 conflicts
                  </span>
                </div>
                <div className="mb-3 rounded-md bg-muted py-1 text-center text-[0.65rem] font-medium tracking-[0.3em] text-muted-foreground">
                  FRONT
                </div>
                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({ length: 60 }, (_, i) => {
                    const row = Math.floor(i / 10)
                    const col = i % 10
                    return (
                      <span
                        key={i}
                        className={`aspect-square rounded-[5px] opacity-80 ${PREVIEW[(row * 4 + col) % PREVIEW.length]}`}
                      />
                    )
                  })}
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 hidden rounded-xl border bg-card p-4 shadow-elevated sm:block">
                <p className="text-xs text-muted-foreground">Seats allocated</p>
                <p className="text-2xl font-semibold tabular-nums">1,248</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="mb-12 max-w-2xl space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight">Everything exam day needs</h2>
              <p className="text-muted-foreground">One place for administrators, invigilators and students.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
          <Logo />
          <p>© {new Date().getFullYear()} SeatGuard. Fair seating, guarded exams.</p>
        </div>
      </footer>
    </div>
  )
}
