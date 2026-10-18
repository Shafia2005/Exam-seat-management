'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { errorMessage } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { PasswordInput } from '@/components/password-input'

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) return setError('Your new password must be at least 8 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')
    setSaving(true)
    try {
      await authService.changePassword(current, next)
      toast.success('Password updated', 'You have been signed out on your other devices.')
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={<KeyRound />} title="Change password" description="Use at least 8 characters." />
          <DialogBody className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Current password" htmlFor="current-password">
              <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <Field label="New password" htmlFor="new-password">
              <PasswordInput id="new-password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password">
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
