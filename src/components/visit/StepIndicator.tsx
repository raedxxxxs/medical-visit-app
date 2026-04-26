import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { num: 1, label: 'מטופל וסוג ביקור' },
  { num: 2, label: 'הזנת נתונים' },
  { num: 3, label: 'סקירה ושמירה' },
] as const

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const isDone = current > s.num
        const isActive = current === s.num
        return (
          <li key={s.num} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                isDone &&
                  'bg-primary-600 text-white dark:bg-primary-500',
                isActive &&
                  'bg-primary-100 text-primary-700 ring-2 ring-primary-500 dark:bg-primary-900/40 dark:text-primary-200',
                !isDone &&
                  !isActive &&
                  'bg-muted text-text-muted',
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : s.num}
            </div>
            <span
              className={cn(
                'hidden text-sm sm:inline',
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
  )
}
