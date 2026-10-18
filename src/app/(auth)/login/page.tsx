'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, GraduationCap, Shield, User, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApiClientError } from '@/lib/api-client'
import { ROLE_HOME, canAccessPage, rolesForPage } from '@/lib/auth/roles'
import {
  authService,
  DEFAULT_ORG_SLUG,
  DEMO_CREDENTIALS,
  DEMO_LOGIN_ENABLED,
  type DemoRole,
} from '@/services/auth.service'
import type { DbUserRole } from '@/types/auth.types'
import { AuthShell } from '@/components/auth-shell'
import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'

type ErrorField = 'organization' | 'credentials' | null

const DEMO_TILES: { role: DemoRole; label: string; hint: string; Icon: typeof Shield }[] = [
  { role: 'admin', label: 'Admin', hint: 'Full access', Icon: Shield },
  { role: 'teacher', label: 'Teacher', hint: 'My duties', Icon: UserCheck },
  { role: 'student', label: 'Student', hint: 'Hall ticket', Icon: GraduationCap },
]

/** Honours `?next=` when it points at a dashboard page this role may open. */
function redirectTarget(role: DbUserRole): string {
  const next = new URLSearchParams(window.location.search).get('next')
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    const path = next.split('?')[0]
    if (rolesForPage(path) && canAccessPage(path, role)) return next
  }
  return ROLE_HOME[role]
}

export default function LoginPage() {
  const router = useRouter()
  const [organization, setOrganization] = useState(DEFAULT_ORG_SLUG)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingDemo, setPendingDemo] = useState<DemoRole | null>(null)
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState<ErrorField>(null)

  // Pre-fill the organization when arriving from a reset or invitation link.
  useEffect(() => {
    const org = new URLSearchParams(window.location.search).get('organization')
    if (org) setOrganization(org)
  }, [])

  const performLogin = async (org: string, identifier: string, userPass: string) => {
    setIsLoading(true)
    setError('')
    setErrorField(null)

    try {
      const res = await authService.login({ organization: org.trim(), identifier: identifier.trim(), password: userPass })
      router.replace(redirectTarget(res.user.role ?? 'STUDENT'))
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
        if (err.code === 'ORGANIZATION_NOT_FOUND') setErrorField('organization')
        else if (err.code === 'INVALID_CREDENTIALS') setErrorField('credentials')
      } else {
        setError('Unable to reach the server. Check your connection and try again.')
      }
      setIsLoading(false)
      setPendingDemo(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    performLogin(organization, email, password)
  }

  const handleQuickLogin = (role: DemoRole) => {
    const { identifier, password: demoPassword } = DEMO_CREDENTIALS[role]
    setOrganization(DEFAULT_ORG_SLUG)
    setEmail(identifier)
    setPassword(demoPassword)
    setPendingDemo(role)
    performLogin(DEFAULT_ORG_SLUG, identifier, demoPassword)
  }

  return (
    <AuthShell>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in to your institution&apos;s workspace.</p>
      </div>

      {DEMO_LOGIN_ENABLED && (
        <div className="mt-7">
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Try a demo account</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_TILES.map(({ role, label, hint, Icon }) => (
              <button
                key={role}
                type="button"
                onClick={() => handleQuickLogin(role)}
                disabled={isLoading}
                aria-label={`Sign in as demo ${label}`}
                className={cn(
                  'group flex flex-col items-center gap-1 rounded-xl border bg-card px-2 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:pointer-events-none disabled:opacity-60',
                  pendingDemo === role && 'border-primary ring-4 ring-primary/15'
                )}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className={cn('size-4', pendingDemo === role && 'animate-pulse')} />
                </span>
                <span className="text-sm font-medium">{label}</span>
                <span className="text-[0.7rem] text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or sign in manually
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={cn('space-y-4', !DEMO_LOGIN_ENABLED && 'mt-7')}>
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Organization code" htmlFor="organization" hint={!error ? 'Your institution slug or code, e.g. apex-institute or APEX.' : undefined}>
          <Input
            id="organization"
            icon={<Building2 />}
            autoComplete="organization"
            placeholder="apex-institute"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            aria-invalid={errorField === 'organization'}
          />
        </Field>

        <Field label="Email, roll no. or employee ID" htmlFor="email">
          <Input
            id="email"
            icon={<User />}
            required
            autoComplete="username"
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errorField === 'credentials'}
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errorField === 'credentials'}
          />
        </Field>
        <div className="-mt-2 text-right">
          <Link
            href={`/forgot-password${organization.trim() ? `?organization=${encodeURIComponent(organization.trim())}` : ''}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isLoading && !pendingDemo}>
          {isLoading ? 'Signing in…' : 'Sign in'}
          {!isLoading && <ArrowRight />}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New institution?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an organization
        </Link>
      </p>
    </AuthShell>
  )
}
