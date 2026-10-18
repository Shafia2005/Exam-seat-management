'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export const TooltipProvider = TooltipPrimitive.Provider

/** Wraps a single focusable child with a small hover/focus label. Renders the child alone when `content` is empty. */
export function Tooltip({
  content,
  side = 'top',
  children,
}: {
  content?: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactElement
}) {
  if (!content) return children
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
