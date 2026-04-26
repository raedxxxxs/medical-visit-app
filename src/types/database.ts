// Database types — תואמים לסכמת Supabase
// יוצר ידנית, אפשר להחליף ב-supabase gen types בעתיד

export type GuidelineCategory =
  | 'diabetes'
  | 'hypertension'
  | 'lipids'
  | 'screening'
  | 'general'

export type Gender = 'male' | 'female'

export type DocumentType =
  | 'lab'
  | 'imaging'
  | 'discharge'
  | 'clinical_photo'
  | string

export interface Guideline {
  id: string
  user_id: string
  title: string
  category: GuidelineCategory
  file_url: string
  file_name: string
  file_size: number | null
  extracted_text: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  user_id: string
  patient_code: string
  initials: string | null
  age: number | null
  gender: Gender | null
  conditions: string[] | null
  medications: string[] | null
  notes: string | null
  created_at: string
}

export interface Visit {
  id: string
  user_id: string
  patient_id: string
  visit_type: string
  visit_date: string
  patient_data: Record<string, unknown> | null
  generated_template: string | null
  recommendations: Record<string, unknown> | null
  guidelines_used: string[] | null
  tags: string[] | null
  is_favorite: boolean
  created_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  description: string | null
  visit_type: string
  template_structure: Record<string, unknown> | null
  default_fields: Record<string, unknown> | null
  is_default: boolean
  created_at: string
}

export interface PatientDocument {
  id: string
  user_id: string
  patient_id: string
  document_type: DocumentType | null
  document_date: string | null
  file_url: string
  file_name: string | null
  extracted_data: Record<string, unknown> | null
  notes: string | null
  created_at: string
}
