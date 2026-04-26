import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { VISIT_TYPE_LABELS, type VisitType } from '@/lib/visits'
import { usePatients } from '@/hooks/usePatients'
import type { Visit } from '@/types/database'

interface Props {
  visit: Visit | null
  onClose: () => void
}

export function VisitDetailDialog({ visit, onClose }: Props) {
  const { data: patients } = usePatients()
  const [copied, setCopied] = useState(false)

  if (!visit) return null
  const patient = patients?.find((p) => p.id === visit.patient_id)
  const template = visit.generated_template ?? '(לא נוצרה שבלונה)'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('שגיאה בהעתקה')
    }
  }

  return (
    <Dialog open={!!visit} onClose={onClose} title="פרטי ביקור">
      <div className="flex flex-col gap-4">
        <dl className="grid gap-2 rounded-md border border-border bg-muted p-4 text-sm sm:grid-cols-2">
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
              {VISIT_TYPE_LABELS[visit.visit_type as VisitType] ??
                visit.visit_type}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">תאריך</dt>
            <dd className="font-medium text-text">{visit.visit_date}</dd>
          </div>
          <div>
            <dt className="text-text-muted">נוצר ב</dt>
            <dd className="font-medium text-text">
              {new Date(visit.created_at).toLocaleString('he-IL')}
            </dd>
          </div>
        </dl>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text">השבלונה</h4>
          <Button onClick={handleCopy} size="sm" variant="outline">
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'הועתק' : 'העתק'}
          </Button>
        </div>

        <Textarea
          value={template}
          readOnly
          className="min-h-[400px] font-mono text-sm leading-relaxed"
          dir="rtl"
        />
      </div>
    </Dialog>
  )
}
