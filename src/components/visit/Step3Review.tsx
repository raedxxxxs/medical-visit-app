import { AlertCircle, Sparkles } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DrugWarnings } from '@/components/patients/DrugWarnings'
import { checkDrugWarnings } from '@/lib/drug-rules'
import { usePatients } from '@/hooks/usePatients'
import { useGuidelines } from '@/hooks/useGuidelines'
import { useGenerateVisit } from '@/hooks/useGenerateVisit'
import {
  VISIT_TYPE_LABELS,
  symptomLabel,
  TONE_LABELS,
  NEXT_VISIT_OPTIONS,
  computeNextVisitDate,
} from '@/lib/visits'
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

  const drugWarnings = useMemo(() => {
    if (!patient) return []
    const draftEgfr = draft.labs.egfr ? Number(draft.labs.egfr.replace(',', '.')) : null
    const egfr = draftEgfr != null && !Number.isNaN(draftEgfr) ? draftEgfr : null
    return checkDrugWarnings(patient.medications, egfr)
  }, [patient, draft.labs.egfr])

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
      // Snapshot the prior template BEFORE awaiting Claude so we don't
      // race with a concurrent edit. We only commit the version push if
      // generation succeeds — failure leaves history untouched.
      const priorTemplate = draft.generated_template
      const priorTone = draft.tone
      const priorGuidelines = [...draft.guidelines_selected]
      const res = await generate.mutateAsync({ draft, patient_summary: summary })
      const versions = [...(draft.template_versions ?? [])]
      if (priorTemplate) {
        versions.unshift({
          template: priorTemplate,
          generated_at: new Date().toISOString(),
          tone: priorTone,
          guidelines_used: priorGuidelines,
        })
      }
      update({
        generated_template: res.template,
        template_versions: versions.slice(0, 10), // cap at 10 versions
      })
    } catch (err) {
      // Generation failed — do NOT mutate version history.
      setGenError(err instanceof Error ? err.message : 'שגיאה ביצירה')
    }
  }

  const restoreVersion = (idx: number) => {
    const v = draft.template_versions[idx]
    if (!v) return
    const remaining = draft.template_versions.filter((_, i) => i !== idx)
    const versions = [...remaining]
    if (draft.generated_template) {
      versions.unshift({
        template: draft.generated_template,
        generated_at: new Date().toISOString(),
        tone: draft.tone,
        guidelines_used: [...draft.guidelines_selected],
      })
    }
    update({
      generated_template: v.template,
      template_versions: versions.slice(0, 10),
      tone: v.tone,
      // Restore the guideline selection that produced this version.
      guidelines_selected: [...v.guidelines_used],
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {drugWarnings.length > 0 && (
        <DrugWarnings warnings={drugWarnings} />
      )}
      <section className="flex flex-col gap-2 rounded-[--radius-md] border border-border bg-surface p-6 shadow-[--shadow-sm]">
        <h3 className="text-xl font-bold tracking-tight text-text">סיכום</h3>
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

      <section className="flex flex-col gap-3 rounded-[--radius-md] border border-border bg-surface p-6 shadow-[--shadow-sm]">
        <h3 className="text-xl font-bold tracking-tight text-text">
          הנחיות לשימוש ביצירת השבלונה
        </h3>
        {activeGuidelines.length === 0 ? (
          <div role="alert" className="flex items-center gap-2 rounded-[--radius-md] border border-[--color-warning-fg]/30 bg-[--color-warning-bg] p-3 text-sm text-[--color-warning-fg]">
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

      <section className="grid gap-3 rounded-[--radius-md] border border-border bg-surface p-4 shadow-[--shadow-sm] sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="s3-tone" className="text-sm font-semibold text-text">
            טון השבלונה
          </label>
          <Select
            id="s3-tone"
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
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="s3-recall" className="text-sm font-semibold text-text">
            מועד ביקור הבא
          </label>
          <Select
            id="s3-recall"
            value={
              NEXT_VISIT_OPTIONS.find(
                (o) =>
                  computeNextVisitDate(o.value, new Date(draft.visit_date)) ===
                  draft.next_visit_due,
              )?.value ?? ''
            }
            onChange={(e) =>
              update({
                next_visit_due: computeNextVisitDate(
                  e.target.value,
                  new Date(draft.visit_date),
                ),
              })
            }
          >
            {NEXT_VISIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-text-muted">
            {draft.next_visit_due
              ? `יופיע ב"תור החזרות" של הדשבורד החל מ-${draft.next_visit_due}`
              : 'אופציונלי — מסייע לעקוב אחרי הביקור הבא'}
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <Button
          onClick={handleGenerate}
          loading={generate.isPending}
          disabled={
            draft.guidelines_selected.length === 0 ||
            activeGuidelines.length === 0
          }
          size="lg"
        >
          <Sparkles className="h-4 w-4" />
          {generate.isPending
            ? 'מייצר שבלונה...'
            : draft.generated_template
              ? 'צור מחדש'
              : 'צור שבלונה עם Claude AI'}
        </Button>
        {generate.isPending && (
          <div className="flex flex-col gap-2 rounded-[--radius-md] border border-border bg-[--color-info-bg] p-3">
            <Progress label="מייצר שבלונה עם Claude AI" />
            <p
              className="text-xs text-[--color-info-fg]"
              aria-live="polite"
            >
              Claude מנתח את ההנחיות ונתוני המטופל — 20-60 שניות.
            </p>
          </div>
        )}
        {genError && (
          <div
            role="alert"
            className="rounded-[--radius-md] border border-[--color-danger-fg]/20 bg-[--color-danger-bg] p-3 text-sm text-[--color-danger-fg]"
          >
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

      {draft.template_versions && draft.template_versions.length > 0 && (
        <section className="flex flex-col gap-2 rounded-[--radius-md] border border-border bg-[--color-surface-sunk] p-4">
          <h3 className="text-sm font-semibold tracking-tight text-text-muted">
            גרסאות קודמות ({draft.template_versions.length})
          </h3>
          <p className="text-xs text-text-muted">
            כל יצירה מחדש שומרת את הגרסה הקודמת. ניתן לשחזר.
          </p>
          <ul className="flex flex-col gap-1.5">
            {draft.template_versions.map((v, i) => (
              <li
                key={`${v.generated_at}-${i}`}
                className="flex items-center justify-between gap-2 rounded-[--radius-sm] border border-border bg-surface px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">
                    גרסה {draft.template_versions.length - i} ·{' '}
                    {TONE_LABELS[v.tone] ?? v.tone}
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(v.generated_at).toLocaleString('he-IL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}{' '}
                    · {v.guidelines_used.length} הנחיות · {v.template.length}{' '}
                    תווים
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restoreVersion(i)}
                  aria-label={`שחזר גרסה ${draft.template_versions.length - i}`}
                >
                  שחזר
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
