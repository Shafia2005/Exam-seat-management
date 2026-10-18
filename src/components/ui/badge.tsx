import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium capitalize transition-colors [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary dark:bg-primary/15',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-muted-foreground',
        success: 'border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        warning: 'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400',
        danger: 'border-transparent bg-red-500/10 text-red-700 dark:text-red-400',
        info: 'border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400',
        violet: 'border-transparent bg-violet-500/10 text-violet-700 dark:text-violet-400',
        pink: 'border-transparent bg-pink-500/10 text-pink-700 dark:text-pink-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
