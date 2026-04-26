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
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSummarizeChart } from '@/hooks/useSummarizeChart'
import { cn } from '@/lib/utils'

const MAX_IMAGES = 20
const MAX_MB = 10

export function PatientChart() {
  const inputRef = useRef<HTMLInputElement>(null)
  const summarize = useSummarizeChart()
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string>('')
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
    try {
      const res = await summarize.mutateAsync(files)
      setSummary(res.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת הסיכום')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('שגיאה בהעתקה')
    }
  }

  const handleClear = () => {
    setFiles([])
    setSummary('')
    setError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-text">סיכום תיק מטופל</h2>
        <p className="text-text-muted">
          העלה / הדבק תמונות של תיק רפואי — סיכומי ביקור, מרשמים, מכתבי שחרור,
          בדיקות. AI יסכם את כל התיק במבנה מסודר.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-text">תמונות התיק</h3>
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
                  className="text-text-muted hover:text-danger"
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
          <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Button
          onClick={handleSummarize}
          disabled={summarize.isPending || files.length === 0}
          size="lg"
        >
          {summarize.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {summarize.isPending
            ? 'מסכם תיק... (עד דקה)'
            : 'צור סיכום תיק עם Claude AI'}
        </Button>
      </section>

      {summary && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-text">הסיכום</h3>
            <Button onClick={handleCopy} size="sm" variant="outline">
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'הועתק' : 'העתק'}
            </Button>
          </div>
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
