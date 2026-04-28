import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { usePatients } from '@/hooks/usePatients'
import { VISIT_TYPES, VISIT_TYPE_LABELS } from '@/lib/visits'
import type { VisitDraft, VisitType } from '@/lib/visits'
import { Link } from 'react-router-dom'

interface Props {
  draft: VisitDraft
  update: (patch: Partial<VisitDraft>) => void
}

export function Step1Patient({ draft, update }: Props) {
  const { data: patients, isLoading } = usePatients()
  const missingPatient = !draft.patient_id
  const missingVisitType = !draft.visit_type

  return (
    <div className="flex flex-col gap-4 rounded-[--radius-md] border border-border bg-surface p-6 shadow-[--shadow-sm]">
      <h3 className="text-xl font-bold tracking-tight text-text">
        בחירת מטופל וסוג ביקור
      </h3>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="s1-patient" className="text-sm font-medium text-text">
          מטופל <span aria-hidden className="text-[--color-danger-fg]">*</span>
        </label>
        {isLoading ? (
          <p className="text-sm text-text-muted">טוען...</p>
        ) : (patients?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-muted">
            אין מטופלים.{' '}
            <Link
              to="/patients"
              className="text-primary-700 hover:underline dark:text-primary-200"
            >
              הוסף מטופל ראשון
            </Link>
          </p>
        ) : (
          <Select
            id="s1-patient"
            value={draft.patient_id ?? ''}
            aria-invalid={missingPatient}
            aria-describedby={missingPatient ? 's1-patient-hint' : undefined}
            onChange={(e) => update({ patient_id: e.target.value || null })}
          >
            <option value="">— בחר —</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.patient_code} — {p.full_name || p.initials}
                {p.age ? ` (${p.age})` : ''}
              </option>
            ))}
          </Select>
        )}
        {missingPatient && (patients?.length ?? 0) > 0 && (
          <p id="s1-patient-hint" className="text-xs text-text-muted">
            יש לבחור מטופל לפני המעבר לשלב הבא.
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="s1-visit-type" className="text-sm font-medium text-text">
            סוג ביקור <span aria-hidden className="text-[--color-danger-fg]">*</span>
          </label>
          <Select
            id="s1-visit-type"
            value={draft.visit_type ?? ''}
            aria-invalid={missingVisitType}
            aria-describedby={missingVisitType ? 's1-visit-type-hint' : undefined}
            onChange={(e) =>
              update({
                visit_type: (e.target.value || null) as VisitType | null,
                generated_template: null,
              })
            }
          >
            <option value="">— בחר —</option>
            {VISIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {VISIT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          {missingVisitType && (
            <p id="s1-visit-type-hint" className="text-xs text-text-muted">
              סוג הביקור משפיע על ההנחיות שיוצעו בשלב 3.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="s1-visit-date" className="text-sm font-medium text-text">תאריך ביקור</label>
          <Input
            id="s1-visit-date"
            type="date"
            value={draft.visit_date}
            onChange={(e) => update({ visit_date: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
