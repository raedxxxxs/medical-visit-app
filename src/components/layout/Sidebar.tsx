import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FilePlus2,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/guidelines', label: 'מאגר הנחיות', icon: BookOpen },
  { to: '/patients', label: 'מטופלים', icon: Users },
  { to: '/visit/new', label: 'ביקור חדש', icon: FilePlus2 },
  { to: '/templates', label: 'שבלונות', icon: FileText },
]

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-l border-border bg-surface">
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                  : 'text-text hover:bg-muted',
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
