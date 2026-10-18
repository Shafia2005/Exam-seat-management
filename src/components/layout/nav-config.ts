import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Ticket,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { ADMIN_ROLES, ALL_ROLES, STAFF_ROLES } from '@/lib/auth/roles'
import type { DbUserRole } from '@/types/auth.types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: readonly DbUserRole[]
}

export interface NavGroup {
  label: string
  /** Shown instead of `label` to administrators (who see the portals as previews). */
  adminLabel?: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ADMIN_ROLES }],
  },
  {
    label: 'My portal',
    adminLabel: 'Portal previews',
    items: [
      { href: '/my-duties', label: 'My Duties', icon: ClipboardList, roles: STAFF_ROLES },
      { href: '/my-seat', label: 'My Seat & Hall Ticket', icon: Ticket, roles: [...ADMIN_ROLES, 'STUDENT'] },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/students', label: 'Students', icon: GraduationCap, roles: ADMIN_ROLES },
      { href: '/teachers', label: 'Teachers', icon: Users, roles: ADMIN_ROLES },
    ],
  },
  {
    label: 'Examinations',
    items: [
      { href: '/exams', label: 'Exam Schedule', icon: CalendarDays, roles: ALL_ROLES },
      { href: '/seat-allocation', label: 'Seat Allocation', icon: LayoutGrid, roles: ADMIN_ROLES },
      { href: '/teacher-allocation', label: 'Invigilation', icon: UserCheck, roles: STAFF_ROLES },
      { href: '/attendance', label: 'Exam-day Attendance', icon: ClipboardCheck, roles: STAFF_ROLES },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3, roles: ADMIN_ROLES },
      { href: '/activity', label: 'Activity', icon: History, roles: ADMIN_ROLES },
    ],
  },
  {
    label: 'Administration',
    items: [{ href: '/settings', label: 'Settings', icon: Settings, roles: ADMIN_ROLES }],
  },
]

export function navForRole(role: DbUserRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length)
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function pageTitle(pathname: string): string {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => isActivePath(pathname, i.href))
    if (item) return item.label
  }
  return ''
}
