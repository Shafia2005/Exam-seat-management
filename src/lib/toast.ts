import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  variant: ToastVariant
  title: string
  description?: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (toast: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++
    set({ toasts: [...get().toasts.slice(-3), { ...toast, id }] })
    setTimeout(() => get().dismiss(id), toast.variant === 'error' ? 7000 : 4000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

/** Shows a transient notification (rendered by <Toaster /> in the root layout). */
export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ variant: 'success', title, description }),
  error: (title: string, description?: string) => useToastStore.getState().push({ variant: 'error', title, description }),
  info: (title: string, description?: string) => useToastStore.getState().push({ variant: 'info', title, description }),
}
