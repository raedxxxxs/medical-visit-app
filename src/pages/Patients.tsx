import { useMemo, useState } from 'react'
import { Search, Plus, X, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { usePatients } from '@/hooks/usePatients'
import { PatientForm } from '@/components/patients/PatientForm'
import { PatientCard } from '@/components/patients/PatientCard'
import { conditionLabel } from '@/lib/patients'

export function Patients() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const { data, isLoading, error } = usePatients()

  const filtered = useMemo(() => {
    if (!search.trim()) return data ?? []
    const q = search.toLowerCase()
    return (data ?? []).filter((p) => {
      if (p.patient_code.toLowerCase().includes(q)) return true
      if (p.initials?.toLowerCase().includes(q)) return true
      if (p.notes?.toLowerCase().includes(q)) return true
      if (p.conditions?.some((c) => conditionLabel(c).toLowerCase().includes(q)))
        return true
      if (p.medications?.some((m) => m.toLowerCase().includes(q))) return true
      return false
    })
  }, [data, search])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text">מטופלים</h2>
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

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="חיפוש לפי קוד / ראשי תיבות / מחלה / תרופה..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {isLoading && <p className="text-text-muted">טוען...</p>}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4" />
          {error instanceof Error ? error.message : 'שגיאה בטעינה'}
        </div>
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-text-muted">אין מטופלים. הוסף מטופל ראשון.</p>
        </div>
      )}

      {!isLoading && (data?.length ?? 0) > 0 && filtered.length === 0 && (
        <p className="text-text-muted">לא נמצאו מטופלים תואמים לחיפוש.</p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((p) => (
          <PatientCard key={p.id} patient={p} />
        ))}
      </div>
    </div>
  )
}
