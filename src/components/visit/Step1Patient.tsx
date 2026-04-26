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

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <h3 className="text-lg font-semibold text-text">
        בחירת מטופל וסוג ביקור
      </h3>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">מטופל *</label>
        {isLoading ? (
          <p className="text-sm text-text-muted">טוען...</p>
        ) : (patients?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-muted">
            אין מטופלים.{' '}
            <Link
              to="/patients"
              className="text-primary-600 hover:underline dark:text-primary-300"
            >
              הוסף מטופל ראשון
            </Link>
          </p>
        ) : (
          <Select
            value={draft.patient_id ?? ''}
            onChange={(e) => update({ patient_id: e.target.value || null })}
          >
            <option value="">— בחר —</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.patient_code} — {p.initials}
                {p.age ? ` (${p.age})` : ''}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">סוג ביקור *</label>
          <Select
            value={draft.visit_type ?? ''}
            onChange={(e) =>
              update({
                visit_type: (e.target.value || null) as VisitType | null,
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
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">תאריך ביקור</label>
          <Input
            type="date"
            value={draft.visit_date}
            onChange={(e) => update({ visit_date: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
