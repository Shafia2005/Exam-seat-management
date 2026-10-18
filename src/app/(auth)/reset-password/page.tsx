'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { api, errorMessage } from '@/lib/api-client'
import { AuthShell } from '@/components/auth-shell'
import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ organizationSlug: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('The password must be at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setLoading(true)
    try {
      const { data } = await api.post<{ organizationSlug: string }>('/auth/reset-password', { token, password })
      setDone(data)
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password.'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <Alert tone="danger" title="This reset link is incomplete">
          Open the link from the email again, or request a new one.
        </Alert>
        <Button className="w-full" asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <ShieldCheck className="size-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Password updated</h2>
          <p className="text-sm text-muted-foreground">You have been signed out on every device. Sign in with your new password.</p>
        </div>
        <Button size="lg" className="w-full" asChild>
          <Link href={`/login?organization=${encodeURIComponent(done.organizationSlug)}`}>
            Sign in <ArrowRight />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
        <p className="text-sm text-muted-foreground">The link works once and expires 30 minutes after it was sent.</p>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {error && (
          <Alert tone="danger">
            {error}{' '}
            {/expired|invalid/i.test(error) && (
              <Link href="/forgot-password" className="font-medium underline">
                Request a new link
              </Link>
            )}
          </Alert>
        )}
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <PasswordInput id="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <PasswordInput id="confirm" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          <KeyRound /> Set new password
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
