import type { Patient, Visit } from '@/types/database'
import { getLatestLab } from '@/lib/lab-history'
import type { CohortState, LabFilter, RecallFilter } from '@/components/patients/CohortFilters'

interface LabRule {
  key: string
  predicate: (n: number) => boolean
}

const LAB_RULES: Record<LabFilter, LabRule> = {
  'hba1c-gt-9': { key: 'hba1c', predicate: (n) => n > 9 },
  'hba1c-gt-8': { key: 'hba1c', predicate: (n) => n > 8 },
  'ldl-gt-130': { key: 'ldl', predicate: (n) => n > 130 },
  'ldl-gt-100': { key: 'ldl', predicate: (n) => n > 100 },
  'sbp-gt-160': { key: 'systolic_bp', predicate: (n) => n > 160 },
  'sbp-gt-140': { key: 'systolic_bp', predicate: (n) => n > 140 },
  'egfr-lt-60': { key: 'egfr', predicate: (n) => n < 60 },
  'egfr-lt-30': { key: 'egfr', predicate: (n) => n < 30 },
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Calendar-day diff between two ISO yyyy-mm-dd strings, in UTC.
 * `2025-12-31` → `2026-01-01` returns 1, not "1 month".
 * Used for time-window cohort filters so year-end edge cases don't blow up.
 *
 * Returns Infinity (not NaN) on malformed input so cohort comparisons fail
 * "old enough" rather than silently dropping a row.
 */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/
function daysBetween(fromIso: string, toIso: string): number {
  const fm = ISO_DATE_RE.exec(fromIso)
  const tm = ISO_DATE_RE.exec(toIso)
  if (!fm || !tm) return Number.POSITIVE_INFINITY
  const from = Date.UTC(+fm[1], +fm[2] - 1, +fm[3])
  const to = Date.UTC(+tm[1], +tm[2] - 1, +tm[3])
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY
  return Math.floor((to - from) / MS_PER_DAY)
}

export function patientMatchesCohort(
  patient: Patient,
  visits: Visit[] | undefined,
  cohort: CohortState,
): boolean {
  // Conditions: patient must have ALL selected conditions (intersect).
  if (cohort.conditions.length > 0) {
    const has = patient.conditions ?? []
    for (const c of cohort.conditions) {
      if (!has.includes(c)) return false
    }
  }

  // Labs: patient's latest value for each selected lab must satisfy predicate.
  if (cohort.labs.length > 0) {
    for (const lab of cohort.labs) {
      const rule = LAB_RULES[lab]
      const value = getLatestLab(visits, patient.id, rule.key)
      if (value == null || !rule.predicate(value)) return false
    }
  }

  // Recall states (multi-select = OR).
  if (cohort.recall.length > 0) {
    const matchAny = cohort.recall.some((r) =>
      matchesRecall(patient, visits, r),
    )
    if (!matchAny) return false
  }

  return true
}

function matchesRecall(
  patient: Patient,
  visits: Visit[] | undefined,
  rule: RecallFilter,
): boolean {
  const ownVisits = (visits ?? []).filter((v) => v.patient_id === patient.id)
  if (rule === 'no-visit-ever') return ownVisits.length === 0

  if (rule === 'no-visit-12m') {
    if (ownVisits.length === 0) return true
    const latestDate = ownVisits
      .map((v) => v.visit_date)
      .sort()
      .pop()!
    // 365 days = 12 months threshold (handles year-end calendar edge cases).
    return daysBetween(latestDate, todayISO()) >= 365
  }

  if (rule === 'overdue') {
    let latestDue: string | null = null
    let latestVisitDate = ''
    for (const v of ownVisits) {
      const due = (v.patient_data as { next_visit_due?: string } | null)
        ?.next_visit_due
      if (due && v.visit_date >= latestVisitDate) {
        latestDue = due
        latestVisitDate = v.visit_date
      }
    }
    return latestDue !== null && latestDue <= todayISO()
  }

  return false
}
