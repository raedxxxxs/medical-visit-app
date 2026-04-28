import { useMemo, useState } from 'react'
import { Plus, X, AlertCircle, BookOpen } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { SkeletonRow } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useGuidelines } from '@/hooks/useGuidelines'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/guidelines'
import { UploadGuideline } from '@/components/guidelines/UploadGuideline'
import { GuidelineCard } from '@/components/guidelines/GuidelineCard'
import type { Guideline, GuidelineCategory } from '@/types/database'

export function Guidelines() {
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const { data, isLoading, error } = useGuidelines()

  const grouped = useMemo(() => {
    const items = (data ?? []).filter((g) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        g.title.toLowerCase().includes(q) ||
        g.file_name.toLowerCase().includes(q) ||
        g.notes?.toLowerCase().includes(q)
      )
    })
    const map = new Map<GuidelineCategory, Guideline[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const g of items) {
      map.get(g.category)?.push(g)
    }
    return map
  }, [data, search])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text">מאגר הנחיות</h2>
          <p className="text-text-muted">
            ניהול הנחיות קליניות לשימוש בייצור שבלונות
          </p>
        </div>
        <Button onClick={() => setShowUpload((s) => !s)}>
          {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showUpload ? 'סגור' : 'הוסף הנחיה'}
        </Button>
      </div>

      {showUpload && <UploadGuideline onDone={() => setShowUpload(false)} />}

      <SearchInput
        placeholder="חיפוש לפי כותרת, שם קובץ, או הערות..."
        value={search}
        onValueChange={setSearch}
        aria-label="חיפוש הנחיות"
      />

      {isLoading && (
        <div className="flex flex-col gap-2">
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
          {error instanceof Error ? error.message : 'שגיאה בטעינת המאגר'}
        </div>
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="המאגר ריק"
          description="הוסף הנחיה ראשונה כדי שניתן יהיה להשתמש בה בייצור שבלונות."
          action={
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Plus className="h-4 w-4" />
              הוסף הנחיה
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-6">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? []
          if (items.length === 0) return null
          return (
            <section key={cat} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-muted">
                {CATEGORY_LABELS[cat]} ({items.length})
              </h3>
              <div className="flex flex-col gap-2">
                {items.map((g, i) => (
                  <div
                    key={g.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                  >
                    <GuidelineCard guideline={g} />
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
