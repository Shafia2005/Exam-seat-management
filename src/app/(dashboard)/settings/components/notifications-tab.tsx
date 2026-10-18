'use client'

import { useEffect, useState } from 'react'
import { Mail, MessageSquare, Send } from 'lucide-react'
import { notificationService, type NotificationDeliveryStatus, type NotificationLogEntry } from '@/modules/admin'
import { errorMessage } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Alert, EmptyState, Pagination, Skeleton } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'

const STATUS_BADGE = { sent: 'success', logged: 'secondary', failed: 'danger' } as const
const LIMIT = 20

/** Outbox of every email/SMS, and whether real delivery is configured. */
export function NotificationsTab() {
  const [status, setStatus] = useState<NotificationDeliveryStatus | null>(null)
  const [rows, setRows] = useState<NotificationLogEntry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [channel, setChannel] = useState<'' | 'email' | 'sms'>('')
  const [state, setState] = useState<'' | 'sent' | 'logged' | 'failed'>('')
  const [error, setError] = useState('')

  useEffect(() => {
    notificationService.status().then(setStatus).catch(() => undefined)
  }, [])

  useEffect(() => {
    setRows(null)
    notificationService
      .list({ page, limit: LIMIT, channel: channel || undefined, status: state || undefined })
      .then((res) => {
        setRows(res.rows)
        setTotal(res.total)
        setTotalPages(res.totalPages)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'Could not load notifications.')))
  }, [page, channel, state])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ['email', 'Email', Mail, status?.email === 'smtp', 'SMTP server connected', 'Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM'],
            ['sms', 'SMS', MessageSquare, status?.sms === 'twilio', 'Twilio connected', 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER'],
          ] as const
        ).map(([key, label, Icon, live, liveText, setupText]) => (
          <Card key={key} className="flex items-start gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{label}</p>
                {status && <Badge variant={live ? 'success' : 'warning'}>{live ? 'Live' : 'Log only'}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {!status ? 'Checking…' : live ? liveText : `Messages are recorded here and in the server log but not delivered. ${setupText} (see DEPLOYMENT.md).`}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardToolbar
          title="Outbox"
          description={`${total} message${total === 1 ? '' : 's'} · password-reset links are never stored`}
          actions={
            <div className="flex gap-2">
              <Select aria-label="Channel" value={channel} onChange={(e) => {
                  setPage(1)
                  setChannel(e.target.value as typeof channel)
                }} className="w-32">
                <option value="">All channels</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
              <Select aria-label="Status" value={state} onChange={(e) => {
                  setPage(1)
                  setState(e.target.value as typeof state)
                }} className="w-32">
                <option value="">Any status</option>
                <option value="sent">Sent</option>
                <option value="logged">Logged</option>
                <option value="failed">Failed</option>
              </Select>
            </div>
          }
        />
        {error ? (
          <CardContent>
            <Alert tone="danger">{error}</Alert>
          </CardContent>
        ) : !rows ? (
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        ) : rows.length === 0 ? (
          <CardContent>
            <EmptyState icon={<Send />} title="No messages yet" description="Use “Notify students” on Seat allocation or “Notify invigilators” on Invigilation." />
          </CardContent>
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>To</TH>
                  <TH>Message</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((n) => (
                  <TR key={n.id}>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</TD>
                    <TD>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {n.channel === 'email' ? <Mail className="size-3.5 text-muted-foreground" /> : <MessageSquare className="size-3.5 text-muted-foreground" />}
                        {n.recipientName ?? n.recipient}
                      </p>
                      {n.recipientName && <p className="text-xs text-muted-foreground">{n.recipient}</p>}
                    </TD>
                    <TD className="max-w-md">
                      {n.subject && <p className="truncate text-sm font-medium">{n.subject}</p>}
                      <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{n.body}</p>
                    </TD>
                    <TD>
                      <Badge variant={STATUS_BADGE[n.status]}>{n.status}</Badge>
                      {n.error && <p className="mt-1 max-w-[200px] truncate text-xs text-destructive" title={n.error}>{n.error}</p>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} noun="messages" onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
