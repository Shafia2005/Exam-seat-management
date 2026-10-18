import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My seat & hall ticket' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
