'use client'

import { useState } from 'react'
import { Check, Copy, KeyRound, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { PasswordInput } from '@/components/password-input'

type Mode = 'generate' | 'set'

/**
 * Admin password reset for a student or teacher. The user is signed out of
 * every session; a generated temporary password is shown exactly once.
 */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  name,
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onReset: (password?: string) => Promise<{ temporaryPassword?: string }>
}) {
  const [mode, setMode] = useState<Mode>('generate')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [temporary, setTemporary] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const close = (o: boolean) => {
    if (!o) {
      setMode('generate')
      setPassword('')
      setError('')
      setTemporary(null)
      setCopied(false)
    }
    onOpenChange(o)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'set' && password.length < 8) return setError('The password must be at least 8 characters.')
    setSaving(true)
    try {
      const result = await onReset(mode === 'set' ? password : undefined)
      if (result.temporaryPassword) {
        setTemporary(result.temporaryPassword)
      } else {
        toast.success('Password updated', `${name} has been signed out of all devices.`)
        close(false)
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password.'))
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    if (!temporary) return
    await navigator.clipboard.writeText(temporary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        {temporary ? (
          <>
            <DialogHeader icon={<KeyRound />} title="Temporary password created" description={`Share it securely with ${name}.`} />
            <DialogBody className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                <code className="flex-1 select-all break-all font-mono text-base font-semibold tracking-wide">{temporary}</code>
                <Button type="button" variant="outline" size="sm" onClick={copy}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <Alert tone="warning">This password is shown only once. {name} has been signed out of all devices.</Alert>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <DialogHeader icon={<KeyRound />} title="Reset password" description={`${name} will be signed out of all devices.`} />
            <DialogBody className="space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['generate', 'Generate', 'A random temporary password', Sparkles],
                    ['set', 'Set manually', 'Choose the new password', KeyRound],
                  ] as const
                ).map(([value, label, hint, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                      mode === value ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'hover:bg-muted'
                    )}
                  >
                    <Icon className="size-4 text-primary" />
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
              {mode === 'set' && (
                <Field label="New password" htmlFor="reset-password" hint="At least 8 characters.">
                  <PasswordInput
                    id="reset-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </Field>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Reset password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
