import { useState } from 'react'
import { User, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDeletePatient } from '@/hooks/usePatients'
import { conditionLabel, genderLabel } from '@/lib/patients'
import { PatientForm } from './PatientForm'
import type { Patient } from '@/types/database'

export function PatientCard({ patient }: { patient: Patient }) {
  const [isEditing, setIsEditing] = useState(false)
  const del = useDeletePatient()

  if (isEditing) {
    return (
      <PatientForm
        patient={patient}
        onDone={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  const handleDelete = () => {
    if (
      !confirm(
        `למחוק את המטופל ${patient.patient_code} (${patient.initials})? כל הביקורים והמסמכים שלו יימחקו גם הם.`,
      )
    )
      return
    del.mutate(patient.id)
  }

  const conditions = patient.conditions ?? []
  const meds = patient.medications ?? []

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface p-4">
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
          onClick={() => setIsEditing(true)}
          title="ערוך"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={del.isPending}
          title="מחק"
        >
          {del.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-danger" />
          )}
        </Button>
      </div>
    </div>
  )
}
