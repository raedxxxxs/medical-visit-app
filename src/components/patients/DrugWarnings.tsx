import { AlertTriangle, AlertOctagon, Info } from 'lucide-react'
import type { DrugWarning } from '@/lib/drug-rules'
import { cn } from '@/lib/utils'

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-[--color-danger-bg]',
    text: 'text-[--color-danger-fg]',
    border: 'border-[--color-danger-fg]/30',
    icon: AlertOctagon,
  },
  warning: {
    bg: 'bg-[--color-warning-bg]',
    text: 'text-[--color-warning-fg]',
    border: 'border-[--color-warning-fg]/30',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-[--color-info-bg]',
    text: 'text-[--color-info-fg]',
    border: 'border-[--color-info-fg]/30',
    icon: Info,
  },
} as const

export function DrugWarnings({
  warnings,
  className,
  compact,
}: {
  warnings: DrugWarning[]
  className?: string
  compact?: boolean
}) {
  if (warnings.length === 0) return null
  return (
    <ul
      role="list"
      aria-label="אזהרות תרופתיות"
      className={cn('flex flex-col gap-2', className)}
    >
      {warnings.map((w) => {
        const style = SEVERITY_STYLES[w.severity]
        const Icon = style.icon
        return (
          <li
            key={w.id}
            role="alert"
            className={cn(
              'flex items-start gap-2.5 rounded-[--radius-md] border px-3 py-2',
              style.bg,
              style.text,
              style.border,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{w.title}</p>
              {!compact && (
                <p className="mt-0.5 text-xs opacity-90">{w.detail}</p>
              )}
              {!compact && w.drugs.length > 0 && (
                <p className="mt-1 text-xs opacity-75" dir="ltr">
                  {w.drugs.join(' · ')}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
