import { useEffect, useState, useCallback } from 'react'
import { emptyDraft, type VisitDraft } from '@/lib/visits'

const STORAGE_KEY = 'visit-draft'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Deep-merge a partial parsed draft over the empty template, keeping the
// template's shape for any field that's missing or has a wrong type.
function mergeDraft(parsed: unknown): VisitDraft {
  const base = emptyDraft() as unknown as Record<string, unknown>
  if (!isPlainObject(parsed)) return base as unknown as VisitDraft
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(base)) {
    const baseVal = base[key]
    const parsedVal = parsed[key]
    if (parsedVal === undefined) continue
    if (Array.isArray(baseVal)) {
      out[key] = Array.isArray(parsedVal) ? parsedVal : baseVal
    } else if (isPlainObject(baseVal)) {
      out[key] = isPlainObject(parsedVal)
        ? { ...baseVal, ...parsedVal }
        : baseVal
    } else {
      // Primitive: only accept if same type.
      out[key] = typeof parsedVal === typeof baseVal ? parsedVal : baseVal
    }
  }
  return out as unknown as VisitDraft
}

function load(): VisitDraft {
  if (typeof window === 'undefined') return emptyDraft()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDraft()
    return mergeDraft(JSON.parse(raw))
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
