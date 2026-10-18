'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, Hash, Link2, Mail } from 'lucide-react'
import { ApiClientError } from '@/lib/api-client'
import { authService } from '@/services/auth.service'
import { AuthShell } from '@/components/auth-shell'
import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    slug: '',
    code: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [slugEdited, setSlugEdited] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [slugTaken, setSlugTaken] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setForm((f) => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSlugTaken(false)
    if (form.password.length < 8) return setError('The password must be at least 8 characters.')
    if (form.password !== form.confirm) return setError('The passwords do not match.')

    setSubmitting(true)
    try {
      await authService.registerOrganization({
        organization: { name: form.name.trim(), slug: form.slug.trim(), code: form.code.trim() || undefined },
        admin: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), password: form.password },
      })
      router.replace('/settings')
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
        setSlugTaken(err.code === 'ORGANIZATION_EXISTS')
      } else {
        setError('Unable to reach the server. Check your connection and try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Create your organization</h2>
        <p className="text-sm text-muted-foreground">Set up a workspace for your institution and its first administrator.</p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-6">
        {error && <Alert tone="danger">{error}</Alert>}

        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Institution</legend>
          <Field label="Institution name" htmlFor="org-name" required>
            <Input id="org-name" icon={<Building2 />} required placeholder="Northfield College of Engineering" value={form.name} onChange={onNameChange} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <Field label="Sign-in slug" htmlFor="org-slug" required hint="Users enter this at sign-in.">
              <Input
                id="org-slug"
                icon={<Link2 />}
                required
                minLength={3}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Lowercase letters, numbers and single hyphens"
                placeholder="northfield-college"
                value={form.slug}
                onChange={(e) => {
                  setSlugEdited(true)
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))
                }}
                aria-invalid={slugTaken}
              />
            </Field>
            <Field label="Short code" htmlFor="org-code" hint="Optional, e.g. NCE.">
              <Input
                id="org-code"
                icon={<Hash />}
                maxLength={12}
                placeholder="NCE"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                aria-invalid={slugTaken}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Administrator</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="admin-first" required>
              <Input id="admin-first" required autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
            </Field>
            <Field label="Last name" htmlFor="admin-last" required>
              <Input id="admin-last" required autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
            </Field>
          </div>
          <Field label="Work email" htmlFor="admin-email" required>
            <Input id="admin-email" icon={<Mail />} type="email" required autoComplete="email" placeholder="admin@college.edu" value={form.email} onChange={set('email')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" htmlFor="admin-password" required>
              <PasswordInput id="admin-password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
            </Field>
            <Field label="Confirm password" htmlFor="admin-confirm" required>
              <Input id="admin-confirm" type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
            </Field>
          </div>
        </fieldset>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? 'Creating workspace…' : 'Create organization'}
          {!submitting && <ArrowRight />}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
