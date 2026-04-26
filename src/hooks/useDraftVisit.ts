import { useEffect, useState, useCallback } from 'react'
import { emptyDraft, type VisitDraft } from '@/lib/visits'

const STORAGE_KEY = 'visit-draft'

function load(): VisitDraft {
  if (typeof window === 'undefined') return emptyDraft()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDraft()
    const parsed = JSON.parse(raw) as VisitDraft
    return { ...emptyDraft(), ...parsed }
  } catch {
    return emptyDraft()
  }
}

export function useDraftVisit() {
  const [draft, setDraft] = useState<VisitDraft>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  const update = useCallback((patch: Partial<VisitDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    const fresh = emptyDraft()
    setDraft(fresh)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { draft, update, reset, setDraft }
}
