import { useState } from 'react'
import { User, Pencil, Trash2, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toaster'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useDeletePatient } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { conditionLabel, genderLabel } from '@/lib/patients'
import { getLatestEgfr } from '@/lib/lab-history'
import { checkDrugWarnings } from '@/lib/drug-rules'
import { PatientForm } from './PatientForm'
import { DrugWarnings } from './DrugWarnings'
import type { Patient } from '@/types/database'

export function PatientCard({ patient }: { patient: Patient }) {
  const [isEditing, setIsEditing] = useState(false)
  const del = useDeletePatient()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { data: visits } = useVisits()
  const egfr = getLatestEgfr(visits, patient.id)
  const drugWarnings = checkDrugWarnings(patient.medications, egfr)

  if (isEditing) {
    return (
      <PatientForm
        patient={patient}
        onDone={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'מחיקת מטופל',
      message: `למחוק את המטופל ${patient.patient_code} (${patient.initials})? כל הביקורים שלו יימחקו גם הם.`,
      confirmLabel: 'מחק מטופל',
      danger: true,
    })
    if (!ok) return
    del.mutate(patient.id, {
      onSuccess: () => toast.success('המטופל נמחק'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'שגיאה במחיקה'),
    })
  }

  const conditions = patient.conditions ?? []
  const meds = patient.medications ?? []

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[--radius-md] border border-border bg-surface p-4 transition-colors hover:bg-muted">
      <div className="flex min-w-0 items-start gap-3">
        <div className="rounded-full bg-primary-50 p-2 dark:bg-primary-900/40">
          <User className="h-5 w-5 text-primary-600 dark:text-primary-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-text">
              {patient.patient_code}
            </span>
            <span className="font-medium text-text">{patient.initials}</span>
            {patient.age != null && (
              <span className="text-sm text-text-muted">· {patient.age}</span>
            )}
            {patient.gender && (
              <span className="text-sm text-text-muted">
                · {genderLabel(patient.gender)}
              </span>
            )}
          </div>
          {conditions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {conditions.map((c) => (
                <Badge key={c}>{conditionLabel(c)}</Badge>
              ))}
            </div>
          )}
          {meds.length > 0 && (
            <p className="mt-2 text-xs text-text-muted" dir="ltr">
              {meds.join(', ')}
            </p>
          )}
          {patient.notes && (
            <p className="mt-2 text-sm text-text-muted">{patient.notes}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/patients/${patient.id}`)}
          title="פתח כרטיס מטופל"
          aria-label="פתח כרטיס מטופל"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          title="ערוך"
          aria-label="ערוך מטופל"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          loading={del.isPending}
          title="מחק"
          aria-label="מחק מטופל"
        >
          <Trash2 className="h-4 w-4 text-[--color-danger-fg]" />
        </Button>
      </div>
      {drugWarnings.length > 0 && (
        <div className="basis-full">
          <DrugWarnings warnings={drugWarnings} compact />
        </div>
      )}
    </div>
  )
}
