/**
 * Daily prep queue — list of patients the physician is preparing for on a
 * specific date. Persisted in localStorage (single-user MVP).
 */

import { useEffect, useState, useCallback } from 'react'

export interface QueueItem {
  patient_id: string
  added_at: string // ISO timestamp
  prepped_at: string | null // ISO timestamp when brief was generated/marked done
  reason?: string // optional appointment reason ("follow-up diabetes")
}

export type PrepQueue = Record<string, QueueItem[]> // keyed by date 'YYYY-MM-DD'

const STORAGE_KEY = 'prep-queue'

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function load(): PrepQueue {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function usePrepQueue(date: string = todayISO()) {
  const [queue, setQueue] = useState<PrepQueue>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  }, [queue])

  const dayItems = queue[date] ?? []

  const addPatient = useCallback(
    (patient_id: string, reason?: string) => {
      setQueue((prev) => {
        const items = prev[date] ?? []
        if (items.some((i) => i.patient_id === patient_id)) return prev
        return {
          ...prev,
          [date]: [
            ...items,
            { patient_id, added_at: new Date().toISOString(), prepped_at: null, reason },
          ],
        }
      })
    },
    [date],
  )

  const removePatient = useCallback(
    (patient_id: string) => {
      setQueue((prev) => {
        const items = prev[date] ?? []
        return {
          ...prev,
          [date]: items.filter((i) => i.patient_id !== patient_id),
        }
      })
    },
    [date],
  )

  const markPrepped = useCallback(
    (patient_id: string, prepped: boolean) => {
      setQueue((prev) => {
        const items = prev[date] ?? []
        return {
          ...prev,
          [date]: items.map((i) =>
            i.patient_id === patient_id
              ? { ...i, prepped_at: prepped ? new Date().toISOString() : null }
              : i,
          ),
        }
      })
    },
    [date],
  )

  const setReason = useCallback(
    (patient_id: string, reason: string) => {
      setQueue((prev) => {
        const items = prev[date] ?? []
        return {
          ...prev,
          [date]: items.map((i) =>
            i.patient_id === patient_id ? { ...i, reason } : i,
          ),
        }
      })
    },
    [date],
  )

  const clearDay = useCallback(() => {
    setQueue((prev) => {
      const next = { ...prev }
      delete next[date]
      return next
    })
  }, [date])

  return {
    items: dayItems,
    allDates: Object.keys(queue).sort().reverse(),
    addPatient,
    removePatient,
    markPrepped,
    setReason,
    clearDay,
  }
}

/**
 * Cache for generated prep briefs, keyed by patient_id + date.
 * Stored separately from queue to allow heavier payloads.
 */
const BRIEF_CACHE_KEY = 'prep-brief-cache'

export interface PrepBriefData {
  why_visit: string
  story_so_far: string
  what_changed: string[]
  action_items: { text: string; category: 'lab' | 'screening' | 'med' | 'followup' | 'other' }[]
  discussion_points: string[]
  red_flags: string[]
}

interface CachedBrief {
  data: PrepBriefData
  generated_at: string
}

export function getCachedBrief(patient_id: string, date: string): CachedBrief | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(BRIEF_CACHE_KEY)
    if (!raw) return null
    const cache: Record<string, CachedBrief> = JSON.parse(raw)
    return cache[`${patient_id}:${date}`] ?? null
  } catch {
    return null
  }
}

export function setCachedBrief(
  patient_id: string,
  date: string,
  data: PrepBriefData,
): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(BRIEF_CACHE_KEY)
    const cache: Record<string, CachedBrief> = raw ? JSON.parse(raw) : {}
    cache[`${patient_id}:${date}`] = {
      data,
      generated_at: new Date().toISOString(),
    }
    localStorage.setItem(BRIEF_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}
