'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Allocation, Bench, Room } from '@/types/seat.types'
import { Select } from '@/components/ui/input'

/** Department colours, assigned in order of first appearance. */
export const DEPT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#f43f5e', '#8b5cf6', '#14b8a6', '#ec4899']

interface SeatMapProps {
  rooms: Room[]
  benches: Bench[]
  allocations: Allocation[]
  selectedRoomId?: string
  onRoomChange?: (roomId: string) => void
}

export default function SeatMap({ rooms, benches, allocations, selectedRoomId, onRoomChange }: SeatMapProps) {
  const room = rooms.find((r) => r.id === selectedRoomId) || rooms[0]

  const deptColor = useMemo(() => {
    const map = new Map<string, { color: string; name: string }>()
    allocations.forEach((a) => {
      const key = a.departmentId || 'unknown'
      if (!map.has(key)) map.set(key, { color: DEPT_COLORS[map.size % DEPT_COLORS.length], name: a.departmentName || 'Unknown' })
    })
    return map
  }, [allocations])

  const allocationByBench = useMemo(() => new Map(allocations.map((a) => [a.benchId, a])), [allocations])

  if (!room) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No rooms available for the seat map.</p>
  }

  const roomBenches = benches.filter((b) => b.roomId === room.id)
  const roomAllocations = allocations.filter((a) => a.roomId === room.id)
  const rows = Math.max(room.rows || 1, ...roomBenches.map((b) => b.row))
  const cols = Math.max(room.columns || 1, ...roomBenches.map((b) => b.column))
  const grid: (Bench | null)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))
  roomBenches.forEach((b) => {
    if (b.row >= 1 && b.column >= 1) grid[b.row - 1][b.column - 1] = b
  })

  const deptCounts = new Map<string, number>()
  roomAllocations.forEach((a) => deptCounts.set(a.departmentId || 'unknown', (deptCounts.get(a.departmentId || 'unknown') ?? 0) + 1))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">
            {room.name} <span className="font-normal text-muted-foreground">· {room.blockName}</span>
          </h4>
          <p className="text-sm text-muted-foreground">
            {roomAllocations.length} of {room.capacity} seats filled · coloured by department
          </p>
        </div>
        {rooms.length > 1 && (
          <Select aria-label="Room" className="w-48" value={room.id} onChange={(e) => onRoomChange?.(e.target.value)}>
            {rooms.map((r) => {
              const n = allocations.filter((a) => a.roomId === r.id).length
              return (
                <option key={r.id} value={r.id}>
                  {r.name} ({n})
                </option>
              )
            })}
          </Select>
        )}
      </div>

      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className="mx-auto w-max min-w-full space-y-2">
          <div className="mx-auto rounded-md bg-muted py-1.5 text-center text-[0.65rem] font-semibold tracking-[0.35em] text-muted-foreground">
            FRONT · BOARD
          </div>
          {grid.map((row, r) => (
            <div key={r} className="flex items-center justify-center gap-1.5">
              <span className="w-6 shrink-0 text-right text-[0.65rem] font-medium text-muted-foreground">{String.fromCharCode(65 + (r % 26))}</span>
              {row.map((bench, c) => {
                if (!bench) return <div key={`${r}-${c}`} className="h-14 w-16 shrink-0" />
                const alloc = allocationByBench.get(bench.id)
                const color = alloc ? deptColor.get(alloc.departmentId || 'unknown')?.color : undefined
                return (
                  <div
                    key={bench.id}
                    title={alloc ? `${alloc.studentRollNumber} — ${alloc.studentName} (${alloc.departmentName ?? 'Dept'}) · Seat ${alloc.seatLabel ?? ''}` : `Empty · ${bench.number}`}
                    className={cn(
                      'flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg px-1 text-center transition-transform hover:-translate-y-0.5',
                      alloc ? 'border-2' : 'border border-dashed bg-muted/30'
                    )}
                    style={alloc && color ? { borderColor: color, backgroundColor: `${color}1a` } : undefined}
                  >
                    {alloc ? (
                      <>
                        <span className="w-full truncate font-mono text-[0.6rem] font-bold leading-tight" style={{ color }}>
                          {alloc.studentRollNumber}
                        </span>
                        <span className="mt-0.5 w-full truncate text-[0.6rem] text-muted-foreground">{alloc.studentName?.split(' ')[0]}</span>
                      </>
                    ) : (
                      <span className="text-[0.65rem] text-muted-foreground/70">{c + 1}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {deptColor.size > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs">
          {Array.from(deptColor.entries()).map(([id, { color, name }]) => (
            <span key={id} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
              {name} <span className="text-muted-foreground">({deptCounts.get(id) ?? 0})</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm border border-dashed border-muted-foreground/50" /> Empty
          </span>
        </div>
      )}
    </div>
  )
}
