'use client'

import { useEffect, useState } from 'react'
import { History, Search } from 'lucide-react'
import { auditService, type AuditLogEntry } from '@/modules/admin'
import { errorMessage } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Alert, Avatar, EmptyState, PageHeader, Pagination, Skeleton } from '@/components/ui/misc'

const ENTITY_TYPES = [
  ['', 'Everything'],
  ['exam', 'Exams, seating & attendance'],
  ['student', 'Students'],
  ['teacher', 'Teachers'],
  ['user', 'Accounts & passwords'],
  ['organization', 'Settings'],
  ['department', 'Departments'],
  ['course', 'Courses'],
  ['block', 'Blocks'],
  ['room', 'Rooms'],
] as const

const ENTITY_BADGE: Record<string, 'info' | 'violet' | 'success' | 'warning' | 'secondary' | 'pink'> = {
  exam: 'info',
  student: 'success',
  teacher: 'violet',
  user: 'warning',
  organization: 'pink',
}

const LIMIT = 25

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Change history: who did what, newest first. */
export default function ActivityPage() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setQuery(search.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setEntries(null)
    auditService
      .list({ page, limit: LIMIT, entityType: entityType || undefined, search: query || undefined })
      .then((res) => {
        setEntries(res.rows)
        setTotal(res.total)
        setTotalPages(res.totalPages)
        setError('')
      })
      .catch((err) => setError(errorMessage(err, 'Could not load the activity log.')))
  }, [page, entityType, query])

  return (
    <div>
      <PageHeader title="Activity" description="Every change made in your institution — who did it and when." />
      <Card>
        <CardToolbar
          title="Change history"
          description={`${total} entr${total === 1 ? 'y' : 'ies'}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <div className="w-60">
                <Input icon={<Search />} placeholder="Search person or change…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search activity" />
              </div>
              <Select
                aria-label="Type"
                value={entityType}
                onChange={(e) => {
                  setPage(1)
                  setEntityType(e.target.value)
                }}
                className="w-56"
              >
                {ENTITY_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {error ? (
          <CardContent>
            <Alert tone="danger">{error}</Alert>
          </CardContent>
        ) : !entries ? (
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        ) : entries.length === 0 ? (
          <CardContent>
            <EmptyState icon={<History />} title="No activity yet" description="Changes to students, exams, seating and settings will appear here." />
          </CardContent>
        ) : (
          <>
            <ol className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3.5">
                  <Avatar name={e.actorName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{e.actorName}</span> <span className="text-muted-foreground">·</span> {e.summary}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground" title={new Date(e.createdAt).toLocaleString()}>
                      {relativeTime(e.createdAt)} · <span className="font-mono">{e.action}</span>
                    </p>
                  </div>
                  <Badge variant={ENTITY_BADGE[e.entityType] ?? 'secondary'}>{e.entityType}</Badge>
                </li>
              ))}
            </ol>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} noun="entries" onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
