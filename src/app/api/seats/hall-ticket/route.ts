import { ADMIN_ROLES } from '@/lib/auth/roles'
import { apiHandler, parseQuery } from '@/server/http'
import { requireAuth } from '@/server/session'
import { buildHallTicketPdf } from '@/server/services/hall-ticket.service'
import { hallTicketQuery } from '@/server/validation'

/** Hall ticket PDF with a verification QR code. Students get their own; admins pass `&studentId=`. */
export const GET = apiHandler(async (req) => {
  const ctx = await requireAuth(req, [...ADMIN_ROLES, 'STUDENT'])
  const { examId, studentId } = parseQuery(req, hallTicketQuery)
  const { pdf, fileName } = await buildHallTicketPdf(ctx, examId, studentId)
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
