import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { AuthContext } from './session'

export interface AuditEntry {
  /** Dotted action name, e.g. "student.created". */
  action: string
  entityType: string
  entityId?: string | null
  /** One human-readable sentence, e.g. "Added student CS2026001 (Asha Rao)". */
  summary: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Records who changed what. Failures are logged rather than thrown so an audit
 * outage never blocks the underlying operation.
 */
export async function audit(ctx: Pick<AuthContext, 'organizationId' | 'userId' | 'userName'>, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorName: ctx.userName,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        metadata: entry.metadata,
      },
    })
  } catch (err) {
    console.error('[audit] Failed to record entry', entry.action, err)
  }
}
