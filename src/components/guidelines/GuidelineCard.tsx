import { useState } from 'react'
import { FileText, Eye, Trash2, FileType2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toaster'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  useDeleteGuideline,
  useExtractGuidelineText,
  useToggleGuidelineActive,
} from '@/hooks/useGuidelines'
import { getGuidelineSignedUrl } from '@/lib/storage'
import { formatFileSize } from '@/lib/guidelines'
import type { Guideline } from '@/types/database'

export function GuidelineCard({ guideline }: { guideline: Guideline }) {
  const toggleActive = useToggleGuidelineActive()
  const del = useDeleteGuideline()
  const extract = useExtractGuidelineText()
  const confirm = useConfirm()
  const [isOpening, setIsOpening] = useState(false)
  const [extractProgress, setExtractProgress] = useState<{
    page: number
    total: number
  } | null>(null)

  const handleView = async () => {
    setIsOpening(true)
    try {
      const url = await getGuidelineSignedUrl(guideline.file_url)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בפתיחת קובץ')
    } finally {
      setIsOpening(false)
    }
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'מחיקת הנחיה',
      message: `למחוק את "${guideline.title}"? פעולה זו אינה הפיכה.`,
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    del.mutate(guideline, {
      onSuccess: () => toast.success('ההנחיה נמחקה'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'שגיאה במחיקה'),
    })
  }

  const handleExtract = async () => {
    setExtractProgress(null)
    try {
      await extract.mutateAsync({
        guideline,
        onProgress: (p) =>
          setExtractProgress({ page: p.currentPage, total: p.totalPages }),
      })
      toast.success('הטקסט חולץ בהצלחה')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בחילוץ טקסט')
    } finally {
      setExtractProgress(null)
    }
  }

  const hasText = !!guideline.extracted_text
  const textChars = guideline.extracted_text?.length ?? 0

  return (
    <div className="flex items-center justify-between gap-3 rounded-[--radius-md] border border-border bg-surface p-3 transition-colors hover:bg-muted">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-primary-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-text">
              {guideline.title}
            </span>
            {guideline.is_active ? (
              <Badge variant="success">פעיל</Badge>
            ) : (
              <Badge variant="warning">כבוי</Badge>
            )}
            {hasText ? (
              <Badge variant="default">
                טקסט חולץ · {Math.round(textChars / 1000)}K תווים
              </Badge>
            ) : (
              <Badge variant="warning">ללא טקסט</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="truncate">{guideline.file_name}</span>
            {guideline.file_size && (
              <span>· {formatFileSize(guideline.file_size)}</span>
            )}
            <span>
              · {new Date(guideline.created_at).toLocaleDateString('he-IL')}
            </span>
          </div>
          {extract.isPending && extractProgress && (
            <p className="mt-1 text-xs text-primary-600 dark:text-primary-300">
              מחלץ: עמוד {extractProgress.page}/{extractProgress.total}...
            </p>
          )}
          {guideline.notes && (
            <p className="mt-1 truncate text-xs text-text-muted">
              {guideline.notes}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!hasText && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtract}
            loading={extract.isPending}
            title="חלץ טקסט מ-PDF"
          >
            <FileType2 className="h-4 w-4" />
            חלץ טקסט
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleActive.mutate(guideline)}
          disabled={toggleActive.isPending}
          title={guideline.is_active ? 'כבה' : 'הפעל'}
        >
          {guideline.is_active ? 'כבה' : 'הפעל'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleView}
          loading={isOpening}
          title="צפה ב-PDF"
          aria-label="צפה ב-PDF"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          loading={del.isPending}
          title="מחק"
          aria-label="מחק הנחיה"
        >
          <Trash2 className="h-4 w-4 text-[--color-danger-fg]" />
        </Button>
      </div>
    </div>
  )
}
