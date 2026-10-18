// Browser client for the `/api` route handlers. The session travels in an
// HttpOnly cookie, so requests only need to be same-origin.

import { useAuthStore } from '@/store/auth.store'

export interface ApiMeta {
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  timestamp: string
  requestId: string
  [key: string]: unknown
}

export interface ApiEnvelope<T> {
  success: true
  data: T
  meta: ApiMeta
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/** Query parameters; `undefined`, `null` and empty-string values are omitted. */
export type Query = object

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    })
  }
  const qs = params.toString()
  return `/api${path}${qs ? `?${qs}` : ''}`
}

/** Session expired or revoked: clear local auth state and send the user to sign in again. */
function handleUnauthorized() {
  if (typeof window === 'undefined') return
  useAuthStore.getState().logout()
  const { pathname, search } = window.location
  if (!pathname.startsWith('/login')) {
    window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`)
  }
}

async function request<T>(method: string, path: string, options: { query?: Query; body?: unknown } = {}): Promise<ApiEnvelope<T>> {
  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  })

  let payload: { success?: boolean; error?: { code?: string; message?: string; details?: unknown } } | null = null
  try {
    payload = await res.json()
  } catch {
    // Non-JSON body (e.g. a proxy error page); handled below.
  }

  if (!res.ok || !payload || payload.success === false) {
    if (res.status === 401 && !path.startsWith('/auth/')) handleUnauthorized()
    throw new ApiClientError(
      res.status,
      payload?.error?.code ?? 'HTTP_ERROR',
      payload?.error?.message ?? `Request failed (${res.status})`,
      payload?.error?.details
    )
  }
  return payload as ApiEnvelope<T>
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>('POST', path, { body: body ?? {}, query }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string, query?: Query) => request<T>('DELETE', path, { query }),
}

/** Extracts a user-facing message from any thrown value. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
