'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { authService } from '@/services/auth.service'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { LogoMark } from '@/components/layout/logo'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Persisted stores rehydrate on the client only; render the same loading state
  // on the server and the first client pass to avoid hydration mismatches.
  useEffect(() => setMounted(true), [])

  // Middleware has already verified the session cookie; refresh the profile so
  // role or organization changes apply. A 401 here sends the user back to login.
  useEffect(() => {
    authService
      .me()
      .catch(() => {
        if (!useAuthStore.getState().isAuthenticated) router.push('/login')
      })
      .finally(() => setSessionChecked(true))
  }, [router])

  useEffect(() => setMobileOpen(false), [pathname])

  if (!mounted || isLoading || (!isAuthenticated && !sessionChecked)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface">
        <LogoMark className="size-11 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200 print:!pl-0', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <AppTopbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}
