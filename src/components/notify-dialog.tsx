'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Mail, MessageSquare, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { notificationService } from '@/modules/admin'
import type { NotificationChannel, NotificationDeliveryStatus, NotifyResult } from '@/types/admin.types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/misc'

const CHANNELS: { value: NotificationChannel; label: string; hint: string; Icon: typeof Mail }[] = [
  { value: 'email', label: 'Email', hint: 'Full details with a link', Icon: Mail },
  { value: 'sms', label: 'SMS', hint: 'Short text to the phone on file', Icon: MessageSquare },
]

/** Sends seating (students) or duty (invigilators) notices for one exam by email and/or SMS. */
export function NotifyDialog({
  open,
  onOpenChange,
  title,
  description,
  audience,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** "students" or "invigilators", used in messages. */
  audience: string
  onSend: (channels: NotificationChannel[]) => Promise<NotifyResult>
}) {
  const [channels, setChannels] = useState<NotificationChannel[]>(['email'])
  const [status, setStatus] = useState<NotificationDeliveryStatus | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<NotifyResult | null>(null)

  useEffect(() => {
    if (open && !status) notificationService.status().then(setStatus).catch(() => undefined)
  }, [open, status])

  const close = (o: boolean) => {
    if (!o) {
      setError('')
      setResult(null)
    }
    onOpenChange(o)
  }

  const toggle = (c: NotificationChannel) => setChannels((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]))

  const send = async () => {
    setError('')
    setSending(true)
    try {
      const res = await onSend(channels)
      setResult(res)
      toast.success(`Notified ${res.recipients} ${audience}`, res.logged ? 'Delivery providers are not configured, so messages were logged.' : undefined)
    } catch (err) {
      setError(errorMessage(err, 'Could not send notifications.'))
    } finally {
      setSending(false)
    }
  }

  const logOnly = status && channels.some((c) => (c === 'email' ? status.email === 'log' : status.sms === 'log'))

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        <DialogHeader icon={<Send />} title={title} description={description} />
        <DialogBody className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {result ? (
            <div className="space-y-3">
              <Alert tone={result.failed ? 'warning' : 'success'} title={`${result.recipients} ${audience} notified`}>
                {result.sent} delivered · {result.logged} logged · {result.failed} failed
                {result.skipped > 0 && ` · ${result.skipped} without a valid phone number`}
              </Alert>
              <p className="text-sm text-muted-foreground">
                Every message is listed under{' '}
                <Link href="/settings?tab=notifications" className="font-medium text-primary hover:underline">
                  Settings → Notifications
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map(({ value, label, hint, Icon }) => {
                  const active = channels.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggle(value)}
                      aria-pressed={active}
                      className={cn(
                        'relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                        active ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'hover:bg-muted'
                      )}
                    >
                      {active && <Check className="absolute right-2.5 top-2.5 size-4 text-primary" />}
                      <Icon className="size-4 text-primary" />
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </button>
                  )
                })}
              </div>
              {logOnly && (
                <Alert tone="info" title="Demo mode">
                  No {status?.email === 'log' && channels.includes('email') ? 'SMTP server' : 'SMS provider'} is configured, so messages are recorded in
                  the outbox and the server log instead of being delivered. See DEPLOYMENT.md to connect one.
                </Alert>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {result ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={send} loading={sending} disabled={channels.length === 0}>
                <Send /> Send
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
