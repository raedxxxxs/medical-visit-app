import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { toast } from '@/components/ui/toaster'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useDraftVisit } from '@/hooks/useDraftVisit'
import { useSaveVisit } from '@/hooks/useVisits'
import { StepIndicator } from '@/components/visit/StepIndicator'
import { Step1Patient } from '@/components/visit/Step1Patient'
import { Step2Data } from '@/components/visit/Step2Data'
import { Step3Review } from '@/components/visit/Step3Review'

type Step = 1 | 2 | 3

export function NewVisit() {
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const { draft, update, reset } = useDraftVisit()
  const save = useSaveVisit()
  const navigate = useNavigate()
  const confirm = useConfirm()

  // Scroll to top whenever the step changes
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const canAdvance =
    step === 1
      ? !!draft.patient_id && !!draft.visit_type
      : true

  const next = () => {
    setError(null)
    if (!canAdvance) {
      setError('יש לבחור מטופל וסוג ביקור לפני המעבר')
      return
    }
    if (step < 3) setStep((s) => (s + 1) as Step)
  }
  const prev = () => {
    setError(null)
    if (step > 1) setStep((s) => (s - 1) as Step)
  }

  const handleSave = async () => {
    setError(null)
    try {
      await save.mutateAsync(draft)
      reset()
      toast.success('הביקור נשמר')
      navigate('/templates')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בשמירה'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleDiscard = async () => {
    const ok = await confirm({
      title: 'מחיקת טיוטה',
      message: 'למחוק את הטיוטה? הנתונים שהזנת יאבדו.',
      confirmLabel: 'מחק טיוטה',
      danger: true,
    })
    if (!ok) return
    reset()
    setStep(1)
    toast.success('הטיוטה נמחקה')
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'דשבורד', to: '/' }, { label: 'ביקור חדש' }]} />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text">ביקור חדש</h2>
          <p className="text-text-muted">
            הטיוטה נשמרת אוטומטית בדפדפן בכל שינוי
          </p>
        </div>
        <Button variant="ghost" onClick={handleDiscard} title="מחק טיוטה">
          <Trash2 className="h-4 w-4" />
          מחק טיוטה
        </Button>
      </div>

      <StepIndicator current={step} />

      <div aria-live="polite" className="sr-only">
        שלב {step} מתוך 3
      </div>

      <div key={step} className="animate-fade-in-up">
        {step === 1 && <Step1Patient draft={draft} update={update} />}
        {step === 2 && <Step2Data draft={draft} update={update} />}
        {step === 3 && <Step3Review draft={draft} update={update} />}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[--radius-md] border border-[--color-danger-fg]/20 bg-[--color-danger-bg] p-3 text-sm text-[--color-danger-fg]"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={prev} disabled={step === 1}>
          <ArrowRight className="h-4 w-4" />
          הקודם
        </Button>

        {step < 3 ? (
          <Button onClick={next} disabled={!canAdvance}>
            הבא
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} loading={save.isPending}>
            <Save className="h-4 w-4" />
            שמור ביקור
          </Button>
        )}
      </div>
    </div>
  )
}
