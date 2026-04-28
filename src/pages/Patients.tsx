import { useMemo, useState } from 'react'
import { Plus, X, AlertCircle, Users } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { SkeletonRow } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { usePatients } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { PatientForm } from '@/components/patients/PatientForm'
import { PatientCard } from '@/components/patients/PatientCard'
import {
  CohortFilters,
  EMPTY_COHORT,
  isCohortActive,
  useCohortState,
} from '@/components/patients/CohortFilters'
import { conditionLabel } from '@/lib/patients'
import { patientMatchesCohort } from '@/lib/cohort'

export function Patients() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const { data, isLoading, error } = usePatients()
  const { data: visits } = useVisits()
  const [cohort, setCohort] = useCohortState()

  const matchedByCohort = useMemo(() => {
    if (!isCohortActive(cohort)) return data ?? []
    return (data ?? []).filter((p) => patientMatchesCohort(p, visits, cohort))
  }, [data, visits, cohort])

  const filtered = useMemo(() => {
    if (!search.trim()) return matchedByCohort
    const q = search.toLowerCase()
    return matchedByCohort.filter((p) => {
      if (p.patient_code.toLowerCase().includes(q)) return true
      if (p.initials?.toLowerCase().includes(q)) return true
      if (p.notes?.toLowerCase().includes(q)) return true
      if (p.conditions?.some((c) => conditionLabel(c).toLowerCase().includes(q)))
        return true
      if (p.medications?.some((m) => m.toLowerCase().includes(q))) return true
      return false
    })
  }, [matchedByCohort, search])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text">מטופלים</h2>
          <p className="text-text-muted">
            ניהול מטופלים אנונימיים — ראשי תיבות בלבד
          </p>
        </div>
        <Button onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? 'סגור' : 'מטופל חדש'}
        </Button>
      </div>

      {showAdd && (
        <PatientForm
          onDone={() => setShowAdd(false)}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <SearchInput
        placeholder="חיפוש לפי קוד / ראשי תיבות / מחלה / תרופה..."
        value={search}
        onValueChange={setSearch}
        aria-label="חיפוש מטופלים"
      />

      <CohortFilters
        state={cohort}
        onChange={setCohort}
        matchedCount={matchedByCohort.length}
        totalCount={data?.length ?? 0}
      />

      {isLoading && (
        <div className="flex flex-col gap-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[--radius-md] border border-[--color-danger-fg]/20 bg-[--color-danger-bg] p-3 text-sm text-[--color-danger-fg]"
        >
          <AlertCircle className="h-4 w-4" />
          {error instanceof Error ? error.message : 'שגיאה בטעינה'}
        </div>
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="אין מטופלים"
          description="הוסף את המטופל הראשון שלך כדי להתחיל."
          action={
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              מטופל חדש
            </Button>
          }
        />
      )}

      {!isLoading && (data?.length ?? 0) > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={
            isCohortActive(cohort)
              ? 'אין מטופלים שעונים על הסינון'
              : 'לא נמצאו מטופלים תואמים'
          }
          description={
            isCohortActive(cohort)
              ? 'נסה להסיר חלק מהקריטריונים או לנקות את הסינון.'
              : 'נסה חיפוש אחר.'
          }
          action={
            isCohortActive(cohort) ? (
              <Button size="sm" variant="outline" onClick={() => setCohort(EMPTY_COHORT)}>
                נקה סינון
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((p, i) => (
          <div
            key={p.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <PatientCard patient={p} />
          </div>
        ))}
      </div>
    </div>
  )
}
