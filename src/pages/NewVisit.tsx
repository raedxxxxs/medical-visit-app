import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      navigate('/templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
    }
  }

  const handleDiscard = () => {
    if (!confirm('למחוק את הטיוטה? הנתונים שהזנת יאבדו.')) return
    reset()
    setStep(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text">ביקור חדש</h2>
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

      {step === 1 && <Step1Patient draft={draft} update={update} />}
      {step === 2 && <Step2Data draft={draft} update={update} />}
      {step === 3 && <Step3Review draft={draft} update={update} />}

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
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
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            שמור ביקור
          </Button>
        )}
      </div>
    </div>
  )
}
