'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { useRole } from '@/hooks/useRole'
import { Tooltip } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Logo, LogoMark } from './logo'
import { isActivePath, navForRole } from './nav-config'

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { role, isAdmin } = useRole()
  const groups = navForRole(role)

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-thin" aria-label="Main">
      {groups.map((group) => (
        <div key={group.label}>
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-border first:hidden" />
          ) : (
            <p className="mb-1.5 px-2.5 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground/70">
              {isAdmin && group.adminLabel ? group.adminLabel : group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href)
              return (
                <li key={item.href}>
                  <Tooltip content={collapsed ? item.label : undefined} side="right">
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        collapsed && 'justify-center px-0'
                      )}
                    >
                      {active && !collapsed && (
                        <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <item.icon className="size-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </Tooltip>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const organization = useAuthStore((s) => s.organization)
  const { sidebarCollapsed: collapsed, toggleSidebarCollapsed } = useUIStore()

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-card transition-[width] duration-200 lg:flex print:hidden',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center border-b', collapsed ? 'justify-center' : 'px-5')}>
          {collapsed ? <LogoMark /> : <Logo subtitle={organization?.name} />}
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className={cn('border-t p-3', collapsed && 'flex justify-center')}>
          <Tooltip content={collapsed ? 'Expand sidebar' : undefined} side="right">
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              onClick={toggleSidebarCollapsed}
              className={cn('text-muted-foreground', !collapsed && 'w-full justify-start')}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              {!collapsed && 'Collapse'}
            </Button>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in-0" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r bg-card shadow-elevated animate-in slide-in-from-left duration-200">
            <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
              <Logo subtitle={organization?.name} />
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close menu">
                <X />
              </Button>
            </div>
            <SidebarNav collapsed={false} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}
