import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Eye, Copy, Trash2, Star, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useDeleteVisit,
  useToggleVisitFavorite,
} from '@/hooks/useVisits'
import { useDraftVisit } from '@/hooks/useDraftVisit'
import { VISIT_TYPE_LABELS, type VisitType } from '@/lib/visits'
import { usePatients } from '@/hooks/usePatients'
import type { Patient, Visit } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  visit: Visit
  onView: (v: Visit) => void
  patient?: Patient
}

export function SavedVisitCard({ visit, onView, patient: patientProp }: Props) {
  const { data: patients } = usePatients()
  const del = useDeleteVisit()
  const toggleFav = useToggleVisitFavorite()
  const { setDraft } = useDraftVisit()
  const navigate = useNavigate()

  // Prefer prop (parent already looked up); else fallback to find.
  const patient = useMemo(
    () => patientProp ?? patients?.find((p) => p.id === visit.patient_id),
    [patientProp, patients, visit.patient_id],
  )

  const handleDelete = () => {
    if (!confirm('למחוק את הביקור הזה? פעולה זו אינה הפיכה.')) return
    del.mutate(visit.id)
  }

  const handleDuplicate = () => {
    const data = (visit.patient_data ?? {}) as {
      labs?: Record<string, string>
      vitals?: Record<string, string>
      anamnesis?: { symptoms?: string[]; free_text?: string }
    }
    setDraft({
      patient_id: visit.patient_id,
      visit_type: visit.visit_type as VisitType,
      visit_date: new Date().toISOString().slice(0, 10),
      template_id: null,
      labs: data.labs ?? {},
      vitals: data.vitals ?? {},
      anamnesis: {
        symptoms: data.anamnesis?.symptoms ?? [],
        free_text: data.anamnesis?.free_text,
      },
      guidelines_selected: visit.guidelines_used ?? [],
      generated_template: null,
      tone: 'standard',
    })
    navigate('/visit/new')
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
      <button
        onClick={() => onView(visit)}
        className="flex min-w-0 flex-1 items-center gap-3 text-right"
      >
        <FileText className="h-5 w-5 shrink-0 text-primary-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-text">
              {patient
                ? `${patient.patient_code} — ${patient.initials}`
                : '(מטופל לא ידוע)'}
            </span>
            <Badge>
              {VISIT_TYPE_LABELS[visit.visit_type as VisitType] ??
                visit.visit_type}
            </Badge>
            {visit.generated_template ? (
              <Badge variant="success">עם שבלונה</Badge>
            ) : (
              <Badge variant="warning">ללא שבלונה</Badge>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {visit.visit_date} ·{' '}
            {new Date(visit.created_at).toLocaleString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleFav.mutate(visit)}
          disabled={toggleFav.isPending}
          title={visit.is_favorite ? 'הסר מועדף' : 'סמן מועדף'}
          aria-label={visit.is_favorite ? 'הסר מועדף' : 'סמן מועדף'}
          aria-pressed={visit.is_favorite}
        >
          <Star
            className={cn(
              'h-4 w-4',
              visit.is_favorite &&
                'fill-amber-500 text-amber-500 dark:fill-amber-300 dark:text-amber-300',
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(visit)}
          title="צפה"
          aria-label="צפה בביקור"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDuplicate}
          title="שכפל לביקור חדש"
          aria-label="שכפל לביקור חדש"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={del.isPending}
          title="מחק"
          aria-label="מחק ביקור"
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
