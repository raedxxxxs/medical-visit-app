import { AlertCircle, Sparkles, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePatients } from '@/hooks/usePatients'
import { useGuidelines } from '@/hooks/useGuidelines'
import { useGenerateVisit } from '@/hooks/useGenerateVisit'
import { VISIT_TYPE_LABELS, symptomLabel, TONE_LABELS } from '@/lib/visits'
import { conditionLabel } from '@/lib/patients'
import type { Tone, VisitDraft } from '@/lib/visits'
import { Select } from '@/components/ui/select'
import { GeneratedTemplate } from './GeneratedTemplate'

interface Props {
  draft: VisitDraft
  update: (patch: Partial<VisitDraft>) => void
}

export function Step3Review({ draft, update }: Props) {
  const { data: patients } = usePatients()
  const { data: guidelines } = useGuidelines()
  const generate = useGenerateVisit()
  const [genError, setGenError] = useState<string | null>(null)

  const patient = patients?.find((p) => p.id === draft.patient_id)
  const activeGuidelines = (guidelines ?? []).filter((g) => g.is_active)

  const toggleGuideline = (id: string) => {
    const current = draft.guidelines_selected
    update({
      guidelines_selected: current.includes(id)
        ? current.filter((g) => g !== id)
        : [...current, id],
    })
  }

  const labEntries = Object.entries(draft.labs).filter(([, v]) => v)
  const vitalEntries = Object.entries(draft.vitals).filter(([, v]) => v)

  const handleGenerate = async () => {
    setGenError(null)
    try {
      let summary: string | undefined
      if (patient) {
        const parts: string[] = []
        parts.push(patient.patient_code)
        if (patient.initials) parts.push(patient.initials)
        if (patient.age) parts.push(`גיל ${patient.age}`)
        if (patient.gender === 'male') parts.push('זכר')
        else if (patient.gender === 'female') parts.push('נקבה')
        if (patient.conditions?.length) {
          parts.push(
            `מחלות רקע: ${patient.conditions.map(conditionLabel).join(', ')}`,
          )
        }
        if (patient.medications?.length) {
          parts.push(`תרופות: ${patient.medications.join(', ')}`)
        }
        summary = parts.join(', ')
      }
      const res = await generate.mutateAsync({ draft, patient_summary: summary })
      update({ generated_template: res.template })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'שגיאה ביצירה')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-text">סיכום</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">מטופל</dt>
            <dd className="font-medium text-text">
              {patient
                ? `${patient.patient_code} — ${patient.initials}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">סוג ביקור</dt>
            <dd className="font-medium text-text">
              {draft.visit_type
                ? VISIT_TYPE_LABELS[draft.visit_type]
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">תאריך</dt>
            <dd className="font-medium text-text">{draft.visit_date}</dd>
          </div>
        </dl>

        {vitalEntries.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-sm text-text-muted">מדידות:</p>
            <p className="text-sm text-text" dir="ltr">
              {vitalEntries.map(([k, v]) => `${k}=${v}`).join(' · ')}
            </p>
          </div>
        )}

        {labEntries.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-sm text-text-muted">מעבדה:</p>
            <p className="text-sm text-text" dir="ltr">
              {labEntries.map(([k, v]) => `${k}=${v}`).join(' · ')}
            </p>
          </div>
        )}

        {draft.anamnesis.symptoms.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-sm text-text-muted">סימפטומים:</p>
            <p className="text-sm text-text">
              {draft.anamnesis.symptoms.map(symptomLabel).join(', ')}
            </p>
          </div>
        )}

        {draft.anamnesis.free_text && (
          <div className="mt-2">
            <p className="mb-1 text-sm text-text-muted">טקסט חופשי:</p>
            <p className="text-sm whitespace-pre-wrap text-text">
              {draft.anamnesis.free_text}
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-text">
          הנחיות לשימוש ביצירת השבלונה
        </h3>
        {activeGuidelines.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertCircle className="h-4 w-4" />
            אין הנחיות פעילות במאגר. הוסף הנחיות כדי לקבל המלצות.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeGuidelines.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-muted p-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={draft.guidelines_selected.includes(g.id)}
                  onChange={() => toggleGuideline(g.id)}
                  className="mt-0.5 h-4 w-4 accent-primary-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text">{g.title}</p>
                  <p className="text-xs text-text-muted">{g.file_name}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <label className="text-sm font-semibold text-text">
          טון השבלונה
        </label>
        <Select
          value={draft.tone}
          onChange={(e) =>
            update({
              tone: e.target.value as Tone,
              generated_template: null,
            })
          }
        >
          {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
            <option key={t} value={t}>
              {TONE_LABELS[t]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-text-muted">
          שינוי הטון יחייב יצירה מחדש של השבלונה.
        </p>
      </section>

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleGenerate}
          disabled={
            generate.isPending ||
            draft.guidelines_selected.length === 0 ||
            activeGuidelines.length === 0
          }
          size="lg"
        >
          {generate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generate.isPending
            ? 'מייצר שבלונה...'
            : draft.generated_template
              ? 'צור מחדש'
              : 'צור שבלונה עם Claude AI'}
        </Button>
        {generate.isPending && (
          <p className="text-xs text-text-muted">
            התהליך עשוי לקחת 20-60 שניות בהתאם לגודל ההנחיות.
          </p>
        )}
        {genError && (
          <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {genError}
          </div>
        )}
      </div>

      {draft.generated_template && (
        <GeneratedTemplate
          initial={draft.generated_template}
          onChange={(value) => update({ generated_template: value })}
        />
      )}
    </div>
  )
}
