export type VisitType =
  | 'diabetes'
  | 'hypertension'
  | 'lipids'
  | 'screening'
  | 'combined'

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  diabetes: 'מעקב סוכרת',
  hypertension: 'מעקב יל"ד',
  lipids: 'מעקב שומנים',
  screening: 'ביקור סקר',
  combined: 'ביקור משולב',
}

export const VISIT_TYPES: VisitType[] = [
  'diabetes',
  'hypertension',
  'lipids',
  'screening',
  'combined',
]

export interface LabValues {
  hba1c?: string
  glucose?: string
  ldl?: string
  hdl?: string
  triglycerides?: string
  total_cholesterol?: string
  creatinine?: string
  egfr?: string
  microalbumin?: string
  tsh?: string
  b12?: string
  vitamin_d?: string
}

export interface Vitals {
  systolic_bp?: string
  diastolic_bp?: string
  pulse?: string
  weight?: string
  height?: string
  bmi?: string
}

export interface Anamnesis {
  symptoms: string[]
  free_text?: string
}

export type Tone = 'standard' | 'first_person' | 'educational'

export const TONE_LABELS: Record<Tone, string> = {
  standard: 'מקצועי (ברירת מחדל)',
  first_person: 'גוף ראשון (אני ממליץ...)',
  educational: 'הסבר לימודי',
}

export interface TemplateVersion {
  template: string
  generated_at: string
  tone: Tone
  guidelines_used: string[]
}

export interface VisitDraft {
  patient_id: string | null
  visit_type: VisitType | null
  visit_date: string
  template_id: string | null
  labs: LabValues
  vitals: Vitals
  anamnesis: Anamnesis
  guidelines_selected: string[]
  generated_template: string | null
  tone: Tone
  template_versions: TemplateVersion[]
  next_visit_due: string | null
}

export const SYMPTOM_OPTIONS = [
  { value: 'polyuria', label: 'ריבוי שתן' },
  { value: 'polydipsia', label: 'ריבוי צמא' },
  { value: 'fatigue', label: 'עייפות' },
  { value: 'blurred_vision', label: 'ראייה מטושטשת' },
  { value: 'numbness', label: 'נימול' },
  { value: 'chest_pain', label: 'כאבי חזה' },
  { value: 'headache', label: 'כאבי ראש' },
  { value: 'dyspnea', label: 'קוצר נשימה' },
  { value: 'dizziness', label: 'סחרחורות' },
  { value: 'edema', label: 'בצקות' },
] as const

export function symptomLabel(value: string): string {
  return SYMPTOM_OPTIONS.find((s) => s.value === value)?.label ?? value
}

/** Per-field plausible bounds for validation. min:0 means non-negative. */
export const LAB_BOUNDS: Record<string, { min: number; max: number }> = {
  hba1c: { min: 3, max: 20 },
  glucose: { min: 20, max: 800 },
  ldl: { min: 0, max: 500 },
  hdl: { min: 0, max: 200 },
  total_cholesterol: { min: 50, max: 800 },
  triglycerides: { min: 0, max: 2000 },
  creatinine: { min: 0.1, max: 20 },
  egfr: { min: 0, max: 200 },
  microalbumin: { min: 0, max: 5000 },
  tsh: { min: 0, max: 100 },
  b12: { min: 50, max: 3000 },
  vitamin_d: { min: 0, max: 200 },
  systolic_bp: { min: 40, max: 260 },
  diastolic_bp: { min: 20, max: 180 },
  pulse: { min: 30, max: 220 },
  weight: { min: 20, max: 300 },
  height: { min: 80, max: 230 },
  bmi: { min: 10, max: 80 },
}

export const LAB_VALUE_LABELS: Record<string, string> = {
  hba1c: 'HbA1c',
  glucose: 'גלוקוז',
  ldl: 'LDL',
  hdl: 'HDL',
  total_cholesterol: 'כולסטרול',
  triglycerides: 'טריגליצרידים',
  creatinine: 'קריאטינין',
  egfr: 'eGFR',
  microalbumin: 'מיקרואלבומין',
  tsh: 'TSH',
  b12: 'B12',
  vitamin_d: 'ויטמין D',
  systolic_bp: 'ל"ד סיסטולי',
  diastolic_bp: 'ל"ד דיאסטולי',
  pulse: 'דופק',
  weight: 'משקל',
  height: 'גובה',
  bmi: 'BMI',
}

export function emptyDraft(): VisitDraft {
  return {
    patient_id: null,
    visit_type: null,
    visit_date: new Date().toISOString().slice(0, 10),
    template_id: null,
    labs: {},
    vitals: {},
    anamnesis: { symptoms: [] },
    guidelines_selected: [],
    generated_template: null,
    tone: 'standard',
    template_versions: [],
    next_visit_due: null,
  }
}

/**
 * Critical clinical thresholds — values that warrant attention beyond plausibility.
 * `critical` = urgent action consideration; `warning` = elevated risk.
 */
export type ClinicalLevel = 'critical' | 'warning'

export interface ClinicalAlert {
  level: ClinicalLevel
  message: string
}

export function getClinicalAlert(key: string, raw: string): ClinicalAlert | null {
  if (!raw || !raw.trim()) return null
  const n = Number(raw.replace(',', '.'))
  if (Number.isNaN(n)) return null

  switch (key) {
    case 'systolic_bp':
      if (n >= 180) return { level: 'critical', message: 'יל"ד דרגה 3 — שקול הפניה דחופה' }
      if (n >= 160) return { level: 'warning', message: 'יל"ד דרגה 2 — שקול הידוק טיפול' }
      if (n < 90) return { level: 'critical', message: 'תת-לחץ דם — בדוק נפח/תרופות' }
      return null
    case 'diastolic_bp':
      if (n >= 120) return { level: 'critical', message: 'יל"ד דיאסטולי קריטי — הפניה דחופה' }
      if (n >= 100) return { level: 'warning', message: 'יל"ד דיאסטולי גבוה' }
      if (n < 60) return { level: 'warning', message: 'תת-לחץ דיאסטולי' }
      return null
    case 'pulse':
      if (n >= 130) return { level: 'critical', message: 'טכיקרדיה — בדוק סיבה' }
      if (n < 45) return { level: 'critical', message: 'ברדיקרדיה — בדוק סיבה' }
      return null
    case 'glucose':
      if (n >= 400) return { level: 'critical', message: 'היפרגליקמיה חמורה — שקול ER' }
      if (n >= 250) return { level: 'warning', message: 'היפרגליקמיה — איזון לקוי' }
      if (n < 70) return { level: 'critical', message: 'היפוגליקמיה — טפל מיד' }
      return null
    case 'hba1c':
      if (n >= 10) return { level: 'critical', message: 'איזון סוכרת ירוד מאוד' }
      if (n >= 8) return { level: 'warning', message: 'יעד HbA1c לא מושג — הידוק טיפול' }
      return null
    case 'ldl':
      if (n >= 190) return { level: 'warning', message: 'LDL גבוה — בדוק היפרכולסטרולמיה משפחתית' }
      if (n >= 160) return { level: 'warning', message: 'LDL גבוה — סטטין במינון מירבי' }
      return null
    case 'egfr':
      if (n < 30) return { level: 'critical', message: 'CKD שלב 4 — הפניה לנפרולוג' }
      if (n < 45) return { level: 'warning', message: 'CKD שלב 3b — התאמת מינוני תרופות' }
      if (n < 60) return { level: 'warning', message: 'CKD שלב 3a — מעקב' }
      return null
    case 'creatinine':
      if (n >= 2.0) return { level: 'critical', message: 'קריאטינין גבוה — בדוק eGFR' }
      return null
    case 'tsh':
      if (n >= 10) return { level: 'warning', message: 'תת-פעילות בלוטת תריס' }
      if (n < 0.1) return { level: 'warning', message: 'יתר-פעילות בלוטת תריס' }
      return null
    case 'bmi':
      if (n >= 40) return { level: 'warning', message: 'השמנה דרגה 3' }
      if (n < 18.5) return { level: 'warning', message: 'תת-משקל' }
      return null
    default:
      return null
  }
}

export const NEXT_VISIT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'לא נקבע' },
  { value: '1m', label: 'חודש' },
  { value: '3m', label: '3 חודשים' },
  { value: '6m', label: '6 חודשים' },
  { value: '12m', label: '12 חודשים' },
]

export function computeNextVisitDate(option: string, from: Date = new Date()): string | null {
  if (!option) return null
  // Options look like "1m", "3m" — strip the suffix before parsing. Require the 'm'.
  const match = option.match(/^(\d+)m$/)
  if (!match) return null
  const months = parseInt(match[1], 10)
  if (Number.isNaN(months)) return null
  // Use UTC arithmetic to avoid DST/timezone shifts, and clamp the day to the
  // last valid day of the target month so Jan 31 + 1m = Feb 28/29, not Mar 3.
  const year = from.getUTCFullYear()
  const month = from.getUTCMonth() + months
  const day = from.getUTCDate()
  // Last day of the resulting month (day 0 of next month):
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const safeDay = Math.min(day, lastDayOfTarget)
  const d = new Date(Date.UTC(year, month, safeDay))
  return d.toISOString().slice(0, 10)
}
