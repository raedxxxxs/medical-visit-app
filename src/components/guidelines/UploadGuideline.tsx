import { useState, type DragEvent, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, FileText, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { useUploadGuideline } from '@/hooks/useGuidelines'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/guidelines'
import type { GuidelineCategory } from '@/types/database'
import { cn } from '@/lib/utils'

const schema = z.object({
  title: z.string().min(1, 'יש להזין כותרת').max(200, 'כותרת ארוכה מדי'),
  category: z.enum([
    'diabetes',
    'hypertension',
    'lipids',
    'screening',
    'general',
  ]),
  notes: z.string().max(1000, 'הערות ארוכות מדי').optional(),
})

type FormData = z.infer<typeof schema>

const MAX_MB = 50
const MAX_BYTES = MAX_MB * 1024 * 1024

export function UploadGuideline({ onDone }: { onDone?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState<{
    page: number
    total: number
  } | null>(null)
  const upload = useUploadGuideline()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'general' },
  })

  const validateFile = (f: File): boolean => {
    setFileError(null)
    if (f.type !== 'application/pdf') {
      setFileError('יש להעלות קובץ PDF בלבד')
      return false
    }
    if (f.size > MAX_BYTES) {
      setFileError(`הקובץ חורג מ-${MAX_MB}MB`)
      return false
    }
    return true
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && validateFile(dropped)) setFile(dropped)
  }

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (picked && validateFile(picked)) setFile(picked)
  }

  const onSubmit = async (data: FormData) => {
    if (!file) {
      setFileError('יש לבחור קובץ')
      return
    }
    setProgress(null)
    try {
      await upload.mutateAsync({
        title: data.title,
        category: data.category as GuidelineCategory,
        notes: data.notes,
        file,
        onExtractProgress: (p) =>
          setProgress({ page: p.currentPage, total: p.totalPages }),
      })
      reset()
      setFile(null)
      setProgress(null)
      toast.success('ההנחיה הועלתה')
      onDone?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בהעלאה'
      setFileError(message)
      toast.error(message)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
    >
      <h3 className="text-lg font-semibold text-text">העלאת הנחיה חדשה</h3>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors',
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
            : 'border-border bg-muted',
        )}
      >
        {file ? (
          <div className="flex w-full items-center justify-between gap-2 rounded-md bg-surface p-3">
            <div className="flex items-center gap-2 truncate">
              <FileText className="h-5 w-5 shrink-0 text-primary-500" />
              <span className="truncate text-sm text-text">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-text-muted hover:text-danger"
              aria-label="הסר קובץ"
              disabled={upload.isPending}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-muted">גרור קובץ PDF לכאן, או</p>
            <label className="cursor-pointer text-sm font-medium text-primary-600 hover:underline dark:text-primary-300">
              בחר קובץ מהמחשב
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFilePick}
                className="hidden"
              />
            </label>
            <p className="text-xs text-text-muted">עד {MAX_MB}MB</p>
          </>
        )}
      </div>
      {fileError && <span className="text-xs text-danger">{fileError}</span>}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium text-text">
            כותרת *
          </label>
          <Input id="title" {...register('title')} />
          {errors.title && (
            <span className="text-xs text-danger">{errors.title.message}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium text-text">
            קטגוריה *
          </label>
          <Select id="category" {...register('category')}>
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-text">
          הערות (אופציונלי)
        </label>
        <Input id="notes" {...register('notes')} />
      </div>

      {upload.isPending && (
        <div className="rounded-md border border-primary-200 bg-primary-50 p-3 text-sm text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-200">
          {progress
            ? `מחלץ טקסט: עמוד ${progress.page} מתוך ${progress.total}...`
            : 'מעבד את הקובץ...'}
        </div>
      )}

      <Button type="submit" disabled={upload.isPending}>
        {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        העלה
      </Button>
    </form>
  )
}
