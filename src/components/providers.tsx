'use client'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfirmDialogHost, Toaster } from '@/components/ui/feedback'
import { ThemeSync } from '@/components/theme'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ThemeSync />
      {children}
      <Toaster />
      <ConfirmDialogHost />
    </TooltipProvider>
  )
}
