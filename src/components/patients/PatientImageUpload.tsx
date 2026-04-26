import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { Camera, Loader2, Sparkles, X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useVisionExtract,
  type PatientExtractResult,
} from '@/hooks/useVisionExtract'
import { CONDITION_OPTIONS, conditionLabel } from '@/lib/patients'
import { cn } from '@/lib/utils'

const VALID_CONDITIONS = new Set<string>(
  CONDITION_OPTIONS.map((c) => c.value as string),
)

interface AppliedFields {
  initials: boolean
  age: boolean
  gender: boolean
  conditions: string[]
  medications: string[]
  imagesProcessed: number
}

interface Props {
  onApply: (extracted: {
    initials?: string
    age?: string
    gender?: 'male' | 'female' | ''
    conditions?: string[]
    medications?: string
  }) => void
  currentInitials: string
  currentAge: string
  currentGender: '' | 'male' | 'female'
  currentMedications: string
  currentConditions: string[]
}

export function PatientImageUpload({
  onApply,
  currentInitials,
  currentAge,
  currentGender,
  currentMedications,
  currentConditions,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const extract = useVisionExtract<PatientExtractResult>()
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<AppliedFields | null>(null)
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
    const files = Array.from(e.dataTransfer.files ?? [])
    await processFiles(files)
  }

  const MAX_IMAGE_MB = 10
  const MAX_IMAGES = 10

  const processFiles = async (rawFiles: File[]) => {
    setError(null)
    setApplied(null)
    setProgress(null)
    if (extract.isPending) return // guard against re-entry
    const heicCount = rawFiles.filter(
      (f) => /heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name),
    ).length
    const files = rawFiles.filter((f) => f.type.startsWith('image/'))
    if (heicCount > 0 && files.length === 0) {
      setError('קבצי HEIC לא נתמכים. המר ל-JPG/PNG ונסה שוב.')
      return
    }
    if (files.length === 0) return
    if (files.length > MAX_IMAGES) {
      setError(`מקסימום ${MAX_IMAGES} תמונות בפעם אחת`)
      return
    }
    const tooBig = files.find((f) => f.size > MAX_IMAGE_MB * 1024 * 1024)
    if (tooBig) {
      setError(`התמונה "${tooBig.name}" חורגת מ-${MAX_IMAGE_MB}MB`)
      return
    }

    const merged: PatientExtractResult = {
      initials: null,
      age: null,
      gender: null,
      conditions: [],
      medications: [],
      warnings: [],
    }
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length })
      try {
        const r = await extract.mutateAsync({ file: files[i], mode: 'patient' })
        if (!merged.initials && r.initials) merged.initials = r.initials
        if (merged.age == null && typeof r.age === 'number') merged.age = r.age
        if (!merged.gender && (r.gender === 'male' || r.gender === 'female'))
          merged.gender = r.gender
        if (r.conditions?.length)
          merged.conditions = [...(merged.conditions ?? []), ...r.conditions]
        if (r.medications?.length)
          merged.medications = [
            ...(merged.medications ?? []),
            ...r.medications,
          ]
        if (r.warnings?.length)
          merged.warnings = [...(merged.warnings ?? []), ...r.warnings]
      } catch (err) {
        errors.push(
          `תמונה ${i + 1}: ${err instanceof Error ? err.message : 'שגיאה'}`,
        )
      }
    }

    setProgress(null)
    if (errors.length === files.length) {
      setError(errors.join(' · '))
      return
    }
    applyMerged(merged, files.length)
    if (errors.length > 0) setError(errors.join(' · '))
  }

  const applyMerged = (r: PatientExtractResult, imagesProcessed: number) => {
    const newConditions = (r.conditions ?? []).filter((c) =>
      VALID_CONDITIONS.has(c),
    )
    const mergedConditions = Array.from(
      new Set([...currentConditions, ...newConditions]),
    )

    const newMeds = r.medications ?? []
    const existingMeds = currentMedications
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const mergedMeds = Array.from(new Set([...existingMeds, ...newMeds]))

    const result: Parameters<typeof onApply>[0] = {}
    const status: AppliedFields = {
      initials: false,
      age: false,
      gender: false,
      conditions: [],
      medications: [],
      imagesProcessed,
    }

    // Only fill fields that are currently empty
    if (!currentInitials.trim() && r.initials && r.initials.trim()) {
      result.initials = r.initials.trim()
      status.initials = true
    }
    if (
      !currentAge.trim() &&
      typeof r.age === 'number' &&
      r.age > 0 &&
      r.age < 120
    ) {
      result.age = String(r.age)
      status.age = true
    }
    if (!currentGender && (r.gender === 'male' || r.gender === 'female')) {
      result.gender = r.gender
      status.gender = true
    }
    if (newConditions.length > 0) {
      result.conditions = mergedConditions
      status.conditions = newConditions
    }
    if (newMeds.length > 0) {
      result.medications = mergedMeds.join(', ')
      status.medications = newMeds
    }

    if (Object.keys(result).length === 0) {
      setError('לא זוהו פרטים מוכרים בתמונות')
      return
    }
    onApply(result)
    setApplied(status)
  }

  const summary: string[] = []
  if (applied?.initials) summary.push('ראשי תיבות')
  if (applied?.age) summary.push('גיל')
  if (applied?.gender) summary.push('מין')
  if (applied?.conditions.length)
    summary.push(
      `מחלות רקע: ${applied.conditions.map(conditionLabel).join(', ')}`,
    )
  if (applied?.medications.length)
    summary.push(`תרופות (${applied.medications.length})`)

  return (
    <section className="flex flex-col gap-2 rounded-md border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-900/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs font-medium text-text">
          <Sparkles className="h-3.5 w-3.5 text-primary-600 dark:text-primary-300" />
          חילוץ אוטומטי מתמונה (שם, גיל, מין, מחלות, תרופות)
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
            : 'צלם / בחר תמונות'}
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
        גרור תמונות לכאן (אפשר כמה ביחד) — שדות מלאים לא יידרסו, מחלות ותרופות
        יתווספו
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger">
          {error}
        </div>
      )}

      {applied && summary.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-2 text-xs text-success">
          <span className="shrink-0 font-medium">
            מולא ({applied.imagesProcessed} תמונות):
          </span>
          <span className="flex-1">{summary.join(' · ')}</span>
          <button
            type="button"
            onClick={() => setApplied(null)}
            className="text-text-muted hover:text-text"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </section>
  )
}
