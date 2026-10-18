'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/input'

/** Password field with a show/hide toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing'>>((props, ref) => {
  const [visible, setVisible] = React.useState(false)
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  )
})
PasswordInput.displayName = 'PasswordInput'
