'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, Clock, Copy, Globe, Image as ImageIcon, MapPin, Percent } from 'lucide-react'
import { organizationService } from '@/services/organization.service'
import { errorMessage } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import type { Organization } from '@/types/auth.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardToolbar } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Alert, Skeleton } from '@/components/ui/misc'
import { confirmAction } from '@/lib/confirm'

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Berlin',
  'Africa/Nairobi',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
]

function supportedTimezones(current: string): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] }
  const all = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : COMMON_TIMEZONES
  return Array.from(new Set([current, ...COMMON_TIMEZONES, ...all]))
}

/** Exam policy: eligibility threshold and the timezone that decides "today". */
function PolicyCard({ org, onSaved }: { org: Organization; onSaved: (o: Organization) => void }) {
  const [threshold, setThreshold] = useState(String(org.minAttendancePercent))
  const [timezone, setTimezone] = useState(org.timezone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const zones = supportedTimezones(org.timezone)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const value = Number(threshold)
    if (!Number.isInteger(value) || value < 0 || value > 100) return setError('Minimum attendance must be a whole number from 0 to 100.')
    if (value !== org.minAttendancePercent) {
      const ok = await confirmAction({
        title: `Change the minimum attendance to ${value}%?`,
        description: 'Every student without a manual eligibility override is re-evaluated immediately. Existing seating is not changed.',
        confirmLabel: 'Apply',
      })
      if (!ok) return
    }
    setSaving(true)
    try {
      const updated = await organizationService.update({ minAttendancePercent: value, timezone })
      onSaved(updated)
      toast.success(
        'Exam policy saved',
        updated.eligibilityChanged ? `${updated.eligibilityChanged} student${updated.eligibilityChanged === 1 ? '' : 's'} changed eligibility.` : undefined
      )
    } catch (err) {
      setError(errorMessage(err, 'Could not save the exam policy.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="h-fit">
      <form onSubmit={save}>
        <CardToolbar title="Exam policy" description="Applies to every exam in this institution." />
        <CardContent className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Minimum attendance for eligibility" htmlFor="org-threshold" hint="Students below this are ineligible unless an admin overrides it.">
            <Input
              id="org-threshold"
              icon={<Percent />}
              type="number"
              min={0}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
          <Field label="Timezone" htmlFor="org-timezone" hint="Decides when exams become ongoing/completed and when attendance opens.">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Select id="org-timezone" className="pl-9" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={saving}>
            Save policy
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function CopyField({ label, value, hint }: { label: string; value: string; hint: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono" aria-label={label} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </Field>
  )
}

export function InstitutionTab() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [form, setForm] = useState({ name: '', address: '', logoUrl: '', domain: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    organizationService
      .get()
      .then((o) => {
        setOrg(o)
        setForm({ name: o.name, address: o.address ?? '', logoUrl: o.logoUrl ?? '', domain: o.domain ?? '' })
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load the organization')))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updated = await organizationService.update({
        name: form.name,
        address: form.address || null,
        logoUrl: form.logoUrl || null,
        domain: form.domain || null,
      })
      setOrg(updated)
      toast.success('Institution details saved')
    } catch (err) {
      setError(errorMessage(err, 'Could not save the institution details.'))
    } finally {
      setSaving(false)
    }
  }

  if (!org) return error ? <Alert tone="danger">{error}</Alert> : <Skeleton className="h-80 w-full rounded-xl" />

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <form onSubmit={save}>
          <CardToolbar title="Institution profile" description="Shown in the app header and on hall tickets." />
          <CardContent className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Institution name" htmlFor="org-name" required>
              <Input id="org-name" icon={<Building2 />} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Address" htmlFor="org-address">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Textarea id="org-address" className="pl-9" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Logo URL" htmlFor="org-logo">
                <Input id="org-logo" icon={<ImageIcon />} type="url" placeholder="https://…" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
              </Field>
              <Field label="Custom domain" htmlFor="org-domain" hint="Users on this domain are routed to your workspace.">
                <Input id="org-domain" icon={<Globe />} placeholder="exams.college.edu" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              </Field>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="space-y-6">
        <Card className="h-fit">
          <CardToolbar title="Sign-in identifiers" description="Share these with staff and students." />
          <CardContent className="space-y-4">
            <CopyField label="Organization slug" value={org.slug} hint="Entered on the sign-in page." />
            <CopyField label="Organization code" value={org.code} hint="Also accepted at sign-in." />
          </CardContent>
        </Card>
        <PolicyCard org={org} onSaved={setOrg} />
      </div>
    </div>
  )
}
