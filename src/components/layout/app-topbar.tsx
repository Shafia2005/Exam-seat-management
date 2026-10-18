'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown, GraduationCap, KeyRound, LogOut, Menu, Shield, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_DISPLAY_NAME, ROLE_HOME } from '@/lib/auth/roles'
import { useAuthStore } from '@/store/auth.store'
import { useRole } from '@/hooks/useRole'
import { authService, isDemoOrganization, type DemoRole } from '@/services/auth.service'
import { errorMessage } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/misc'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/theme'
import { ChangePasswordDialog } from './change-password-dialog'
import { pageTitle } from './nav-config'

const DEMO_ROLES: { role: DemoRole; label: string; Icon: typeof Shield }[] = [
  { role: 'admin', label: 'Admin', Icon: Shield },
  { role: 'teacher', label: 'Teacher', Icon: UserCheck },
  { role: 'student', label: 'Student', Icon: GraduationCap },
]

/**
 * Demo mode only, and only inside the demo organization: signs in as the
 * seeded account for each role through the real API. Real institutions never see it.
 */
function DemoRoleSwitcher() {
  const { role, isAdmin } = useRole()
  const [switching, setSwitching] = useState<DemoRole | null>(null)
  const current: DemoRole = isAdmin ? 'admin' : role === 'TEACHER' ? 'teacher' : 'student'

  const switchTo = async (target: DemoRole) => {
    if (target === current) return
    setSwitching(target)
    try {
      const res = await authService.signInAs(target)
      // Full page load so no previous session's data stays in memory.
      window.location.assign(ROLE_HOME[res.user.role ?? 'STUDENT'])
    } catch (err) {
      toast.error('Could not switch role', errorMessage(err, 'Demo accounts may not exist in this organization.'))
      setSwitching(null)
    }
  }

  return (
    <div className="hidden items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5 md:flex" role="group" aria-label="Demo role switcher">
      <span className="px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Demo</span>
      {DEMO_ROLES.map(({ role: r, label, Icon }) => (
        <button
          key={r}
          type="button"
          onClick={() => switchTo(r)}
          disabled={!!switching}
          aria-pressed={current === r}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-60',
            current === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className={cn('size-3.5', switching === r && 'animate-pulse')} />
          {label}
        </button>
      ))}
    </div>
  )
}

function UserMenu() {
  const user = useAuthStore((s) => s.user)
  const { role } = useRole()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const name = user ? `${user.firstName} ${user.lastName}` : 'User'

  const signOut = async () => {
    try {
      await authService.logout()
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar name={name} size="sm" />
            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block max-w-[10rem] truncate text-sm font-medium">{name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_DISPLAY_NAME[role]}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <div className="flex items-center gap-3 px-2 py-2.5">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              <Badge variant="default" className="mt-1 normal-case">
                {ROLE_DISPLAY_NAME[role]}
              </Badge>
            </div>
          </div>
          {(user?.employeeId || user?.rollNumber) && (
            <p className="px-2 pb-2 text-xs text-muted-foreground">
              {user.employeeId ? `Employee ID ${user.employeeId}` : `Roll No. ${user.rollNumber}`}
              {user.departmentName && ` · ${user.departmentName}`}
            </p>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound /> Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={signOut}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  )
}

export function AppTopbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname()
  const organization = useAuthStore((s) => s.organization)
  const title = pageTitle(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6 print:hidden">
      <Button variant="ghost" size="icon" className="-ml-1 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="hidden truncate text-muted-foreground sm:inline">{organization?.name}</span>
        {title && (
          <>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            <span className="truncate font-medium">{title}</span>
          </>
        )}
      </nav>
      {isDemoOrganization(organization?.slug) && <DemoRoleSwitcher />}
      <ThemeToggle />
      <UserMenu />
    </header>
  )
}
