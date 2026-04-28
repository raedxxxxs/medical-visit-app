import type { Visit } from '@/types/database'

export interface LabPoint {
  date: string // ISO yyyy-mm-dd
  value: number
  visit_id: string
}

interface LabsAndVitals {
  labs?: Record<string, string>
  vitals?: Record<string, string>
}

/**
 * Extract a chronological series of values for one lab/vital key from visits.
 * Returns null when the value is missing/non-numeric.
 */
export function getPatientLabHistory(
  visits: Visit[] | undefined,
  patientId: string,
  key: string,
): LabPoint[] {
  if (!visits) return []
  const points: LabPoint[] = []
  for (const v of visits) {
    if (v.patient_id !== patientId) continue
    const data = (v.patient_data as LabsAndVitals | null) ?? null
    const raw =
      data?.labs?.[key] ??
      data?.vitals?.[key] ??
      undefined
    if (!raw) continue
    const n = Number(String(raw).replace(',', '.'))
    if (Number.isNaN(n)) continue
    points.push({ date: v.visit_date, value: n, visit_id: v.id })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Pull the most recent eGFR from a patient's visit history.
 * Used for renal-dose rules.
 */
export function getLatestEgfr(
  visits: Visit[] | undefined,
  patientId: string,
): number | null {
  const series = getPatientLabHistory(visits, patientId, 'egfr')
  return series.length > 0 ? series[series.length - 1].value : null
}

/** Same trick for any lab — returns latest numeric value or null. */
export function getLatestLab(
  visits: Visit[] | undefined,
  patientId: string,
  key: string,
): number | null {
  const series = getPatientLabHistory(visits, patientId, key)
  return series.length > 0 ? series[series.length - 1].value : null
}

/** Trend description: 'up' / 'down' / 'flat' over the last N points. */
export function trendDirection(
  points: LabPoint[],
  n = 3,
): 'up' | 'down' | 'flat' {
  if (points.length < 2) return 'flat'
  const tail = points.slice(-n)
  const first = tail[0].value
  const last = tail[tail.length - 1].value
  const delta = last - first
  const threshold = Math.max(Math.abs(first) * 0.05, 0.5)
  if (Math.abs(delta) < threshold) return 'flat'
  return delta > 0 ? 'up' : 'down'
}
