import { useMemo, useState } from 'react'
import { Search, Plus, X, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
          <h2 className="text-2xl font-bold text-text">מאגר הנחיות</h2>
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

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="חיפוש לפי כותרת, שם קובץ, או הערות..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {isLoading && (
        <p className="text-text-muted">טוען...</p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4" />
          {error instanceof Error ? error.message : 'שגיאה בטעינת המאגר'}
        </div>
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-text-muted">המאגר ריק. הוסף הנחיה ראשונה.</p>
        </div>
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
                {items.map((g) => (
                  <GuidelineCard key={g.id} guideline={g} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
