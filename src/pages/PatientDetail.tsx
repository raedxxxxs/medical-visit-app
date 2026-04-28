import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  FileText,
  CalendarClock,
  TrendingDown,
  TrendingUp,
  Minus,
  Pill,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Sparkline } from '@/components/ui/sparkline'
import { SkeletonCard } from '@/components/ui/skeleton'
import { DrugWarnings } from '@/components/patients/DrugWarnings'
import { usePatients } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { conditionLabel, genderLabel } from '@/lib/patients'
import {
  VISIT_TYPE_LABELS,
  type VisitType,
} from '@/lib/visits'
import {
  getPatientLabHistory,
  getLatestEgfr,
  trendDirection,
  type LabPoint,
} from '@/lib/lab-history'
import { checkDrugWarnings } from '@/lib/drug-rules'

const TREND_SERIES: {
  key: string
  label: string
  unit: string
  goodDirection: 'down' | 'up' | 'flat'
}[] = [
  { key: 'hba1c', label: 'HbA1c', unit: '%', goodDirection: 'down' },
  { key: 'systolic_bp', label: 'ל"ד סיסטולי', unit: 'mmHg', goodDirection: 'down' },
  { key: 'diastolic_bp', label: 'ל"ד דיאסטולי', unit: 'mmHg', goodDirection: 'down' },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', goodDirection: 'down' },
  { key: 'egfr', label: 'eGFR', unit: 'mL/min', goodDirection: 'flat' },
  { key: 'weight', label: 'משקל', unit: 'ק"ג', goodDirection: 'flat' },
]

export function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: patients, isLoading: pLoading } = usePatients()
  const { data: visits, isLoading: vLoading } = useVisits()

  const patient = patients?.find((p) => p.id === id)
  const patientVisits = useMemo(
    () => (visits ?? []).filter((v) => v.patient_id === id),
    [visits, id],
  )

  const trends = useMemo(() => {
    if (!id) return []
    return TREND_SERIES.map((s) => {
      const points = getPatientLabHistory(visits, id, s.key)
      return { ...s, points }
    }).filter((s) => s.points.length > 0)
  }, [visits, id])

  const latestEgfr = useMemo(
    () => (id ? getLatestEgfr(visits, id) : null),
    [visits, id],
  )
  const drugWarnings = useMemo(() => {
    if (!patient) return []
    return checkDrugWarnings(patient.medications, latestEgfr)
  }, [patient, latestEgfr])

  const nextVisitDue = useMemo(() => {
    let latest: { due: string | null; visit_date: string } | null = null
    for (const v of patientVisits) {
      const due = (v.patient_data as { next_visit_due?: string } | null)
        ?.next_visit_due
      if (due) {
        if (!latest || v.visit_date > latest.visit_date) {
          latest = { due, visit_date: v.visit_date }
        }
      }
    }
    return latest?.due ?? null
  }, [patientVisits])

  if (pLoading || vLoading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: 'דשבורד', to: '/' },
            { label: 'מטופלים', to: '/patients' },
            { label: '(לא נמצא)' },
          ]}
        />
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" />}
          title="המטופל לא נמצא"
          description="ייתכן שהמטופל נמחק או שהקישור שגוי."
          action={
            <Button onClick={() => navigate('/patients')}>
              חזור לרשימת המטופלים
            </Button>
          }
        />
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const overdue = nextVisitDue !== null && nextVisitDue <= today

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: 'דשבורד', to: '/' },
          { label: 'מטופלים', to: '/patients' },
          {
            label:
              patient.full_name ||
              `${patient.patient_code} — ${patient.initials ?? ''}`,
          },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tighter text-text">
            {patient.full_name || patient.initials || patient.patient_code}
          </h2>
          <p className="text-sm font-mono text-text-muted">
            {patient.patient_code}
            {patient.full_name && patient.initials && ` · ${patient.initials}`}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {patient.age != null && <span>גיל {patient.age}</span>}
            {patient.gender && <span>· {genderLabel(patient.gender)}</span>}
            {nextVisitDue && (
              <Badge variant={overdue ? 'danger' : 'info'}>
                <CalendarClock className="me-1 h-3 w-3" />
                {overdue ? 'תור באיחור' : 'תור הבא'} ·{' '}
                <span dir="ltr">{nextVisitDue}</span>
              </Badge>
            )}
          </div>
          {(patient.conditions?.length ?? 0) > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {patient.conditions!.map((c) => (
                <Badge key={c}>{conditionLabel(c)}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/patients?edit=${patient.id}`)}
          >
            <Pencil className="h-4 w-4" />
            ערוך
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/prep/${patient.id}`)}
          >
            <Sparkles className="h-4 w-4" />
            הכן תדריך
          </Button>
          <Button onClick={() => navigate('/visit/new')}>
            <FileText className="h-4 w-4" />
            ביקור חדש למטופל
          </Button>
        </div>
      </header>

      {drugWarnings.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text-muted">
            אזהרות תרופתיות ({drugWarnings.length})
          </h3>
          <DrugWarnings warnings={drugWarnings} />
        </section>
      )}

      {trends.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trends.map((t) => (
            <TrendCard
              key={t.key}
              label={t.label}
              unit={t.unit}
              points={t.points}
              goodDirection={t.goodDirection}
            />
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>היסטוריית ביקורים ({patientVisits.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {patientVisits.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="אין ביקורים"
                description="התחל ביקור חדש למטופל זה."
                action={
                  <Button size="sm" onClick={() => navigate('/visit/new')}>
                    ביקור חדש
                  </Button>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {patientVisits
                  .slice()
                  .sort((a, b) => b.visit_date.localeCompare(a.visit_date))
                  .map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 rounded-[--radius-sm] border border-border bg-muted px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-text">
                            {VISIT_TYPE_LABELS[v.visit_type as VisitType] ??
                              v.visit_type}
                          </span>
                          {v.is_favorite && (
                            <Badge variant="warning">מועדף</Badge>
                          )}
                          {!v.generated_template && (
                            <Badge variant="neutral">ללא שבלונה</Badge>
                          )}
                        </div>
                        <p className="text-xs text-text-muted" dir="ltr">
                          {v.visit_date}
                        </p>
                      </div>
                      <Link
                        to="/templates"
                        className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-200"
                      >
                        פתח בשבלונות
                        <ArrowLeft className="ms-1 inline h-3 w-3 rtl:rotate-180" />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary-500" />
              תרופות ({patient.medications?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(patient.medications?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-muted">אין תרופות רשומות.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {patient.medications!.map((m, i) => (
                  <li
                    key={i}
                    dir="ltr"
                    className="rounded-[--radius-sm] border border-border bg-muted px-3 py-1.5 text-sm text-text"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            )}
            {patient.notes && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold text-text-muted">
                  הערות
                </p>
                <p className="text-sm text-text whitespace-pre-wrap">
                  {patient.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TrendCard({
  label,
  unit,
  points,
  goodDirection,
}: {
  label: string
  unit: string
  points: LabPoint[]
  goodDirection: 'down' | 'up' | 'flat'
}) {
  const latest = points[points.length - 1]
  const prev = points.length >= 2 ? points[points.length - 2] : null
  const dir = trendDirection(points)
  const TrendIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus
  const trendIsGood =
    goodDirection === 'flat'
      ? dir === 'flat'
      : goodDirection === dir
  const trendColor =
    dir === 'flat'
      ? 'text-text-muted'
      : trendIsGood
        ? 'text-[--color-success-fg]'
        : 'text-[--color-warning-fg]'

  return (
    <div className="flex flex-col gap-2 rounded-[--radius-md] border border-border bg-surface p-4 shadow-[--shadow-sm]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          {points.length} מדידות
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-text" dir="ltr">
          {latest.value}
        </span>
        <span className="text-xs text-text-muted">{unit}</span>
        {prev && (
          <span className="ms-auto text-xs text-text-muted" dir="ltr">
            {prev.value > latest.value ? '↓' : prev.value < latest.value ? '↑' : '→'}{' '}
            {Math.abs(latest.value - prev.value).toFixed(1)}
          </span>
        )}
      </div>
      <Sparkline
        data={points.map((p) => p.value)}
        width={240}
        height={36}
        ariaLabel={`גרף ${label} לאורך זמן`}
      />
      <p className="text-xs text-text-muted" dir="ltr">
        {points[0].date} → {latest.date}
      </p>
    </div>
  )
}
