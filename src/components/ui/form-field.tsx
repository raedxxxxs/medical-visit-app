import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Props {
  label?: string
  required?: boolean
  hint?: string
  error?: string
  className?: string
  /** Child must be a single form control that accepts id/aria-* props. */
  children: ReactNode
}

/**
 * FormField wraps a single control and threads accessible label + hint + error.
 * Generates an id, sets aria-invalid + aria-describedby on the child,
 * and renders the error in role="alert".
 */
export function FormField({ label, required, hint, error, className, children }: Props) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const child = Children.only(children)
  const enhanced = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })
    : child

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {enhanced}
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-[--color-danger-fg]"
        >
          {error}
        </p>
      )}
    </div>
  )
}
