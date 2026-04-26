import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Users,
  FilePlus2,
  History,
  Plus,
  AlertCircle,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGuidelines } from '@/hooks/useGuidelines'
import { usePatients } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { VISIT_TYPE_LABELS, type VisitType } from '@/lib/visits'
import { CATEGORY_LABELS } from '@/lib/guidelines'
import type { GuidelineCategory } from '@/types/database'

export function Dashboard() {
  const navigate = useNavigate()
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
    }
  }, [guidelines, patients, visits])

  const isLoading = gLoading || pLoading || vLoading

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text">דשבורד</h2>
          <p className="text-text-muted">סקירה כללית של המערכת</p>
        </div>
        <Button size="lg" onClick={() => navigate('/visit/new')}>
          <Plus className="h-4 w-4" />
          ביקור חדש
        </Button>
      </div>

      {stats.guidelinesNeedingText > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {stats.guidelinesNeedingText} הנחיות פעילות ללא טקסט חולץ.
          </span>
          <Link
            to="/guidelines"
            className="font-medium underline hover:no-underline"
          >
            לחץ לחלץ
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          loading={isLoading}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="מטופלים"
          value={stats.totalPatients}
          to="/patients"
          loading={isLoading}
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
          loading={isLoading}
        />
        <StatCard
          icon={<FilePlus2 className="h-4 w-4" />}
          label="ביקור חדש"
          value=""
          subtitle="התחל ביקור עכשיו"
          to="/visit/new"
          loading={false}
          accent
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ביקורים אחרונים</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-text-muted">טוען...</p>}
            {!isLoading && stats.recentVisits.length === 0 && (
              <p className="text-sm text-text-muted">
                אין ביקורים שמורים. התחל ביקור חדש.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {stats.recentVisits.map((v) => {
                const patient = patients?.find((p) => p.id === v.patient_id)
                return (
                  <button
                    key={v.id}
                    onClick={() => navigate('/templates')}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted p-3 text-right hover:bg-muted/70"
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
            {isLoading && <p className="text-sm text-text-muted">טוען...</p>}
            {!isLoading && stats.activeGuidelines === 0 && (
              <p className="text-sm text-text-muted">
                אין הנחיות פעילות.{' '}
                <Link
                  to="/guidelines"
                  className="text-primary-600 hover:underline dark:text-primary-300"
                >
                  הוסף הנחיה
                </Link>
              </p>
            )}
            <div className="flex flex-col gap-2">
              {Array.from(stats.guidelinesByCategory.entries()).map(
                ([cat, count]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm"
                  >
                    <span className="text-text">{CATEGORY_LABELS[cat]}</span>
                    <Badge variant="success">{count}</Badge>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.visitsByType.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ביקורים לפי סוג</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from(stats.visitsByType.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm"
                  >
                    <span className="text-text">
                      {VISIT_TYPE_LABELS[type as VisitType] ?? type}
                    </span>
                    <Badge>{count}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  to,
  loading,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  subtitle?: string
  to: string
  loading: boolean
  accent?: boolean
}) {
  return (
    <Link
      to={to}
      className={
        accent
          ? 'rounded-lg border border-primary-300 bg-primary-50 p-5 transition-colors hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-900/40 dark:hover:bg-primary-900/60'
          : 'rounded-lg border border-border bg-surface p-5 transition-colors hover:bg-muted'
      }
    >
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-primary-600 dark:text-primary-300">
        {loading ? '—' : value}
      </div>
      {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
    </Link>
  )
}
