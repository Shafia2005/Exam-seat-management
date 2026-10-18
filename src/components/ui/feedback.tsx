'use client'

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToastStore, type ToastVariant } from '@/lib/toast'
import { useConfirmStore } from '@/lib/confirm'
import { Button } from './button'
import { Dialog, DialogContent, DialogFooter } from './dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'

const TOAST_ICON: Record<ToastVariant, { Icon: typeof Info; cls: string }> = {
  success: { Icon: CheckCircle2, cls: 'text-emerald-500' },
  error: { Icon: AlertCircle, cls: 'text-destructive' },
  info: { Icon: Info, cls: 'text-sky-500' },
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 print:hidden"
    >
      {toasts.map((t) => {
        const { Icon, cls } = TOAST_ICON[t.variant]
        return (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', cls)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 break-words text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function ConfirmDialogHost() {
  const { request, settle } = useConfirmStore()
  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && settle(false)}>
      <DialogContent size="sm" hideClose>
        {request && (
          <>
            <div className="flex items-start gap-4 px-6 pb-4 pt-6">
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full',
                  request.destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                )}
              >
                {request.destructive ? <AlertTriangle className="size-5" /> : <Info className="size-5" />}
              </div>
              <div className="space-y-1.5">
                <DialogPrimitive.Title className="font-semibold leading-tight">{request.title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {request.description || 'Please confirm to continue.'}
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => settle(false)}>
                {request.cancelLabel || 'Cancel'}
              </Button>
              <Button variant={request.destructive ? 'destructive' : 'default'} onClick={() => settle(true)} autoFocus>
                {request.confirmLabel || 'Confirm'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
