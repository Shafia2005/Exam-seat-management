import type { Metadata } from 'next'
import { CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { verifyHallTicket } from '@/server/services/hall-ticket.service'
import { Logo } from '@/components/layout/logo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verify hall ticket',
  robots: { index: false, follow: false },
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Public page behind the hall-ticket QR code, for invigilators at the hall door. */
export default async function VerifyHallTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await verifyHallTicket(decodeURIComponent(token))

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className={result.valid ? 'bg-emerald-600 px-6 py-5 text-white' : 'bg-red-600 px-6 py-5 text-white'}>
            <div className="flex items-center gap-3">
              {result.valid ? <ShieldCheck className="size-8" /> : <ShieldAlert className="size-8" />}
              <div>
                <p className="text-lg font-semibold">{result.valid ? 'Genuine hall ticket' : 'Not valid'}</p>
                <p className="text-sm opacity-90">{result.valid ? `Issued by ${result.organizationName}` : result.reason}</p>
              </div>
            </div>
          </div>

          {result.studentName && (
            <div className="space-y-5 p-6">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Candidate</dt>
                  <dd className="font-semibold">{result.studentName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Roll number</dt>
                  <dd className="font-mono font-semibold">{result.rollNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Department</dt>
                  <dd>{result.departmentName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Exam</dt>
                  <dd>{result.examName}</dd>
                </div>
              </dl>

              {result.isEligible === false && (
                <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400">
                  <XCircle className="size-4" /> Marked not eligible — refer to the examination office.
                </p>
              )}

              {result.papers && result.papers.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Seats</p>
                  <ul className="divide-y rounded-lg border text-sm">
                    {result.papers.map((p) => (
                      <li key={`${p.examDate}-${p.startTime}-${p.subjectName}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{p.subjectName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(p.examDate)} · {p.startTime}–{p.endTime}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-semibold">
                            {p.roomName} · {p.seatLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">{p.blockName}</span>
                        </span>
                        {p.attendance === 'present' && <CheckCircle2 className="size-4 text-emerald-600" aria-label="Marked present" />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Compare the name and roll number with the candidate&apos;s ID card. Seats can differ between papers.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
