import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import {
  Camera,
  Copy,
  Check,
  FileText,
  Sparkles,
  Upload,
  X,
  HeartPulse,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { toast } from '@/components/ui/toaster'
import { useSummarizeChart } from '@/hooks/useSummarizeChart'
import { useCritiqueChart, type CritiqueResult } from '@/hooks/useCritiqueChart'
import { cn } from '@/lib/utils'

const MAX_IMAGES = 20
const MAX_MB = 10

export function Hospitalization() {
  const inputRef = useRef<HTMLInputElement>(null)
  const summarize = useSummarizeChart('hospitalization')
  const critique = useCritiqueChart()
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string>('')
  const [critiqueResult, setCritiqueResult] = useState<CritiqueResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = (incoming: File[]) => {
    setError(null)
    const images = incoming.filter((f) => f.type.startsWith('image/'))
    const heicCount = incoming.filter(
      (f) => /heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name),
    ).length
    if (heicCount > 0 && images.length === 0) {
      setError('קבצי HEIC לא נתמכים. המר ל-JPG/PNG.')
      return
    }
    const tooBig = images.find((f) => f.size > MAX_MB * 1024 * 1024)
    if (tooBig) {
      setError(`התמונה "${tooBig.name}" חורגת מ-${MAX_MB}MB`)
      return
    }
    const merged = [...files, ...images].slice(0, MAX_IMAGES)
    if (merged.length === MAX_IMAGES && files.length + images.length > MAX_IMAGES) {
      setError(`מקסימום ${MAX_IMAGES} תמונות`)
    }
    setFiles(merged)
  }

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    addFiles(picked)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files ?? [])
    addFiles(dropped)
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const pasted: File[] = []
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) pasted.push(f)
        }
      }
      if (pasted.length === 0) return
      e.preventDefault()
      addFiles(pasted)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSummarize = async () => {
    if (files.length === 0) {
      setError('יש לצרף לפחות תמונה אחת')
      return
    }
    setError(null)
    setSummary('')
    setCritiqueResult(null)
    try {
      const res = await summarize.mutateAsync({
        files,
        mode: 'hospitalization',
        onProgress: (acc) => setSummary(acc),
      })
      setSummary(res.summary)
      toast.success('סיכום האשפוז נוצר — מאמת...')

      // Self-critique pass: ask Claude (with vision) to re-check the summary
      // against the source images. If it returns a revised version, replace.
      // Failures here are non-fatal — keep the first-pass summary.
      try {
        const result = await critique.mutateAsync({ files, draft: res.summary })
        setCritiqueResult(result)
        if (result.verdict === 'revised' && result.revised_summary) {
          setSummary(result.revised_summary)
          toast.success(`הסיכום עודכן (${result.corrections.length} תיקונים)`)
        } else {
          toast.success('הסיכום אומת')
        }
      } catch (critErr) {
        // Don't block — surface as a soft notice only.
        console.warn('critique failed', critErr)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה ביצירת הסיכום'
      setError(msg)
      toast.error(msg)
      setSummary('')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      toast.success('הועתק')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('שגיאה בהעתקה')
    }
  }

  const handleClear = () => {
    setFiles([])
    setSummary('')
    setError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[{ label: 'דשבורד', to: '/' }, { label: 'סיכום אשפוז' }]}
      />
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tighter text-text">
          <HeartPulse className="h-7 w-7 text-primary-500" />
          סיכום אשפוז
        </h2>
        <p className="text-text-muted">
          העלה / הדבק (Ctrl+V) תמונות של מסמכי אשפוז — מכתב שחרור, סיכום אשפוז,
          תוצאות בדיקות מהאשפוז, גליונות סיעוד. ה-AI יסכם במבנה ממוקד מעקב בקהילה.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-[--radius-md] border border-border bg-surface p-6 shadow-[--shadow-sm]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-text">
            מסמכי האשפוז
          </h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={summarize.isPending}
            >
              <Camera className="h-4 w-4" />
              הוסף תמונות
            </Button>
            {files.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={summarize.isPending}
              >
                <X className="h-4 w-4" />
                נקה
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            capture="environment"
            onChange={handleFilePick}
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
            'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm transition-colors',
            isDragging
              ? 'border-primary-500 bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
              : 'border-border bg-muted text-text-muted',
          )}
        >
          <Upload className="h-6 w-6" />
          גרור תמונות לכאן, או הדבק (Ctrl+V) מהלוח
          <span className="text-xs">
            עד {MAX_IMAGES} תמונות, {MAX_MB}MB לכל תמונה (JPG / PNG / WEBP)
          </span>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-md border border-border bg-muted p-2 text-xs"
              >
                <FileText className="h-4 w-4 text-primary-500" />
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-text-muted hover:text-[--color-danger-fg]"
                  disabled={summarize.isPending}
                  aria-label="הסר תמונה"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[--radius-md] border border-[--color-danger-fg]/20 bg-[--color-danger-bg] p-2 text-sm text-[--color-danger-fg]"
          >
            {error}
          </div>
        )}

        {summarize.isPending && (
          <div className="flex flex-col gap-2">
            <Progress label="מעבד את מסמכי האשפוז עם Claude AI" />
            <p className="text-xs text-text-muted" aria-live="polite">
              מסכם אשפוז... (עד דקה)
            </p>
          </div>
        )}

        {critique.isPending && (
          <div className="flex flex-col gap-2">
            <Progress label="בקרת איכות — Claude משווה את הסיכום למקור" />
            <p className="text-xs text-text-muted" aria-live="polite">
              בודק את הסיכום מול תמונות המקור...
            </p>
          </div>
        )}

        <Button
          onClick={handleSummarize}
          loading={summarize.isPending}
          disabled={files.length === 0}
          size="lg"
        >
          <Sparkles className="h-4 w-4" />
          {summarize.isPending
            ? 'מסכם אשפוז... (עד דקה)'
            : 'צור סיכום אשפוז עם Claude AI'}
        </Button>
      </section>

      {summary && (
        <section className="flex animate-fade-in-up flex-col gap-3 rounded-[--radius-md] border border-border bg-surface p-6 shadow-[--shadow-sm]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-text">
              סיכום האשפוז
            </h3>
            <div className="flex items-center gap-2">
              {critiqueResult && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    critiqueResult.verdict === 'ok'
                      ? 'bg-[--color-success-bg] text-[--color-success-fg]'
                      : 'bg-[--color-warning-bg] text-[--color-warning-fg]',
                  )}
                  title={
                    critiqueResult.verdict === 'ok'
                      ? 'בקרה: הסיכום נמצא תקין מול המקור'
                      : `בקרה: בוצעו ${critiqueResult.corrections.length} תיקונים`
                  }
                >
                  {critiqueResult.verdict === 'ok'
                    ? '✓ אומת'
                    : `⚠ עודכן (${critiqueResult.corrections.length})`}
                </span>
              )}
              <Button onClick={handleCopy} size="sm" variant="outline">
                {copied ? (
                  <Check className="h-4 w-4 text-[--color-success-fg] animate-scale-in" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'הועתק' : 'העתק'}
              </Button>
            </div>
          </div>
          {critiqueResult?.verdict === 'revised' &&
            critiqueResult.corrections.length > 0 && (
              <details className="rounded-[--radius-sm] border border-[--color-warning-fg]/30 bg-[--color-warning-bg] p-3 text-sm text-[--color-warning-fg]">
                <summary className="cursor-pointer font-medium">
                  תיקונים שנעשו בבקרה ({critiqueResult.corrections.length})
                </summary>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                  {critiqueResult.corrections.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </details>
            )}
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="min-h-[500px] font-mono text-sm leading-relaxed"
            dir="rtl"
          />
        </section>
      )}
    </div>
  )
}
