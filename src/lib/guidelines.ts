import type { GuidelineCategory } from '@/types/database'

export const CATEGORY_LABELS: Record<GuidelineCategory, string> = {
  diabetes: 'סוכרת',
  hypertension: 'יתר לחץ דם',
  lipids: 'שומנים',
  screening: 'סקר',
  general: 'כללי',
}

export const CATEGORY_ORDER: GuidelineCategory[] = [
  'diabetes',
  'hypertension',
  'lipids',
  'screening',
  'general',
]

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}
