export const CONDITION_OPTIONS = [
  { value: 'diabetes', label: 'סוכרת' },
  { value: 'hypertension', label: 'יתר לחץ דם' },
  { value: 'lipids', label: 'דיסליפידמיה' },
  { value: 'cad', label: 'מחלת לב כלילית' },
  { value: 'ckd', label: 'אי ספיקת כליות' },
  { value: 'copd', label: 'COPD' },
  { value: 'asthma', label: 'אסטמה' },
  { value: 'thyroid', label: 'בלוטת התריס' },
] as const

export function conditionLabel(value: string): string {
  const found = (CONDITION_OPTIONS as readonly { value: string; label: string }[]).find(
    (c) => c.value === value,
  )
  return found?.label ?? value
}

export function genderLabel(gender: 'male' | 'female' | null): string {
  if (gender === 'male') return 'זכר'
  if (gender === 'female') return 'נקבה'
  return ''
}
