'use client'

import { useEffect } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useUIStore } from '@/store/ui.store'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

/**
 * Runs before React hydrates (inlined in <head>) so the saved theme applies
 * without a light-mode flash. Reads the persisted `ui-storage` Zustand state.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('ui-storage')||'{}');var t=(s.state&&s.state.theme)||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

/** Keeps the `dark` class in sync with the stored preference and, in "system" mode, with the OS. */
export function ThemeSync() {
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return null
}

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore()
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[9rem]">
        <DropdownMenuItem onSelect={() => setTheme('light')}>
          <Sun /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('dark')}>
          <Moon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('system')}>
          <Monitor /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
