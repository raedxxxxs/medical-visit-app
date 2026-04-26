import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  initial: string
  onChange: (value: string) => void
}

export function GeneratedTemplate({ initial, onChange }: Props) {
  const [copied, setCopied] = useState(false)
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setValue(initial)
  }, [initial])

  const autoSize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    autoSize()
  }, [value])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('שגיאה בהעתקה')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-text">השבלונה שנוצרה</h3>
        <Button onClick={handleCopy} size="sm" variant="outline">
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? 'הועתק!' : 'העתק לקליפבורד'}
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        ניתן לערוך את הטקסט לפני העתקה. השבלונה תישמר עם הביקור בלחיצה על "שמור
        ביקור".
      </p>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onChange(e.target.value)
        }}
        className="min-h-[400px] font-mono text-sm leading-relaxed"
        dir="rtl"
      />
    </section>
  )
}
