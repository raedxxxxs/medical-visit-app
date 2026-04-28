import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FilePlus2,
  FileText,
  FolderHeart,
  ClipboardList,
  HeartPulse,
  Moon,
  Sun,
  User as UserIcon,
  Search,
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { usePatients } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { useTheme } from '@/hooks/useTheme'
import { VISIT_TYPE_LABELS, type VisitType } from '@/lib/visits'
import { cn } from '@/lib/utils'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

interface Command {
  id: string
  label: string
  hint?: string
  icon: ComponentType<LucideProps>
  keywords?: string
  run: () => void
}

const STATIC_NAV: { id: string; path: string; label: string; icon: ComponentType<LucideProps>; keywords?: string }[] = [
  { id: 'nav-dashboard', path: '/', label: 'דשבורד', icon: LayoutDashboard, keywords: 'home בית' },
  { id: 'nav-prep', path: '/prep', label: 'הכנה לביקורים', icon: ClipboardList, keywords: 'prep הכנה' },
  { id: 'nav-guidelines', path: '/guidelines', label: 'מאגר הנחיות', icon: BookOpen, keywords: 'guidelines' },
  { id: 'nav-patients', path: '/patients', label: 'מטופלים', icon: Users, keywords: 'patients' },
  { id: 'nav-visit', path: '/visit/new', label: 'ביקור חדש', icon: FilePlus2, keywords: 'new visit ביקור' },
  { id: 'nav-templates', path: '/templates', label: 'שבלונות שמורות', icon: FileText, keywords: 'templates' },
  { id: 'nav-chart', path: '/chart', label: 'סיכום תיק מטופל', icon: FolderHeart, keywords: 'chart summary' },
  { id: 'nav-hospitalization', path: '/hospitalization', label: 'סיכום אשפוז', icon: HeartPulse, keywords: 'hospitalization discharge אשפוז שחרור' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { data: patients } = usePatients()
  const { data: visits } = useVisits()
  const { theme, toggleTheme } = useTheme()

  // Open with Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      // Focus the input after the dialog mounts
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  const close = () => setOpen(false)

  const commands = useMemo<Command[]>(() => {
    const navCommands: Command[] = STATIC_NAV.map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      keywords: c.keywords,
      run: () => navigate(c.path),
    }))

    const themeCommand: Command = {
      id: 'theme-toggle',
      label: theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה',
      icon: theme === 'dark' ? Sun : Moon,
      keywords: 'theme dark light mode',
      run: toggleTheme,
    }

    const patientCommands: Command[] = (patients ?? []).map((p) => ({
      id: `patient-${p.id}`,
      label: p.full_name || `${p.patient_code} — ${p.initials ?? ''}`.trim(),
      hint: p.full_name ? p.patient_code : 'התחל ביקור חדש למטופל',
      icon: UserIcon,
      keywords: `${p.patient_code} ${p.full_name ?? ''} ${p.initials ?? ''} ${p.medications?.join(' ') ?? ''}`,
      run: () => navigate(`/patients/${p.id}`),
    }))

    const visitCommands: Command[] = (visits ?? []).slice(0, 30).map((v) => {
      const p = patients?.find((x) => x.id === v.patient_id)
      return {
        id: `visit-${v.id}`,
        label: `${VISIT_TYPE_LABELS[v.visit_type as VisitType] ?? v.visit_type} · ${p?.patient_code ?? '—'}`,
        hint: v.visit_date,
        icon: FileText,
        keywords: `${v.visit_date} ${v.visit_type} ${p?.patient_code ?? ''} ${p?.initials ?? ''}`,
        run: () => navigate('/templates'),
      }
    })

    return [...navCommands, themeCommand, ...patientCommands, ...visitCommands]
    // Intentionally exclude `theme` and `toggleTheme` identity churn — only
    // re-build when the data sources or navigate change.
  }, [patients, visits, theme, toggleTheme, navigate])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 12)
    return commands
      .filter((c) =>
        `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, 20)
  }, [commands, query])

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[activeIdx]
      if (cmd) {
        cmd.run()
        close()
      }
    }
  }

  return (
    <Dialog open={open} onClose={close} className="max-w-xl">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="חפש מטופלים, ביקורים, פעולות..."
            aria-label="חיפוש פעולות"
            className="h-11 w-full rounded-[--radius-sm] border border-border bg-surface ps-10 pe-3 text-sm text-text shadow-inner placeholder:text-text-muted focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus-ring]"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-text-muted">
            אין תוצאות.
          </p>
        ) : (
          <ul
            role="listbox"
            aria-label="פעולות"
            className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto"
          >
            {filtered.map((c, i) => {
              const Icon = c.icon
              const isActive = i === activeIdx
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => {
                      c.run()
                      close()
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[--radius-sm] px-3 py-2 text-start text-sm transition-colors',
                      isActive
                        ? 'bg-[--color-sidebar-active-bg] text-text'
                        : 'text-text hover:bg-muted',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && (
                      <span className="text-xs text-text-muted" dir="ltr">
                        {c.hint}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-text-muted">
          <span>↑↓ לניווט · Enter לבחירה · Esc לסגירה</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
            Ctrl+K
          </kbd>
        </div>
      </div>
    </Dialog>
  )
}
