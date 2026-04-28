import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertOctagon,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  MessageSquare,
  Pill,
  Printer,
  RefreshCw,
  Sparkles,
  Stethoscope,
  TrendingDown,
  CalendarCheck,
} from 'lucide-react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { SkeletonCard } from '@/components/ui/skeleton'
import { DrugWarnings } from '@/components/patients/DrugWarnings'
import { Sparkline } from '@/components/ui/sparkline'
import { toast } from '@/components/ui/toaster'
import { usePatients } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { useGeneratePrepBrief } from '@/hooks/usePrepBrief'
import {
  todayISO,
  usePrepQueue,
  getCachedBrief,
  type PrepBriefData,
} from '@/lib/prep-queue'
import {
  getLatestEgfr,
  getPatientLabHistory,
} from '@/lib/lab-history'
import { checkDrugWarnings } from '@/lib/drug-rules'
import { conditionLabel, genderLabel } from '@/lib/patients'
import { cn } from '@/lib/utils'

type Category = PrepBriefData['action_items'][number]['category']

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  lab: <FlaskConical className="h-4 w-4" />,
  screening: <Stethoscope className="h-4 w-4" />,
  med: <Pill className="h-4 w-4" />,
  followup: <CalendarCheck className="h-4 w-4" />,
  other: <ClipboardCheck className="h-4 w-4" />,
}

const CATEGORY_LABELS: Record<Category, string> = {
  lab: 'מעבדה',
  screening: 'סקר',
  med: 'תרופות',
  followup: 'מעקב',
  other: 'אחר',
}

const TREND_KEYS = [
  { key: 'hba1c', label: 'HbA1c' },
  { key: 'systolic_bp', label: 'BP-S' },
  { key: 'ldl', label: 'LDL' },
  { key: 'egfr', label: 'eGFR' },
] as const

export function PrepBrief() {
  const { patientId } = useParams<{ patientId: string }>()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') ?? todayISO()
  const navigate = useNavigate()
  const { data: patients, isLoading: pLoading } = usePatients()
  const { data: visits } = useVisits()
  const { items, markPrepped, setReason } = usePrepQueue(date)
  const generate = useGeneratePrepBrief()
  const [brief, setBrief] = useState<PrepBriefData | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())

  const patient = patients?.find((p) => p.id === patientId)
  const queueItem = items.find((i) => i.patient_id === patientId)
  const inQueue = !!queueItem
  const isPrepped = !!queueItem?.prepped_at
  const reason = queueItem?.reason

  // Load cached brief on mount
  useEffect(() => {
    if (!patientId) return
    const cached = getCachedBrief(patientId, date)
    if (cached) {
      setBrief(cached.data)
      setGeneratedAt(cached.generated_at)
    }
  }, [patientId, date])

  const trends = useMemo(() => {
    if (!patientId) return []
    return TREND_KEYS.map((t) => ({
      ...t,
      points: getPatientLabHistory(visits, patientId, t.key),
    })).filter((t) => t.points.length > 0)
  }, [visits, patientId])

  const drugWarnings = useMemo(() => {
    if (!patient) return []
    const egfr = patientId ? getLatestEgfr(visits, patientId) : null
    return checkDrugWarnings(patient.medications, egfr)
  }, [patient, patientId, visits])

  const runGenerate = async () => {
    if (!patientId) return
    try {
      const res = await generate.mutateAsync({
        patient_id: patientId,
        reason,
        visit_date: date,
      })
      setBrief(res.brief)
      setGeneratedAt(new Date().toISOString())
      toast.success('התדריך נוצר')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'שגיאה ביצירת התדריך')
    }
  }

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (pLoading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!patient) {
    return (
      <EmptyState
        icon={<AlertOctagon className="h-5 w-5" />}
        title="המטופל לא נמצא"
        action={<Button onClick={() => navigate('/prep')}>חזרה לתור</Button>}
      />
    )
  }

  const displayName = patient.full_name || patient.initials || patient.patient_code

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { label: 'דשבורד', to: '/' },
            { label: 'הכנה לביקורים', to: '/prep' },
            { label: displayName },
          ]}
        />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3 print:gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tighter text-text print:text-2xl">
            {displayName}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span className="font-mono">{patient.patient_code}</span>
            {patient.age != null && <span>· גיל {patient.age}</span>}
            {patient.gender && <span>· {genderLabel(patient.gender)}</span>}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              ביקור צפוי: <span dir="ltr">{date}</span>
            </span>
          </div>
          {(patient.conditions?.length ?? 0) > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {patient.conditions!.map((c) => (
                <Badge key={c}>{conditionLabel(c)}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={!brief}
            aria-label="הדפסת תדריך"
          >
            <Printer className="h-4 w-4" />
            הדפס
          </Button>
          {inQueue && (
            <Button
              variant={isPrepped ? 'subtle' : 'outline'}
              onClick={() => markPrepped(patient.id, !isPrepped)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isPrepped ? 'הוכן' : 'סמן כהוכן'}
            </Button>
          )}
          <Button onClick={runGenerate} loading={generate.isPending}>
            {brief ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {brief ? 'יצירה מחדש' : 'הכן תדריך AI'}
          </Button>
        </div>
      </header>

      {drugWarnings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text-muted">
            אזהרות תרופתיות
          </h3>
          <DrugWarnings warnings={drugWarnings} />
        </section>
      )}

      {trends.length > 0 && (
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
          {trends.map((t) => {
            const latest = t.points[t.points.length - 1]
            const prev = t.points.length >= 2 ? t.points[t.points.length - 2] : null
            return (
              <div
                key={t.key}
                className="flex flex-col gap-1 rounded-[--radius-md] border border-border bg-surface p-3 shadow-[--shadow-sm] print:shadow-none"
              >
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{t.label}</span>
                  <span>{t.points.length} נק׳</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-text" dir="ltr">
                    {latest.value}
                  </span>
                  {prev && (
                    <span className="text-xs text-text-muted" dir="ltr">
                      <TrendingDown className="inline h-3 w-3" />{' '}
                      {(latest.value - prev.value).toFixed(1)}
                    </span>
                  )}
                </div>
                <Sparkline
                  data={t.points.map((p) => p.value)}
                  width={180}
                  height={28}
                  ariaLabel={`${t.label} over time`}
                />
              </div>
            )
          })}
        </section>
      )}

      {generate.isPending && (
        <div className="flex flex-col gap-2 rounded-[--radius-md] border border-border bg-[--color-info-bg] p-3">
          <Progress label="Claude מנתח את ההיסטוריה" />
          <p className="text-xs text-[--color-info-fg]" aria-live="polite">
            עורך את התדריך — 10-30 שניות.
          </p>
        </div>
      )}

      {!brief && !generate.isPending && (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="עדיין אין תדריך"
          description="לחץ על 'הכן תדריך AI' כדי ש-Claude יסכם את ההיסטוריה ויציע נקודות לבדיקה."
          action={
            <Button onClick={runGenerate}>
              <Sparkles className="h-4 w-4" />
              הכן תדריך AI
            </Button>
          }
        />
      )}

      {brief && (
        <article className="flex flex-col gap-4 print:gap-3">
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="סיבת הביקור"
          >
            <p className="text-sm">{brief.why_visit || '—'}</p>
            {reason && (
              <p className="mt-1 text-xs text-text-muted">
                (סיבה שהוזנה: {reason})
              </p>
            )}
          </Section>

          <Section
            icon={<FileText className="h-4 w-4" />}
            title="הסיפור עד עכשיו"
          >
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {brief.story_so_far || '—'}
            </p>
          </Section>

          {brief.what_changed.length > 0 && (
            <Section
              icon={<TrendingDown className="h-4 w-4" />}
              title={`מה השתנה (${brief.what_changed.length})`}
            >
              <ul className="flex flex-col gap-1.5 text-sm">
                {brief.what_changed.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 text-text-muted">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {brief.red_flags.length > 0 && (
            <section className="rounded-[--radius-md] border border-[--color-danger-fg]/30 bg-[--color-danger-bg] p-4 print:break-inside-avoid">
              <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-[--color-danger-fg]">
                <AlertOctagon className="h-4 w-4" />
                דגלים אדומים
              </h3>
              <ul className="flex flex-col gap-1.5 text-sm text-[--color-danger-fg]">
                {brief.red_flags.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden>⚠</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {brief.action_items.length > 0 && (
            <Section
              icon={<ClipboardCheck className="h-4 w-4" />}
              title={`פעולות (${brief.action_items.length})`}
            >
              <ul className="flex flex-col gap-1.5">
                {brief.action_items.map((a, i) => {
                  const checked = checkedItems.has(i)
                  return (
                    <li key={i}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-[--radius-sm] border border-border bg-muted p-2.5 transition-colors print:bg-transparent print:border-0 print:p-1',
                          checked && 'bg-[--color-success-bg]/40 line-through opacity-70',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheck(i)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
                        />
                        <span className="flex-1 text-sm">{a.text}</span>
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted print:bg-transparent">
                          {CATEGORY_ICONS[a.category]}
                          {CATEGORY_LABELS[a.category]}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {brief.discussion_points.length > 0 && (
            <Section
              icon={<MessageSquare className="h-4 w-4" />}
              title={`נקודות לשיחה (${brief.discussion_points.length})`}
            >
              <ul className="flex flex-col gap-1.5 text-sm">
                {brief.discussion_points.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 text-primary-500">→</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {generatedAt && (
            <p className="text-xs text-text-muted print:text-[10px]">
              נוצר ב-
              {new Date(generatedAt).toLocaleString('he-IL', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
              {' · '}
              <button
                type="button"
                onClick={() => {
                  if (!queueItem) return
                  const newReason = window.prompt('סיבת הביקור:', reason ?? '')
                  if (newReason !== null) {
                    setReason(patient.id, newReason)
                  }
                }}
                className="text-primary-700 hover:underline dark:text-primary-200 print:hidden"
              >
                ערוך סיבת ביקור
              </button>
            </p>
          )}
        </article>
      )}
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[--radius-md] border border-border bg-surface p-4 shadow-[--shadow-sm] print:break-inside-avoid print:shadow-none">
      <h3 className="mb-2 flex items-center gap-2 text-base font-semibold tracking-tight text-text">
        <span className="text-primary-500">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}
