import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  /** Focuses the primary action element on mount (use sparingly — only for primary onboarding empties). */
  autoFocusAction?: boolean
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  autoFocusAction,
  className,
}: Props) {
  const actionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!autoFocusAction || !actionRef.current) return
    const btn = actionRef.current.querySelector<HTMLButtonElement>('button, [href]')
    btn?.focus()
  }, [autoFocusAction])

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[--radius-md] border border-dashed border-border bg-surface px-6 py-12 text-center animate-fade-in-up',
        className,
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--color-surface-sunk] text-text-muted">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        {description && (
          <p className="text-sm text-text-muted max-w-md">{description}</p>
        )}
      </div>
      {action && (
        <div ref={actionRef} className="mt-1">
          {action}
        </div>
      )}
    </div>
  )
}
