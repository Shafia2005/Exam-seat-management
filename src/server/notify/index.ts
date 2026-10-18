// Email (SMTP via nodemailer) and SMS (Twilio REST) delivery. Without provider
// settings, messages are recorded in the notification log as "logged" and printed
// to the server console, so every flow still works in development.

import nodemailer, { type Transporter } from 'nodemailer'
import type { NotificationChannel, NotificationStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface OutgoingMessage {
  channel: NotificationChannel
  to: string
  toName?: string
  subject?: string
  text: string
  html?: string
  relatedType?: string
  relatedId?: string
  /** Stored in the log instead of `text`, e.g. to keep reset links out of the admin outbox. */
  logBody?: string
}

export interface DeliveryCounts {
  sent: number
  logged: number
  failed: number
}

const smtpConfigured = () => !!process.env.SMTP_HOST
const twilioConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)

/** Public base URL used in links sent by email/SMS and in hall-ticket QR codes. */
export function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function deliveryStatus(): { email: 'smtp' | 'log'; sms: 'twilio' | 'log' } {
  return { email: smtpConfigured() ? 'smtp' : 'log', sms: twilioConfigured() ? 'twilio' : 'log' }
}

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!smtpConfigured()) return null
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  })
  return transporter
}

/** Normalises a phone number to E.164, prefixing SMS_DEFAULT_COUNTRY_CODE (e.g. "+91") when needed. */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7) return null
  if (trimmed.startsWith('+')) return `+${digits}`
  const country = (process.env.SMS_DEFAULT_COUNTRY_CODE || '+91').replace(/\D/g, '')
  return `+${country}${digits.replace(/^0+/, '')}`
}

async function deliver(msg: OutgoingMessage): Promise<{ status: NotificationStatus; error?: string }> {
  try {
    if (msg.channel === 'EMAIL') {
      const t = getTransporter()
      if (!t) {
        console.info(`[notify] email (not sent — SMTP not configured) to ${msg.to}: ${msg.subject}\n${msg.logBody ?? msg.text}\n`)
        return { status: 'LOGGED' }
      }
      await t.sendMail({
        from: process.env.SMTP_FROM || 'SeatGuard <no-reply@seatguard.local>',
        to: msg.toName ? `"${msg.toName.replace(/"/g, '')}" <${msg.to}>` : msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      })
      return { status: 'SENT' }
    }

    if (!twilioConfigured()) {
      console.info(`[notify] SMS (not sent — Twilio not configured) to ${msg.to}: ${msg.logBody ?? msg.text}\n`)
      return { status: 'LOGGED' }
    }
    const sid = process.env.TWILIO_ACCOUNT_SID!
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: msg.to, From: process.env.TWILIO_FROM_NUMBER!, Body: msg.text }),
    })
    if (!res.ok) return { status: 'FAILED', error: `Twilio ${res.status}: ${(await res.text()).slice(0, 300)}` }
    return { status: 'SENT' }
  } catch (err) {
    return { status: 'FAILED', error: err instanceof Error ? err.message : String(err) }
  }
}

/** Delivers messages (5 at a time) and records each one in the notification log. */
export async function sendMessages(organizationId: string, messages: OutgoingMessage[]): Promise<DeliveryCounts> {
  const counts: DeliveryCounts = { sent: 0, logged: 0, failed: 0 }
  const rows: Prisma.NotificationLogCreateManyInput[] = []

  for (let i = 0; i < messages.length; i += 5) {
    const batch = messages.slice(i, i + 5)
    const results = await Promise.all(batch.map(deliver))
    results.forEach((r, j) => {
      const msg = batch[j]
      if (r.status === 'SENT') counts.sent++
      else if (r.status === 'LOGGED') counts.logged++
      else counts.failed++
      rows.push({
        organizationId,
        channel: msg.channel,
        recipient: msg.to,
        recipientName: msg.toName,
        subject: msg.subject,
        body: msg.logBody ?? msg.text,
        status: r.status,
        error: r.error,
        relatedType: msg.relatedType,
        relatedId: msg.relatedId,
      })
    })
  }

  if (rows.length) await prisma.notificationLog.createMany({ data: rows })
  return counts
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Minimal branded HTML email. */
export function renderEmailHtml(opts: {
  heading: string
  intro: string
  rows?: string[][]
  rowHeader?: string[]
  ctaUrl?: string
  ctaLabel?: string
  footer?: string
}): string {
  const table = opts.rows?.length
    ? `<table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">
        ${opts.rowHeader ? `<tr>${opts.rowHeader.map((h) => `<th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;color:#6b7280">${escapeHtml(h)}</th>`).join('')}</tr>` : ''}
        ${opts.rows.map((r) => `<tr>${r.map((c) => `<td style="padding:8px;border-bottom:1px solid #f1f5f9">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}
      </table>`
    : ''
  const cta = opts.ctaUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.ctaUrl)}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(opts.ctaLabel ?? 'Open SeatGuard')}</a></p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
      <p style="margin:0 0 4px;font-weight:700;color:#4f46e5">SeatGuard</p>
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(opts.heading)}</h1>
      <p style="margin:0;line-height:1.5">${escapeHtml(opts.intro)}</p>
      ${table}${cta}
      ${opts.footer ? `<p style="margin:24px 0 0;font-size:12px;color:#6b7280">${escapeHtml(opts.footer)}</p>` : ''}
    </div></body></html>`
}
