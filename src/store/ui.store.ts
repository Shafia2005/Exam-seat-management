import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system'
  
  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  
  // Notifications
  unreadNotificationsCount: number
  
  // Loading states
  globalLoading: boolean
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  setUnreadNotificationsCount: (count: number) => void
  setGlobalLoading: (loading: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarOpen: true,
      sidebarCollapsed: false,
      unreadNotificationsCount: 0,
      globalLoading: false,

      setTheme: (theme) => {
        set({ theme })
        // Apply theme to document
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },

      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light'
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          return { theme: newTheme }
        })
      },

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),
      
      setGlobalLoading: (loading) => set({ globalLoading: loading }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
