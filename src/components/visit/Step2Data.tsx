import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SYMPTOM_OPTIONS } from '@/lib/visits'
import type { LabValues, Vitals, VisitDraft } from '@/lib/visits'
import { LabImageUpload } from './LabImageUpload'

interface Props {
  draft: VisitDraft
  update: (patch: Partial<VisitDraft>) => void
}

const LAB_FIELDS: { key: keyof LabValues; label: string; unit?: string }[] = [
  { key: 'hba1c', label: 'HbA1c', unit: '%' },
  { key: 'glucose', label: 'גלוקוז', unit: 'mg/dL' },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL' },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
  { key: 'triglycerides', label: 'טריגליצרידים', unit: 'mg/dL' },
  { key: 'total_cholesterol', label: 'כולסטרול כללי', unit: 'mg/dL' },
  { key: 'creatinine', label: 'קריאטינין', unit: 'mg/dL' },
  { key: 'egfr', label: 'eGFR', unit: 'mL/min' },
  { key: 'microalbumin', label: 'מיקרואלבומין', unit: 'mg/g' },
  { key: 'tsh', label: 'TSH', unit: 'mIU/L' },
  { key: 'b12', label: 'B12', unit: 'pg/mL' },
  { key: 'vitamin_d', label: 'ויטמין D', unit: 'ng/mL' },
]

const VITAL_FIELDS: { key: keyof Vitals; label: string; unit?: string }[] = [
  { key: 'systolic_bp', label: 'ל"ד סיסטולי', unit: 'mmHg' },
  { key: 'diastolic_bp', label: 'ל"ד דיאסטולי', unit: 'mmHg' },
  { key: 'pulse', label: 'דופק', unit: 'bpm' },
  { key: 'weight', label: 'משקל', unit: 'ק"ג' },
  { key: 'height', label: 'גובה', unit: 'ס"מ' },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²' },
]

export function Step2Data({ draft, update }: Props) {
  const setLab = (key: keyof LabValues, value: string) => {
    update({ labs: { ...draft.labs, [key]: value } })
  }
  const setVital = (key: keyof Vitals, value: string) => {
    update({ vitals: { ...draft.vitals, [key]: value } })
  }
  const toggleSymptom = (val: string) => {
    const current = draft.anamnesis.symptoms
    const next = current.includes(val)
      ? current.filter((s) => s !== val)
      : [...current, val]
    update({ anamnesis: { ...draft.anamnesis, symptoms: next } })
  }

  return (
    <div className="flex flex-col gap-4">
      <LabImageUpload draft={draft} update={update} />

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-text">מדידות</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {VITAL_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">
                {f.label}
                {f.unit && (
                  <span className="text-text-muted"> ({f.unit})</span>
                )}
              </label>
              <Input
                type="number"
                step="any"
                dir="ltr"
                value={draft.vitals[f.key] ?? ''}
                onChange={(e) => setVital(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-text">ערכי מעבדה</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {LAB_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">
                {f.label}
                {f.unit && (
                  <span className="text-text-muted"> ({f.unit})</span>
                )}
              </label>
              <Input
                type="number"
                step="any"
                dir="ltr"
                value={draft.labs[f.key] ?? ''}
                onChange={(e) => setLab(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-text">אנמנזה</h3>
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            סימפטומים
          </label>
          <div className="flex flex-wrap gap-3 rounded-md border border-border bg-muted p-3">
            {SYMPTOM_OPTIONS.map((s) => (
              <label
                key={s.value}
                className="flex cursor-pointer items-center gap-2 text-sm text-text"
              >
                <input
                  type="checkbox"
                  checked={draft.anamnesis.symptoms.includes(s.value)}
                  onChange={() => toggleSymptom(s.value)}
                  className="h-4 w-4 accent-primary-500"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">טקסט חופשי</label>
          <Textarea
            value={draft.anamnesis.free_text ?? ''}
            onChange={(e) =>
              update({
                anamnesis: { ...draft.anamnesis, free_text: e.target.value },
              })
            }
            placeholder="פירוט נוסף, תלונות, היסטוריה רפואית..."
          />
        </div>
      </section>
    </div>
  )
}
