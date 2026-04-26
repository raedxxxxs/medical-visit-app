import { useMemo, useState } from 'react'
import { Search, AlertCircle, History, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useVisits } from '@/hooks/useVisits'
import { usePatients } from '@/hooks/usePatients'
import { SavedVisitCard } from '@/components/templates/SavedVisitCard'
import { VisitDetailDialog } from '@/components/templates/VisitDetailDialog'
import { VISIT_TYPES, VISIT_TYPE_LABELS } from '@/lib/visits'
import type { Visit } from '@/types/database'

export function Templates() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const { data: visits, isLoading, error } = useVisits()
  const { data: patients } = usePatients()

  const filtered = useMemo(() => {
    let items = visits ?? []
    if (filterType) items = items.filter((v) => v.visit_type === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((v) => {
        const p = patients?.find((x) => x.id === v.patient_id)
        if (p?.patient_code.toLowerCase().includes(q)) return true
        if (p?.initials?.toLowerCase().includes(q)) return true
        if (v.visit_date.includes(q)) return true
        if (v.generated_template?.toLowerCase().includes(q)) return true
        return false
      })
    }
    return items
  }, [visits, search, filterType, patients])

  const favorites = filtered.filter((v) => v.is_favorite)
  const others = filtered.filter((v) => !v.is_favorite)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-text">שבלונות שמורות</h2>
        <p className="text-text-muted">היסטוריית ביקורים ותבניות אישיות</p>
      </div>

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">
            <History className="mr-1 inline h-4 w-4" />
            ביקורים שמורים
          </TabsTrigger>
          <TabsTrigger value="personal">תבניות אישיות</TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder="חיפוש לפי מטופל / תאריך / תוכן השבלונה..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="sm:w-48"
              >
                <option value="">כל סוגי הביקור</option>
                {VISIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VISIT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>

            {isLoading && <p className="text-text-muted">טוען...</p>}

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                <AlertCircle className="h-4 w-4" />
                {error instanceof Error ? error.message : 'שגיאה בטעינה'}
              </div>
            )}

            {!isLoading && !error && (visits?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
                <p className="text-text-muted">
                  אין ביקורים שמורים. צור ביקור חדש מהדף "ביקור חדש".
                </p>
              </div>
            )}

            {!isLoading &&
              (visits?.length ?? 0) > 0 &&
              filtered.length === 0 && (
                <p className="text-text-muted">לא נמצאו ביקורים תואמים.</p>
              )}

            {favorites.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1 text-sm font-semibold text-text-muted">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  מועדפים
                </h3>
                <div className="flex flex-col gap-2">
                  {favorites.map((v) => (
                    <SavedVisitCard
                      key={v.id}
                      visit={v}
                      onView={setSelectedVisit}
                    />
                  ))}
                </div>
              </section>
            )}

            {others.length > 0 && (
              <section className="flex flex-col gap-2">
                {favorites.length > 0 && (
                  <h3 className="text-sm font-semibold text-text-muted">
                    כל הביקורים
                  </h3>
                )}
                <div className="flex flex-col gap-2">
                  {others.map((v) => (
                    <SavedVisitCard
                      key={v.id}
                      visit={v}
                      onView={setSelectedVisit}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="personal">
          <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-text-muted">
              תבניות אישיות יישמרו כאן בהמשך — כרגע ניתן לשמור ביקורים בלבד.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <VisitDetailDialog
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
      />
    </div>
  )
}
