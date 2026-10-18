import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  open: (options: ConfirmOptions) => Promise<boolean>
  settle: (ok: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      get().request?.resolve(false)
      set({ request: { ...options, resolve } })
    }),
  settle: (ok) => {
    get().request?.resolve(ok)
    set({ request: null })
  },
}))

/** Asks the user to confirm an action in a modal (rendered by <ConfirmDialogHost />). */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(options)
}
