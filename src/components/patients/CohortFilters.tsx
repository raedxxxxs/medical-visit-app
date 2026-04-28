import { useEffect, useState } from 'react'
import { ChevronDown, Filter, X } from 'lucide-react'
import { CONDITION_OPTIONS } from '@/lib/patients'
import { cn } from '@/lib/utils'

export type LabFilter =
  | 'hba1c-gt-9'
  | 'hba1c-gt-8'
  | 'ldl-gt-130'
  | 'ldl-gt-100'
  | 'sbp-gt-160'
  | 'sbp-gt-140'
  | 'egfr-lt-60'
  | 'egfr-lt-30'

export type RecallFilter = 'overdue' | 'no-visit-12m' | 'no-visit-ever'

export interface CohortState {
  conditions: string[] // condition VALUES (e.g. 'diabetes')
  labs: LabFilter[]
  recall: RecallFilter[]
}

export const EMPTY_COHORT: CohortState = {
  conditions: [],
  labs: [],
  recall: [],
}

const LAB_LABELS: Record<LabFilter, string> = {
  'hba1c-gt-9': 'HbA1c > 9',
  'hba1c-gt-8': 'HbA1c > 8',
  'ldl-gt-130': 'LDL > 130',
  'ldl-gt-100': 'LDL > 100',
  'sbp-gt-160': 'ל"ד סיסטולי > 160',
  'sbp-gt-140': 'ל"ד סיסטולי > 140',
  'egfr-lt-60': 'eGFR < 60',
  'egfr-lt-30': 'eGFR < 30',
}

const RECALL_LABELS: Record<RecallFilter, string> = {
  overdue: 'תור באיחור',
  'no-visit-12m': 'לא נראה 12 חודשים+',
  'no-visit-ever': 'ללא ביקורים',
}

const STORAGE_KEY = 'cohort-filters'

function loadCohort(): CohortState {
  if (typeof window === 'undefined') return EMPTY_COHORT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_COHORT
    const parsed = JSON.parse(raw)
    return {
      conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
      labs: Array.isArray(parsed.labs) ? parsed.labs : [],
      recall: Array.isArray(parsed.recall) ? parsed.recall : [],
    }
  } catch {
    return EMPTY_COHORT
  }
}

export function useCohortState() {
  const [state, setState] = useState<CohortState>(loadCohort)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  return [state, setState] as const
}

export function isCohortActive(c: CohortState): boolean {
  return c.conditions.length > 0 || c.labs.length > 0 || c.recall.length > 0
}

export function CohortFilters({
  state,
  onChange,
  matchedCount,
  totalCount,
}: {
  state: CohortState
  onChange: (next: CohortState) => void
  matchedCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const active = isCohortActive(state)

  const toggleCondition = (v: string) =>
    onChange({
      ...state,
      conditions: state.conditions.includes(v)
        ? state.conditions.filter((c) => c !== v)
        : [...state.conditions, v],
    })

  const toggleLab = (v: LabFilter) =>
    onChange({
      ...state,
      labs: state.labs.includes(v)
        ? state.labs.filter((c) => c !== v)
        : [...state.labs, v],
    })

  const toggleRecall = (v: RecallFilter) =>
    onChange({
      ...state,
      recall: state.recall.includes(v)
        ? state.recall.filter((c) => c !== v)
        : [...state.recall, v],
    })

  return (
    <div className="flex flex-col gap-2 rounded-[--radius-md] border border-border bg-surface p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-start"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          <Filter className="h-4 w-4 text-primary-500" />
          סינון אוכלוסייה
          {active && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
              {matchedCount}/{totalCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 pt-2">
          <ChipGroup
            label="מחלות רקע"
            options={CONDITION_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
            selected={state.conditions}
            onToggle={toggleCondition}
          />
          <ChipGroup
            label="ערכי מעבדה (האחרונים)"
            options={(Object.keys(LAB_LABELS) as LabFilter[]).map((k) => ({
              value: k,
              label: LAB_LABELS[k],
            }))}
            selected={state.labs}
            onToggle={(v) => toggleLab(v as LabFilter)}
          />
          <ChipGroup
            label="מצב מעקב"
            options={(Object.keys(RECALL_LABELS) as RecallFilter[]).map((k) => ({
              value: k,
              label: RECALL_LABELS[k],
            }))}
            selected={state.recall}
            onToggle={(v) => toggleRecall(v as RecallFilter)}
          />
          {active && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_COHORT)}
              className="self-start text-xs font-medium text-text-muted hover:text-text"
            >
              <X className="me-1 inline h-3 w-3" />
              נקה את כל הסינון
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                on
                  ? 'border-primary-500 bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                  : 'border-border bg-muted text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
