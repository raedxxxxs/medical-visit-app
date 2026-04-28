import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Users,
  FilePlus2,
  History,
  Plus,
  AlertCircle,
  CalendarClock,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { BarMini, Donut } from '@/components/ui/sparkline'
import { useGuidelines } from '@/hooks/useGuidelines'
import { usePatients } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { VISIT_TYPE_LABELS, type VisitType } from '@/lib/visits'
import { CATEGORY_LABELS } from '@/lib/guidelines'
import type { GuidelineCategory, Visit } from '@/types/database'
import { VisitDetailDialog } from '@/components/templates/VisitDetailDialog'

export function Dashboard() {
  const navigate = useNavigate()
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const { data: guidelines, isLoading: gLoading } = useGuidelines()
  const { data: patients, isLoading: pLoading } = usePatients()
  const { data: visits, isLoading: vLoading } = useVisits()

  const stats = useMemo(() => {
    const activeGuidelines = (guidelines ?? []).filter((g) => g.is_active)
    const guidelinesByCategory = new Map<GuidelineCategory, number>()
    for (const g of activeGuidelines) {
      guidelinesByCategory.set(
        g.category,
        (guidelinesByCategory.get(g.category) ?? 0) + 1,
      )
    }

    const recentVisits = (visits ?? []).slice(0, 5)

    const last30 = Date.now() - 30 * 24 * 60 * 60 * 1000
    const visitsLast30 = (visits ?? []).filter(
      (v) => new Date(v.created_at).getTime() >= last30,
    ).length

    const visitsByType = new Map<string, number>()
    for (const v of visits ?? []) {
      visitsByType.set(v.visit_type, (visitsByType.get(v.visit_type) ?? 0) + 1)
    }

    const guidelinesNeedingText = (guidelines ?? []).filter(
      (g) => g.is_active && !g.extracted_text,
    ).length

    // Recall queue: latest visit per patient with non-null next_visit_due
    const today = new Date().toISOString().slice(0, 10)
    const latestByPatient = new Map<string, Visit>()
    for (const v of visits ?? []) {
      const prev = latestByPatient.get(v.patient_id)
      if (!prev || new Date(v.visit_date) > new Date(prev.visit_date)) {
        latestByPatient.set(v.patient_id, v)
      }
    }
    const recall: { visit: Visit; due: string; overdue: boolean }[] = []
    for (const v of latestByPatient.values()) {
      const due = (v.patient_data as { next_visit_due?: string } | null)?.next_visit_due
      if (!due) continue
      recall.push({ visit: v, due, overdue: due <= today })
    }
    recall.sort((a, b) => a.due.localeCompare(b.due))

    return {
      totalGuidelines: guidelines?.length ?? 0,
      activeGuidelines: activeGuidelines.length,
      guidelinesByCategory,
      totalPatients: patients?.length ?? 0,
      totalVisits: visits?.length ?? 0,
      visitsLast30,
      recentVisits,
      visitsByType,
      guidelinesNeedingText,
      recall,
    }
  }, [guidelines, patients, visits])

  const isLoading = gLoading || pLoading || vLoading

  const visitsByTypeData = useMemo(
    () =>
      Array.from(stats.visitsByType.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([type, value]) => ({
          label: VISIT_TYPE_LABELS[type as VisitType] ?? type,
          value,
        })),
    [stats.visitsByType],
  )

  const guidelinesByCategoryData = useMemo(
    () =>
      Array.from(stats.guidelinesByCategory.entries()).map(([cat, value]) => ({
        label: CATEGORY_LABELS[cat],
        value,
      })),
    [stats.guidelinesByCategory],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text">דשבורד</h2>
          <p className="text-text-muted">סקירה כללית של המערכת</p>
        </div>
        <Button size="lg" onClick={() => navigate('/visit/new')}>
          <Plus className="h-4 w-4" />
          ביקור חדש
        </Button>
      </div>

      {stats.guidelinesNeedingText > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[--radius-md] border border-[--color-warning-fg]/20 bg-[--color-warning-bg] p-3 text-sm text-[--color-warning-fg] animate-fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {stats.guidelinesNeedingText} הנחיות פעילות ללא טקסט חולץ.
          </span>
          <Link
            to="/guidelines"
            className="font-semibold underline hover:no-underline"
          >
            לחץ לחלץ
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              icon={<BookOpen className="h-4 w-4" />}
              label="הנחיות פעילות"
              value={stats.activeGuidelines}
              subtitle={
                stats.totalGuidelines > stats.activeGuidelines
                  ? `מתוך ${stats.totalGuidelines}`
                  : undefined
              }
              to="/guidelines"
              delay={0}
            />
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="מטופלים"
              value={stats.totalPatients}
              to="/patients"
              delay={60}
            />
            <StatCard
              icon={<History className="h-4 w-4" />}
              label="ביקורים שמורים"
              value={stats.totalVisits}
              subtitle={
                stats.visitsLast30 > 0
                  ? `${stats.visitsLast30} ב-30 הימים האחרונים`
                  : undefined
              }
              to="/templates"
              delay={120}
            />
            <StatCard
              icon={<FilePlus2 className="h-4 w-4" />}
              label="ביקור חדש"
              value=""
              subtitle="התחל ביקור עכשיו"
              to="/visit/new"
              accent
              delay={180}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ביקורים אחרונים</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex flex-col gap-2">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            )}
            {!isLoading && stats.recentVisits.length === 0 && (
              <EmptyState
                icon={<History className="h-5 w-5" />}
                title="אין ביקורים שמורים"
                description="התחל את הביקור הראשון שלך כדי לראות אותו כאן."
                action={
                  <Button size="sm" onClick={() => navigate('/visit/new')}>
                    <Plus className="h-4 w-4" />
                    ביקור חדש
                  </Button>
                }
              />
            )}
            <div className="flex flex-col gap-2">
              {stats.recentVisits.map((v, i) => {
                const patient = patients?.find((p) => p.id === v.patient_id)
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVisit(v)}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="flex animate-fade-in-up items-center justify-between gap-2 rounded-[--radius-sm] border border-border bg-muted p-3 text-start transition-colors hover:bg-[--color-surface-sunk]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-text">
                          {patient
                            ? `${patient.patient_code} — ${patient.initials}`
                            : '(מטופל לא ידוע)'}
                        </span>
                        <Badge>
                          {VISIT_TYPE_LABELS[v.visit_type as VisitType] ??
                            v.visit_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted">{v.visit_date}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>הנחיות פעילות לפי קטגוריה</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <SkeletonCard />}
            {!isLoading && stats.activeGuidelines === 0 && (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="אין הנחיות פעילות"
                description="הוסף הנחיות פעילות כדי שייעשה בהן שימוש בייצור שבלונות."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/guidelines')}
                  >
                    הוסף הנחיה
                  </Button>
                }
              />
            )}
            {!isLoading && stats.activeGuidelines > 0 && (
              <Donut data={guidelinesByCategoryData} ariaLabel="הנחיות פעילות לפי קטגוריה" />
            )}
          </CardContent>
        </Card>
      </div>

      {stats.recall.length > 0 && (
        <section className="rounded-[--radius-md] border border-border bg-[--color-surface-sunk] p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary-500" />
            <h3 className="text-sm font-semibold tracking-tight text-text">
              תור החזרות ({stats.recall.length})
            </h3>
          </div>
          <ul className="flex flex-col gap-1.5">
            {stats.recall.slice(0, 8).map(({ visit, due, overdue }) => {
              const patient = patients?.find((p) => p.id === visit.patient_id)
              return (
                <li
                  key={visit.id}
                  className="flex items-center justify-between gap-3 rounded-[--radius-sm] border border-border bg-surface px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">
                      {patient
                        ? `${patient.patient_code} — ${patient.initials}`
                        : '(מטופל לא ידוע)'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {VISIT_TYPE_LABELS[visit.visit_type as VisitType] ??
                        visit.visit_type}{' '}
                      · ביקור אחרון {visit.visit_date}
                    </p>
                  </div>
                  <Badge variant={overdue ? 'danger' : 'neutral'}>
                    {overdue ? 'באיחור' : 'בקרוב'} · <span dir="ltr">{due}</span>
                  </Badge>
                </li>
              )
            })}
          </ul>
          {stats.recall.length > 8 && (
            <p className="mt-2 text-xs text-text-muted">
              ועוד {stats.recall.length - 8} מטופלים בתור.
            </p>
          )}
        </section>
      )}

      {visitsByTypeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ביקורים לפי סוג</CardTitle>
          </CardHeader>
          <CardContent>
            <BarMini data={visitsByTypeData} ariaLabel="ביקורים לפי סוג" />
          </CardContent>
        </Card>
      )}

      <VisitDetailDialog
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  to,
  accent,
  delay = 0,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  subtitle?: string
  to: string
  accent?: boolean
  delay?: number
}) {
  return (
    <Link
      to={to}
      style={{ animationDelay: `${delay}ms` }}
      className={
        (accent
          ? 'border-primary-300 bg-primary-50 hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-900/40 dark:hover:bg-primary-900/60'
          : 'border-border bg-surface hover:bg-muted hover:shadow-[--shadow-md]') +
        ' group block animate-fade-in-up rounded-[--radius-md] border p-5 shadow-[--shadow-sm] transition-all duration-200 hover:-translate-y-0.5'
      }
    >
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-primary-700 dark:text-primary-200">
        {value}
      </div>
      {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
    </Link>
  )
}
