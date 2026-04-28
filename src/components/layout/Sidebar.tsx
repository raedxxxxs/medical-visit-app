import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FilePlus2,
  FileText,
  FolderHeart,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/prep', label: 'הכנה לביקורים', icon: ClipboardList },
  { to: '/guidelines', label: 'מאגר הנחיות', icon: BookOpen },
  { to: '/patients', label: 'מטופלים', icon: Users },
  { to: '/visit/new', label: 'ביקור חדש', icon: FilePlus2 },
  { to: '/templates', label: 'שבלונות', icon: FileText },
  { to: '/chart', label: 'סיכום תיק מטופל', icon: FolderHeart },
]

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (!isOpen) return
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop on mobile when sidebar is open */}
      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור תפריט"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={cn(
          // In RTL the sidebar lives on the inline-start (right edge), so its content-facing edge
          // is on the inline-end (left in RTL) — border-e draws that separator.
          'fixed inset-y-0 start-0 z-40 w-60 shrink-0 border-e border-border bg-surface transition-transform md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
        )}
      >
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-[--radius-sm] px-3 py-2 text-sm font-medium transition-colors border-s-[3px]',
                  isActive
                    ? 'bg-[--color-sidebar-active-bg] text-primary-700 dark:text-primary-200 border-[--color-sidebar-active-bar]'
                    : 'text-text hover:bg-muted border-transparent',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
