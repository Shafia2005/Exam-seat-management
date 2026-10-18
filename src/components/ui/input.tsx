import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Form controls tolerate attributes injected by autofill/password extensions
// (e.g. `fdprocessedid`) before React hydrates, via `suppressHydrationWarning`.
const controlBase =
  'flex w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered inside the field on the left. */
  icon?: React.ReactNode
  /** Element rendered inside the field on the right (e.g. a show-password toggle). */
  trailing?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, icon, trailing, ...props }, ref) => {
  if (!icon && !trailing) {
    return <input ref={ref} className={cn(controlBase, 'h-9 py-1', className)} suppressHydrationWarning {...props} />
  }
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(controlBase, 'h-9 py-1', icon && 'pl-9', trailing && 'pr-10', className)}
        suppressHydrationWarning
        {...props}
      />
      {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  )
})
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlBase, 'min-h-[80px] py-2', className)} suppressHydrationWarning {...props} />
  )
)
Textarea.displayName = 'Textarea'

/** Native select styled to match the inputs (keyboard and mobile friendly). */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, 'h-9 cursor-pointer appearance-none py-1 pr-9', className)} suppressHydrationWarning {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
)
Select.displayName = 'Select'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium leading-none text-foreground', className)} {...props} />
}

/** Label + control + optional hint, laid out consistently. */
export function Field({
  label,
  htmlFor,
  hint,
  required,
  className,
  children,
}: {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
