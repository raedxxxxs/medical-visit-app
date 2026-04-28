import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { num: 1, label: 'מטופל וסוג ביקור' },
  { num: 2, label: 'הזנת נתונים' },
  { num: 3, label: 'סקירה ושמירה' },
] as const

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const progressPct = ((current - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="flex flex-col gap-2">
      <ol className="relative flex items-center gap-2">
        {STEPS.map((s, i) => {
          const isDone = current > s.num
          const isActive = current === s.num
          return (
            <li key={s.num} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300',
                  isDone &&
                    'bg-primary-600 text-white shadow-[--shadow-sm] dark:bg-primary-500 dark:text-neutral-950',
                  isActive &&
                    'bg-primary-100 text-primary-700 ring-2 ring-primary-500 ring-offset-2 ring-offset-[--color-muted] animate-pulse-soft dark:bg-primary-900/40 dark:text-primary-200',
                  !isDone &&
                    !isActive &&
                    'bg-[--color-surface-sunk] text-text-muted',
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4 animate-scale-in" />
                ) : (
                  s.num
                )}
              </div>
              <span
                className={cn(
                  'hidden text-sm transition-colors sm:inline',
                  isActive ? 'font-medium text-text' : 'text-text-muted',
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="mx-2 h-px flex-1 bg-border" />
              )}
            </li>
          )
        })}
      </ol>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-[--color-surface-sunk]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={current}
        aria-label="התקדמות שלבים"
      >
        <div
          className="h-full rounded-full bg-primary-500 transition-[width] duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}
