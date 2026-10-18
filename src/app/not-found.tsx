import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LogoMark } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-6 text-center">
      <LogoMark className="size-12" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">The page you are looking for doesn&apos;t exist or has moved.</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">
          <ArrowLeft /> Back to home
        </Link>
      </Button>
    </div>
  )
}
