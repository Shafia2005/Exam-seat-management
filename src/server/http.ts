import { randomUUID } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError, type ZodType, type ZodTypeDef } from 'zod'
import { SESSION_COOKIE } from '@/lib/auth/jwt'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, 'BAD_REQUEST', message, details)
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') => new ApiError(401, code, message)
export const forbidden = (message = 'You do not have permission to perform this action') => new ApiError(403, 'FORBIDDEN', message)
export const notFound = (message = 'Resource not found') => new ApiError(404, 'NOT_FOUND', message)
export const conflict = (message: string, code = 'CONFLICT') => new ApiError(409, code, message)

function meta(extra?: Record<string, unknown>) {
  return { timestamp: new Date().toISOString(), requestId: randomUUID(), ...extra }
}

export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }): NextResponse {
  return NextResponse.json({ success: true, data, meta: meta(init?.meta) }, { status: init?.status ?? 200 })
}

export function created<T>(data: T, extraMeta?: Record<string, unknown>): NextResponse {
  return ok(data, { status: 201, meta: extraMeta })
}

export function paginated<T>(data: T[], page: number, limit: number, total: number): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    meta: meta({ pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }),
  })
}

const FIELD_LABELS: Record<string, string> = {
  email: 'email',
  rollNumber: 'roll number',
  registrationNumber: 'registration number',
  employeeId: 'employee ID',
  slug: 'organization slug',
  code: 'code',
  domain: 'domain',
  name: 'name',
}

function errorResponse(status: number, code: string, message: string, details?: unknown): NextResponse {
  const res = NextResponse.json({ success: false, error: { code, message, details } }, { status })
  // A 401 means the session is unusable; drop the cookie so the browser stops sending it.
  if (status === 401) res.cookies.delete(SESSION_COOKIE)
  return res
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message, err.details)

  if (err instanceof ZodError) {
    const first = err.issues[0]
    const path = first?.path.join('.')
    const message = first ? (path ? `${path}: ${first.message}` : first.message) : 'Invalid request'
    return errorResponse(400, 'VALIDATION_ERROR', message, err.flatten())
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? []
      const fields = (Array.isArray(target) ? target : [target])
        .filter((f) => f !== 'organizationId')
        .map((f) => FIELD_LABELS[f] ?? f)
      const what = fields.length ? `this ${fields.join(' / ')}` : 'these details'
      return errorResponse(409, 'DUPLICATE', `A record with ${what} already exists`)
    }
    if (err.code === 'P2025') return errorResponse(404, 'NOT_FOUND', 'Resource not found')
    if (err.code === 'P2003') {
      return errorResponse(409, 'IN_USE', 'This record is referenced by other data and cannot be changed or removed')
    }
  }

  if (err instanceof SyntaxError) return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON')

  console.error('[api] Unhandled error', err)
  return errorResponse(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')
}

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response>

/** Wraps a route handler with uniform error handling and resolves Next 15's async `params`. */
export function apiHandler<P extends Record<string, string> = Record<string, never>>(fn: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P)
      return await fn(req, { params })
    } catch (err) {
      return toErrorResponse(err)
    }
  }
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const raw = await req.text()
  return schema.parse(raw ? JSON.parse(raw) : {})
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): T {
  const query: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((value, key) => {
    if (value !== '') query[key] = value
  })
  return schema.parse(query)
}
