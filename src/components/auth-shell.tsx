import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Logo, LogoMark } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/theme'

const HIGHLIGHTS = [
  'Anti-cheating seat allocation across every hall',
  'Invigilation rosters balanced by department and workload',
  'Hall tickets students can view and print instantly',
]

/** Split-screen layout for the sign-in and registration pages. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800 p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2.5">
          <LogoMark className="bg-white/15 from-white/20 to-white/5 shadow-none ring-1 ring-white/30" />
          <span className="text-lg font-semibold tracking-tight">SeatGuard</span>
        </Link>

        <div className="relative my-auto max-w-md space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">Exam day, organised in minutes.</h1>
            <p className="text-lg text-indigo-100/90">
              Scheduling, seating, invigilation and hall tickets for your whole institution — in one secure workspace.
            </p>
          </div>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-3 text-indigo-50">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-indigo-200/80">Multi-institution · Role-based access · Encrypted sessions</p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-col bg-background">
        <div className="flex items-center justify-between p-5 sm:p-6">
          <Link href="/" className="lg:invisible">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  )
}
