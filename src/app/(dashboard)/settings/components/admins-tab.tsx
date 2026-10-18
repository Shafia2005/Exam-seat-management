'use client'

import { useState } from 'react'
import { KeyRound, MoreHorizontal, Pencil, Power, ShieldCheck, UserPlus } from 'lucide-react'
import { adminService, type AdminUser } from '@/modules/admin'
import { useAuthStore } from '@/store/auth.store'
import { useRole } from '@/hooks/useRole'
import { errorMessage } from '@/lib/api-client'
import { confirmAction } from '@/lib/confirm'
import { formatDay } from '@/lib/format'
import { toast } from '@/lib/toast'
import { ResetPasswordDialog } from '@/components/reset-password-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardToolbar } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, Input, Select } from '@/components/ui/input'
import { Alert, Avatar, EmptyState, Skeleton } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { useList } from './use-list'

const ROLE_LABEL: Record<AdminUser['role'], string> = { SUPER_ADMIN: 'Super administrator', ADMIN: 'Administrator' }

type FormState = { firstName: string; lastName: string; email: string; role: AdminUser['role'] }
const EMPTY: FormState = { firstName: '', lastName: '', email: '', role: 'ADMIN' }

export function AdminsTab() {
  const { role } = useRole()
  const me = useAuthStore((s) => s.user?.id)
  const superAdmin = role === 'SUPER_ADMIN'
  const { items, loading, error, reload } = useList(() => adminService.list())

  const [editing, setEditing] = useState<AdminUser | null | undefined>(undefined)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [created, setCreated] = useState<{ name: string; password: string } | null>(null)
  const [resetFor, setResetFor] = useState<AdminUser | null>(null)

  const open = (admin: AdminUser | null) => {
    setForm(admin ? { firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role } : EMPTY)
    setFormError('')
    setEditing(admin)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (editing) {
        await adminService.update(editing.id, { firstName: form.firstName, lastName: form.lastName, role: form.role })
        toast.success('Administrator updated', `${form.firstName} ${form.lastName}`)
      } else {
        const { admin, temporaryPassword } = await adminService.create(form)
        if (temporaryPassword) setCreated({ name: `${admin.firstName} ${admin.lastName}`, password: temporaryPassword })
        else toast.success('Administrator added', admin.email)
      }
      setEditing(undefined)
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the administrator.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (admin: AdminUser) => {
    const deactivate = admin.isActive
    const ok = await confirmAction({
      title: `${deactivate ? 'Deactivate' : 'Reactivate'} ${admin.firstName} ${admin.lastName}?`,
      description: deactivate ? 'They are signed out immediately and cannot sign in until reactivated.' : 'They can sign in again with their existing password.',
      confirmLabel: deactivate ? 'Deactivate' : 'Reactivate',
      destructive: deactivate,
    })
    if (!ok) return
    try {
      await adminService.update(admin.id, { isActive: !admin.isActive })
      toast.success(deactivate ? 'Administrator deactivated' : 'Administrator reactivated', admin.email)
      await reload()
    } catch (err) {
      toast.error('Could not update the administrator', errorMessage(err, ''))
    }
  }

  return (
    <Card>
      <CardToolbar
        title="Administrators"
        description="People who can manage students, exams, seating and settings."
        actions={
          superAdmin && (
            <Button onClick={() => open(null)}>
              <UserPlus /> Add administrator
            </Button>
          )
        }
      />
      {!superAdmin && (
        <div className="px-5 pb-4">
          <Alert tone="info">Only a super administrator can add administrators or change their access.</Alert>
        </div>
      )}
      {error && (
        <div className="px-5 pb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {loading ? (
        <div className="p-5 pt-0">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-5 pt-0">
          <EmptyState icon={<ShieldCheck />} title="No administrators" />
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Last sign-in</TH>
              <TH className="w-12" />
            </tr>
          </THead>
          <TBody>
            {items.map((a) => (
              <TR key={a.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={`${a.firstName} ${a.lastName}`} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {a.firstName} {a.lastName} {a.id === me && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <Badge variant={a.role === 'SUPER_ADMIN' ? 'violet' : 'info'} className="normal-case">
                    {ROLE_LABEL[a.role]}
                  </Badge>
                </TD>
                <TD>
                  <Badge variant={a.isActive ? 'success' : 'secondary'} dot>
                    {a.isActive ? 'Active' : 'Deactivated'}
                  </Badge>
                </TD>
                <TD className="text-muted-foreground">{a.lastLogin ? formatDay(a.lastLogin.slice(0, 10)) : 'Never'}</TD>
                <TD>
                  {superAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.firstName} ${a.lastName}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => open(a)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        {a.id !== me && (
                          <>
                            <DropdownMenuItem onSelect={() => setResetFor(a)}>
                              <KeyRound /> Reset password
                            </DropdownMenuItem>
                            <DropdownMenuItem destructive={a.isActive} onSelect={() => toggleActive(a)}>
                              <Power /> {a.isActive ? 'Deactivate' : 'Reactivate'}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent size="sm">
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <DialogHeader
              icon={<ShieldCheck />}
              title={editing ? 'Edit administrator' : 'Add administrator'}
              description={editing ? editing.email : 'A temporary password is generated; share it securely.'}
            />
            <DialogBody className="space-y-4">
              {formError && <Alert tone="danger">{formError}</Alert>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="adm-first" required>
                  <Input id="adm-first" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </Field>
                <Field label="Last name" htmlFor="adm-last" required>
                  <Input id="adm-last" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </Field>
              </div>
              {!editing && (
                <Field label="Email" htmlFor="adm-email" required>
                  <Input id="adm-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              )}
              <Field
                label="Role"
                htmlFor="adm-role"
                hint="Super administrators can also manage other administrators."
              >
                <Select
                  id="adm-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AdminUser['role'] })}
                  disabled={editing?.id === me}
                >
                  <option value="ADMIN">Administrator</option>
                  <option value="SUPER_ADMIN">Super administrator</option>
                </Select>
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Save changes' : 'Add administrator'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent size="sm">
          <DialogHeader icon={<KeyRound />} title="Administrator added" description={`Share this temporary password securely with ${created?.name}.`} />
          <DialogBody className="space-y-4">
            <code className="block select-all break-all rounded-lg border bg-muted/50 p-3 font-mono text-base font-semibold">{created?.password}</code>
            <Alert tone="warning">This password is shown only once. They can change it after signing in.</Alert>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog
        open={!!resetFor}
        onOpenChange={(o) => !o && setResetFor(null)}
        name={resetFor ? `${resetFor.firstName} ${resetFor.lastName}` : ''}
        onReset={(password) => adminService.resetPassword(resetFor!.id, password)}
      />
    </Card>
  )
}
