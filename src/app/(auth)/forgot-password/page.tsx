'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Building2, Mail, MailCheck } from 'lucide-react'
import { api, errorMessage } from '@/lib/api-client'
import { DEFAULT_ORG_SLUG } from '@/services/auth.service'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'

function ForgotPasswordForm() {
  const params = useSearchParams()
  const [organization, setOrganization] = useState(params.get('organization') ?? DEFAULT_ORG_SLUG)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<{ message: string; devResetUrl?: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ message: string; devResetUrl?: string }>('/auth/forgot-password', {
        organization: organization.trim() || undefined,
        email: email.trim(),
      })
      setSent(data)
    } catch (err) {
      setError(errorMessage(err, 'Could not send the reset link. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <MailCheck className="size-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="text-sm text-muted-foreground">{sent.message}</p>
        </div>
        {sent.devResetUrl && (
          <Alert tone="info" title="Development mode">
            No email server is configured, so here is the link that would have been emailed:{' '}
            <Link href={sent.devResetUrl.replace(/^https?:\/\/[^/]+/, '')} className="break-all font-medium underline">
              open reset link
            </Link>
          </Alert>
        )}
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">
            <ArrowLeft /> Back to sign in
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Forgot your password?</h2>
        <p className="text-sm text-muted-foreground">Enter the email on your account and we&apos;ll send a link to choose a new one.</p>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Organization code" htmlFor="organization" hint="Your institution slug or code, e.g. apex-institute or APEX.">
          <Input id="organization" icon={<Building2 />} autoComplete="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email" hint="Students and teachers who sign in with a roll number or employee ID use the email on their profile.">
          <Input id="email" icon={<Mail />} type="email" required autoComplete="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  )
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
