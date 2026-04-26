import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { Camera, Loader2, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useVisionExtract,
  type LabExtractResult,
} from '@/hooks/useVisionExtract'
import type { LabValues, Vitals, VisitDraft } from '@/lib/visits'
import { LAB_VALUE_LABELS } from '@/lib/visits'
import { cn } from '@/lib/utils'

interface Props {
  draft: VisitDraft
  update: (patch: Partial<VisitDraft>) => void
}

const LAB_KEYS: (keyof LabValues)[] = [
  'hba1c',
  'glucose',
  'ldl',
  'hdl',
  'total_cholesterol',
  'triglycerides',
  'creatinine',
  'egfr',
  'microalbumin',
  'tsh',
  'b12',
  'vitamin_d',
]

const VITAL_KEYS: (keyof Vitals)[] = [
  'systolic_bp',
  'diastolic_bp',
  'pulse',
  'weight',
  'height',
  'bmi',
]

export function LabImageUpload({ draft, update }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const extract = useVisionExtract<LabExtractResult>()
  const [error, setError] = useState<string | null>(null)
  const [appliedKeys, setAppliedKeys] = useState<string[]>([])
  const [imagesProcessed, setImagesProcessed] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  const handlePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    await processFiles(files)
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) =>
      f.type.startsWith('image/'),
    )
    await processFiles(files)
  }

  const processFiles = async (files: File[]) => {
    setError(null)
    setAppliedKeys([])
    setProgress(null)
    if (files.length === 0) return

    // Merge values across all images, last image wins for duplicate keys
    const mergedValues: Record<string, string> = {}
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length })
      try {
        const r = await extract.mutateAsync({ file: files[i], mode: 'labs' })
        for (const [k, v] of Object.entries(r.values ?? {})) {
          mergedValues[k] = String(v)
        }
      } catch (err) {
        errors.push(
          `תמונה ${i + 1}: ${err instanceof Error ? err.message : 'שגיאה'}`,
        )
      }
    }

    setProgress(null)
    if (Object.keys(mergedValues).length === 0) {
      setError(
        errors.length === files.length
          ? errors.join(' · ')
          : 'לא זוהו ערכים מוכרים בתמונות',
      )
      return
    }

    applyValues(mergedValues, files.length)
    if (errors.length > 0) setError(errors.join(' · '))
  }

  const applyValues = (
    values: Record<string, string>,
    processedCount: number,
  ) => {
    const newLabs = { ...draft.labs }
    const newVitals = { ...draft.vitals }
    const applied: string[] = []

    for (const [k, v] of Object.entries(values)) {
      if (LAB_KEYS.includes(k as keyof LabValues)) {
        newLabs[k as keyof LabValues] = v
        applied.push(k)
      } else if (VITAL_KEYS.includes(k as keyof Vitals)) {
        newVitals[k as keyof Vitals] = v
        applied.push(k)
      }
    }
    update({ labs: newLabs, vitals: newVitals })
    setAppliedKeys(applied)
    setImagesProcessed(processedCount)
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-600 dark:text-primary-300" />
          <h3 className="text-sm font-semibold text-text">
            חילוץ אוטומטי מתמונת בדיקה
          </h3>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={extract.isPending}
        >
          {extract.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {extract.isPending
            ? progress
              ? `${progress.current}/${progress.total}...`
              : 'מנתח...'
            : 'העלה / צלם תמונות'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          capture="environment"
          onChange={handlePick}
          className="hidden"
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex items-center justify-center gap-2 rounded-md border-2 border-dashed p-3 text-xs transition-colors',
          isDragging
            ? 'border-primary-500 bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
            : 'border-border bg-surface text-text-muted',
        )}
      >
        <Upload className="h-4 w-4" />
        גרור תמונות לכאן (אפשר כמה — דפי בדיקה מרובים יתאחדו)
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger">
          {error}
        </div>
      )}

      {appliedKeys.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-2 text-xs text-success">
          <span className="shrink-0 font-medium">
            מולא ({imagesProcessed} תמונות):
          </span>
          <span className="flex-1">
            {appliedKeys.map((k) => LAB_VALUE_LABELS[k] ?? k).join(' · ')}
          </span>
          <button
            type="button"
            onClick={() => setAppliedKeys([])}
            className="text-text-muted hover:text-text"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </section>
  )
}
