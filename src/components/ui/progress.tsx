import { cn } from '@/lib/utils'

interface Props {
  /** Determinate progress 0..max. Omit for indeterminate. */
  value?: number
  max?: number
  label?: string
  className?: string
}

export function Progress({ value, max = 100, label, className }: Props) {
  const indeterminate = value === undefined
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, (value / max) * 100))

  return (
    <div
      role="progressbar"
      aria-label={label ?? 'התקדמות'}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : value}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-[--color-surface-sunk]',
        className,
      )}
    >
      {indeterminate ? (
        <div className="absolute inset-y-0 w-1/3 animate-progress-indeterminate rounded-full bg-primary-500" />
      ) : (
        <div
          className="h-full rounded-full bg-primary-500 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  )
}
