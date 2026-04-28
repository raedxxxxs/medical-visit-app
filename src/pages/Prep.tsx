import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Calendar,
  CheckCircle2,
  X,
  ClipboardList,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { SkeletonRow } from '@/components/ui/skeleton'
import { Dialog } from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/search-input'
import { usePatients } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import {
  todayISO,
  usePrepQueue,
  getCachedBrief,
} from '@/lib/prep-queue'
import { conditionLabel } from '@/lib/patients'
import { cn } from '@/lib/utils'

export function Prep() {
  const navigate = useNavigate()
  const [date, setDate] = useState<string>(todayISO())
  const { items, addPatient, removePatient, markPrepped, setReason } =
    usePrepQueue(date)
  const { data: patients, isLoading: pLoading } = usePatients()
  const { data: visits } = useVisits()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const queueWithPatients = useMemo(() => {
    return items
      .map((item) => {
        const patient = patients?.find((p) => p.id === item.patient_id)
        if (!patient) return null
        return { item, patient }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [items, patients])

  const summary = useMemo(() => {
    const total = queueWithPatients.length
    const prepped = queueWithPatients.filter((q) => q.item.prepped_at).length
    return { total, prepped, pending: total - prepped }
  }, [queueWithPatients])

  const eligibleToAdd = useMemo(() => {
    if (!patients) return []
    const inQueue = new Set(items.map((i) => i.patient_id))
    let list = patients.filter((p) => !inQueue.has(p.id))
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase()
      list = list.filter((p) =>
        [p.patient_code, p.full_name, p.initials, p.notes]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q)),
      )
    }
    return list
  }, [patients, items, pickerSearch])

  const isToday = date === todayISO()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text">
            הכנה לביקורים
          </h2>
          <p className="text-text-muted">
            תור הכנה ל-{isToday ? 'היום' : date}. כל מטופל בתור מקבל תדריך AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="תאריך תור הכנה"
            className="w-auto"
          />
          <Button onClick={() => setPickerOpen(true)} disabled={pLoading}>
            <Plus className="h-4 w-4" />
            הוסף מטופל
          </Button>
        </div>
      </div>

      {summary.total > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryStat label="סה״כ בתור" value={summary.total} icon={<ClipboardList className="h-4 w-4" />} />
          <SummaryStat
            label="הוכנו"
            value={summary.prepped}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          />
          <SummaryStat
            label="ממתינים"
            value={summary.pending}
            icon={<Calendar className="h-4 w-4" />}
            tone="warning"
          />
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>תור היום ({summary.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {pLoading ? (
            <div className="flex flex-col gap-2">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : queueWithPatients.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="התור ריק"
              description={
                isToday
                  ? 'הוסף מטופלים שאתה מתכוון לראות היום כדי להכין תדריכים.'
                  : 'התור לתאריך זה ריק.'
              }
              action={
                <Button onClick={() => setPickerOpen(true)} size="sm">
                  <Plus className="h-4 w-4" />
                  הוסף מטופל
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {queueWithPatients.map(({ item, patient }, i) => {
                const cached = getCachedBrief(patient.id, date)
                const isPrepped = !!item.prepped_at
                return (
                  <li
                    key={item.patient_id}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className={cn(
                      'flex animate-fade-in-up flex-wrap items-start justify-between gap-3 rounded-[--radius-md] border border-border bg-surface p-4 transition-colors',
                      isPrepped && 'bg-[--color-success-bg]/30',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/prep/${patient.id}?date=${date}`}
                          className="text-base font-semibold text-text hover:underline"
                        >
                          {patient.full_name || patient.initials || patient.patient_code}
                        </Link>
                        <span className="font-mono text-xs text-text-muted">
                          {patient.patient_code}
                        </span>
                        {isPrepped && (
                          <Badge variant="success">
                            <CheckCircle2 className="me-1 h-3 w-3" />
                            הוכן
                          </Badge>
                        )}
                        {cached && !isPrepped && (
                          <Badge variant="info">תדריך מוכן</Badge>
                        )}
                      </div>
                      {(patient.conditions?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {patient.conditions!.slice(0, 4).map((c) => (
                            <Badge key={c} variant="neutral">
                              {conditionLabel(c)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Input
                        placeholder="סיבת הביקור (אופציונלי)"
                        defaultValue={item.reason ?? ''}
                        onBlur={(e) => setReason(item.patient_id, e.target.value)}
                        aria-label={`סיבת ביקור ל-${patient.full_name || patient.initials}`}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/prep/${patient.id}?date=${date}`)}
                      >
                        <Sparkles className="h-4 w-4" />
                        {cached ? 'פתח תדריך' : 'הכן תדריך'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markPrepped(item.patient_id, !isPrepped)}
                        title={isPrepped ? 'סמן כלא הוכן' : 'סמן כהוכן'}
                        aria-label={isPrepped ? 'סמן כלא הוכן' : 'סמן כהוכן'}
                      >
                        <CheckCircle2
                          className={cn(
                            'h-4 w-4',
                            isPrepped ? 'text-[--color-success-fg]' : 'text-text-muted',
                          )}
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePatient(item.patient_id)}
                        title="הסר מהתור"
                        aria-label="הסר מהתור"
                      >
                        <X className="h-4 w-4 text-text-muted" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          setPickerSearch('')
        }}
        title="הוסף מטופל לתור הכנה"
      >
        <div className="flex flex-col gap-3">
          <SearchInput
            value={pickerSearch}
            onValueChange={setPickerSearch}
            placeholder="חיפוש לפי קוד / שם / ראשי תיבות..."
            aria-label="חפש מטופל להוספה"
          />
          {(visits?.length ?? 0) > 0 && pickerSearch.length === 0 && (
            <p className="text-xs text-text-muted">
              <Search className="me-1 inline h-3 w-3" />
              {patients?.length ?? 0} מטופלים. סנן בחיפוש למעלה.
            </p>
          )}
          <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
            {eligibleToAdd.length === 0 ? (
              <li className="rounded-[--radius-sm] bg-muted p-3 text-center text-sm text-text-muted">
                {pickerSearch ? 'אין תוצאות' : 'כל המטופלים כבר בתור'}
              </li>
            ) : (
              eligibleToAdd.slice(0, 30).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      addPatient(p.id)
                      setPickerOpen(false)
                      setPickerSearch('')
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-[--radius-sm] px-3 py-2 text-start hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">
                        {p.full_name || p.initials || p.patient_code}
                      </p>
                      <p className="font-mono text-xs text-text-muted">{p.patient_code}</p>
                    </div>
                    <Plus className="h-4 w-4 text-text-muted" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </Dialog>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-[--color-success-fg]/20 bg-[--color-success-bg]'
      : tone === 'warning'
        ? 'border-[--color-warning-fg]/20 bg-[--color-warning-bg]'
        : 'border-border bg-surface'
  const valueClass =
    tone === 'success'
      ? 'text-[--color-success-fg]'
      : tone === 'warning'
        ? 'text-[--color-warning-fg]'
        : 'text-primary-700 dark:text-primary-200'
  return (
    <div className={cn('flex items-center gap-3 rounded-[--radius-md] border p-4 shadow-[--shadow-sm]', toneClass)}>
      <div className="text-text-muted">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-text-muted">{label}</p>
        <p className={cn('text-2xl font-bold tracking-tight', valueClass)}>{value}</p>
      </div>
    </div>
  )
}
