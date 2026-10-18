'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Building, Building2, DoorOpen, School, Send, ShieldCheck } from 'lucide-react'
import { PageHeader, Skeleton } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InstitutionTab } from './components/institution-tab'
import { CoursesTab, DepartmentsTab } from './components/catalog-tabs'
import { BlocksTab, RoomsTab } from './components/infrastructure-tabs'
import { AdminsTab } from './components/admins-tab'
import { NotificationsTab } from './components/notifications-tab'

const TABS = ['institution', 'administrators', 'departments', 'courses', 'blocks', 'rooms', 'notifications'] as const

function SettingsContent() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const requested = params.get('tab')
  const tab = (TABS as readonly string[]).includes(requested ?? '') ? requested! : 'institution'

  // Keep the tab in the URL so links like /settings?tab=notifications work.
  const onTabChange = (value: string) => router.replace(value === 'institution' ? pathname : `${pathname}?tab=${value}`, { scroll: false })

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="institution">
          <School /> Institution
        </TabsTrigger>
        <TabsTrigger value="administrators">
          <ShieldCheck /> Administrators
        </TabsTrigger>
        <TabsTrigger value="departments">
          <Building /> Departments
        </TabsTrigger>
        <TabsTrigger value="courses">
          <BookOpen /> Courses
        </TabsTrigger>
        <TabsTrigger value="blocks">
          <Building2 /> Blocks
        </TabsTrigger>
        <TabsTrigger value="rooms">
          <DoorOpen /> Rooms
        </TabsTrigger>
        <TabsTrigger value="notifications">
          <Send /> Notifications
        </TabsTrigger>
      </TabsList>
      <TabsContent value="institution">
        <InstitutionTab />
      </TabsContent>
      <TabsContent value="administrators">
        <AdminsTab />
      </TabsContent>
      <TabsContent value="departments">
        <DepartmentsTab />
      </TabsContent>
      <TabsContent value="courses">
        <CoursesTab />
      </TabsContent>
      <TabsContent value="blocks">
        <BlocksTab />
      </TabsContent>
      <TabsContent value="rooms">
        <RoomsTab />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>
    </Tabs>
  )
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Institution profile and exam policy, administrators, academic structure, infrastructure and notifications." />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <SettingsContent />
      </Suspense>
    </div>
  )
}
