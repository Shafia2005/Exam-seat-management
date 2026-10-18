'use client'

import { useState } from 'react'
import { Building2, DoorOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { seatService } from '@/modules/seats'
import { errorMessage } from '@/lib/api-client'
import { confirmAction } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import type { Block, Room } from '@/types/seat.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardToolbar } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { Alert, EmptyState, Skeleton } from '@/components/ui/misc'
import { Switch } from '@/components/ui/switch'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useList } from './use-list'

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

export function BlocksTab() {
  const { items, loading, error, reload } = useList(() => seatService.getBlocks(true))
  const [editing, setEditing] = useState<Block | null | undefined>(undefined)
  const [form, setForm] = useState({ name: '', code: '', buildingName: '', floor: 0 })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const open = (b: Block | null) => {
    setForm({ name: b?.name ?? '', code: b?.code ?? '', buildingName: b?.buildingName ?? '', floor: b?.floor ?? 0 })
    setFormError('')
    setEditing(b)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const data = { ...form, floor: Number(form.floor) }
      if (editing) await seatService.updateBlock(editing.id, data)
      else await seatService.createBlock(data)
      toast.success(editing ? 'Block updated' : 'Block added', form.name)
      setEditing(undefined)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the block.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (b: Block) => {
    try {
      await seatService.updateBlock(b.id, { isActive: !b.isActive })
      await reload()
    } catch (err) {
      toast.error('Could not update the block', errorMessage(err, ''))
    }
  }

  const remove = async (b: Block) => {
    if (!(await confirmAction({ title: `Delete block “${b.name}”?`, confirmLabel: 'Delete block', destructive: true }))) return
    try {
      await seatService.deleteBlock(b.id)
      toast.success('Block deleted', b.name)
      await reload()
    } catch (err) {
      toast.error('Could not delete the block', errorMessage(err, ''))
    }
  }

  return (
    <Card>
      <CardToolbar
        title="Blocks"
        description="Buildings or wings that contain exam rooms."
        actions={
          <Button onClick={() => open(null)}>
            <Plus /> Add block
          </Button>
        }
      />
      {error && (
        <CardContent>
          <Alert tone="danger">{error}</Alert>
        </CardContent>
      )}
      {loading ? (
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      ) : items.length === 0 ? (
        <CardContent>
          <EmptyState icon={<Building2 />} title="No blocks yet" description="Add a block, then create rooms inside it." />
        </CardContent>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Block</TH>
              <TH>Code</TH>
              <TH>Building</TH>
              <TH className="text-right">Floor</TH>
              <TH className="text-right">Rooms</TH>
              <TH>Active</TH>
              <TH className="w-12" />
            </tr>
          </THead>
          <TBody>
            {items.map((b) => (
              <TR key={b.id}>
                <TD className="font-medium">{b.name}</TD>
                <TD className="font-mono text-xs">{b.code}</TD>
                <TD className="text-muted-foreground">{b.buildingName || '—'}</TD>
                <TD className="text-right tabular-nums">{b.floor}</TD>
                <TD className="text-right tabular-nums">{b.roomCount ?? 0}</TD>
                <TD>
                  <Switch checked={b.isActive} onCheckedChange={() => toggleActive(b)} aria-label={`${b.name} active`} />
                </TD>
                <TD>
                  <RowActions label={b.name} onEdit={() => open(b)} onDelete={() => remove(b)} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent size="sm">
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <DialogHeader icon={<Building2 />} title={editing ? 'Edit block' : 'Add block'} />
            <DialogBody className="space-y-4">
              {formError && <Alert tone="danger">{formError}</Alert>}
              <Field label="Name" htmlFor="block-name" required>
                <Input id="block-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Computer Science Block" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code" htmlFor="block-code" required>
                  <Input id="block-code" required maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Floor" htmlFor="block-floor">
                  <Input id="block-floor" type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Building" htmlFor="block-building">
                <Input id="block-building" value={form.buildingName} onChange={(e) => setForm({ ...form, buildingName: e.target.value })} placeholder="Main Building" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Save changes' : 'Add block'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ─── Rooms ──────────────────────────────────────────────────────────────────

interface RoomForm {
  blockId: string
  name: string
  number: string
  floor: string
  rows: number
  columns: number
  seatsPerBench: number
  isAvailable: boolean
}

export function RoomsTab() {
  const { items, loading, error, reload } = useList(() => seatService.getRooms(undefined, true))
  const blocks = useList(() => seatService.getBlocks(true))
  const [blockFilter, setBlockFilter] = useState('')
  const [editing, setEditing] = useState<Room | null | undefined>(undefined)
  const [form, setForm] = useState<RoomForm>({ blockId: '', name: '', number: '', floor: '', rows: 6, columns: 10, seatsPerBench: 1, isAvailable: true })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const rooms = blockFilter ? items.filter((r) => r.blockId === blockFilter) : items

  const open = (r: Room | null) => {
    setForm({
      blockId: r?.blockId || blockFilter || blocks.items[0]?.id || '',
      name: r?.name ?? '',
      number: r?.number ?? '',
      floor: r?.floor !== undefined ? String(r.floor) : '',
      rows: r?.rows ?? 6,
      columns: r?.columns ?? 10,
      seatsPerBench: 1,
      isAvailable: r?.isAvailable ?? true,
    })
    setFormError('')
    setEditing(r)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const floor = form.floor === '' ? null : Number(form.floor)
    try {
      if (editing) {
        await seatService.updateRoom(editing.id, { blockId: form.blockId, name: form.name, number: form.number, floor, isAvailable: form.isAvailable })
      } else {
        await seatService.createRoom({
          blockId: form.blockId,
          name: form.name,
          number: form.number,
          floor,
          rows: Number(form.rows),
          columns: Number(form.columns),
          seatsPerBench: Number(form.seatsPerBench),
          isAvailable: form.isAvailable,
        })
      }
      toast.success(editing ? 'Room updated' : 'Room created', editing ? form.name : `${form.name} · ${form.rows * form.columns * form.seatsPerBench} seats`)
      setEditing(undefined)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the room.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailable = async (r: Room) => {
    try {
      await seatService.updateRoom(r.id, { isAvailable: !r.isAvailable })
      await reload()
    } catch (err) {
      toast.error('Could not update the room', errorMessage(err, ''))
    }
  }

  const remove = async (r: Room) => {
    const ok = await confirmAction({
      title: `Delete room “${r.name}”?`,
      description: 'Its benches are deleted too. Rooms used by exam seating or duties cannot be deleted — mark them unavailable instead.',
      confirmLabel: 'Delete room',
      destructive: true,
    })
    if (!ok) return
    try {
      await seatService.deleteRoom(r.id)
      toast.success('Room deleted', r.name)
      await reload()
    } catch (err) {
      toast.error('Could not delete the room', errorMessage(err, ''))
    }
  }

  return (
    <Card>
      <CardToolbar
        title="Exam rooms"
        description={`${items.length} rooms · ${items.filter((r) => r.isAvailable).reduce((s, r) => s + r.capacity, 0)} seats available for allocation`}
        actions={
          <>
            <Select aria-label="Filter by block" className="w-48" value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
              <option value="">All blocks</option>
              {blocks.items.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Button onClick={() => open(null)} disabled={blocks.items.length === 0}>
              <Plus /> Add room
            </Button>
          </>
        }
      />
      {error && (
        <CardContent>
          <Alert tone="danger">{error}</Alert>
        </CardContent>
      )}
      {loading ? (
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      ) : rooms.length === 0 ? (
        <CardContent>
          <EmptyState
            icon={<DoorOpen />}
            title="No rooms yet"
            description={blocks.items.length ? 'Create a room and its bench layout is generated automatically.' : 'Add a block first.'}
          />
        </CardContent>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Room</TH>
              <TH>Block</TH>
              <TH>Layout</TH>
              <TH className="text-right">Seats</TH>
              <TH>Available</TH>
              <TH className="w-12" />
            </tr>
          </THead>
          <TBody>
            {rooms.map((r) => (
              <TR key={r.id}>
                <TD>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    No. {r.number}
                    {r.floor !== undefined && ` · Floor ${r.floor}`}
                  </p>
                </TD>
                <TD className="text-muted-foreground">{r.blockName}</TD>
                <TD>
                  <Badge variant="secondary">
                    {r.rows} × {r.columns}
                  </Badge>
                </TD>
                <TD className="text-right tabular-nums">{r.capacity}</TD>
                <TD>
                  <Switch checked={r.isAvailable} onCheckedChange={() => toggleAvailable(r)} aria-label={`${r.name} available`} />
                </TD>
                <TD>
                  <RowActions label={r.name} onEdit={() => open(r)} onDelete={() => remove(r)} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent size="md">
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <DialogHeader
              icon={<DoorOpen />}
              title={editing ? 'Edit room' : 'Add room'}
              description={editing ? 'The bench layout is fixed once created; recreate the room to change it.' : 'Benches are generated from the layout.'}
            />
            <DialogBody className="space-y-4">
              {formError && <Alert tone="danger">{formError}</Alert>}
              <Field label="Block" htmlFor="room-block" required>
                <Select id="room-block" required value={form.blockId} onChange={(e) => setForm({ ...form, blockId: e.target.value })}>
                  {blocks.items.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Name" htmlFor="room-name" required className="col-span-3 sm:col-span-1">
                  <Input id="room-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CS-104" />
                </Field>
                <Field label="Number" htmlFor="room-number" required>
                  <Input id="room-number" required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="104" />
                </Field>
                <Field label="Floor" htmlFor="room-floor">
                  <Input id="room-floor" type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                </Field>
              </div>
              {!editing && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Rows" htmlFor="room-rows" required>
                      <Input id="room-rows" type="number" min={1} max={50} required value={form.rows} onChange={(e) => setForm({ ...form, rows: Number(e.target.value) })} />
                    </Field>
                    <Field label="Columns" htmlFor="room-cols" required>
                      <Input id="room-cols" type="number" min={1} max={50} required value={form.columns} onChange={(e) => setForm({ ...form, columns: Number(e.target.value) })} />
                    </Field>
                    <Field label="Seats / bench" htmlFor="room-spb">
                      <Select id="room-spb" value={form.seatsPerBench} onChange={(e) => setForm({ ...form, seatsPerBench: Number(e.target.value) })}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </Select>
                    </Field>
                  </div>
                  <p className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
                    Capacity: <span className="font-semibold text-foreground">{form.rows * form.columns * form.seatsPerBench}</span> seats on{' '}
                    {form.rows * form.columns} benches
                  </p>
                </>
              )}
              <label className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">Available for exams</span>
                  <span className="text-xs text-muted-foreground">Unavailable rooms are skipped by seat allocation.</span>
                </span>
                <Switch checked={form.isAvailable} onCheckedChange={(v) => setForm({ ...form, isAvailable: v })} aria-label="Available for exams" />
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Save changes' : 'Create room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
