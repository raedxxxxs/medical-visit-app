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
  }
}
