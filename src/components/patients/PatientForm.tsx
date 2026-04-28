import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CONDITION_OPTIONS } from '@/lib/patients'
import {
  useCreatePatient,
  useUpdatePatient,
} from '@/hooks/usePatients'
import type { Patient } from '@/types/database'
import { PatientImageUpload } from './PatientImageUpload'

const KNOWN_CONDITIONS = new Set<string>(
  CONDITION_OPTIONS.map((c) => c.value as string),
)

function splitConditions(all: string[] | null | undefined): {
  known: string[]
  extra: string
} {
  const known: string[] = []
  const extra: string[] = []
  for (const c of all ?? []) {
    if (KNOWN_CONDITIONS.has(c)) known.push(c)
    else extra.push(c)
  }
  return { known, extra: extra.join(', ') }
}

const schema = z.object({
  full_name: z.string().max(120, 'שם ארוך מדי').optional(),
  initials: z.string().min(1, 'יש להזין ראשי תיבות').max(10),
  age: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || !v.trim()) return true
        // Integer only, 0-120
        if (!/^\d+$/.test(v.trim())) return false
        const n = parseInt(v, 10)
        return !isNaN(n) && n >= 0 && n <= 120
      },
      { message: 'גיל חייב להיות מספר שלם בין 0 ל-120' },
    ),
  gender: z.enum(['', 'male', 'female']),
  conditions: z.array(z.string()),
  additional_conditions: z.string().optional(),
  medications: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function PatientForm({
  patient,
  onDone,
  onCancel,
}: {
  patient?: Patient
  onDone?: () => void
  onCancel?: () => void
}) {
  const isEdit = !!patient
  const create = useCreatePatient()
  const update = useUpdatePatient()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: (() => {
      const split = splitConditions(patient?.conditions)
      return {
        full_name: patient?.full_name ?? '',
        initials: patient?.initials ?? '',
        age: patient?.age ? String(patient.age) : '',
        gender: (patient?.gender ?? '') as '' | 'male' | 'female',
        conditions: split.known,
        additional_conditions: split.extra,
        medications: patient?.medications?.join(', ') ?? '',
        notes: patient?.notes ?? '',
      }
    })(),
  })

  const onSubmit = handleSubmit(async (raw) => {
    const ageStr = (raw.age ?? '').trim()
    const meds = (raw.medications ?? '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
    const extraConditions = (raw.additional_conditions ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const allConditions = [...raw.conditions, ...extraConditions]

    const payload = {
      full_name: raw.full_name?.trim() || null,
      initials: raw.initials,
      age: ageStr ? parseInt(ageStr, 10) : null,
      gender: raw.gender === '' ? null : raw.gender,
      conditions: allConditions.length > 0 ? allConditions : null,
      medications: meds.length > 0 ? meds : null,
      notes: raw.notes?.trim() || null,
    }

    if (isEdit) {
      await update.mutateAsync({ id: patient.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onDone?.()
  })

  const isPending = create.isPending || update.isPending

  // Re-sync form only when the *patient identity* changes. Including the full
  // `patient` object would re-fire on every parent render and overwrite edits.
  useEffect(() => {
    if (!patient) return
    const split = splitConditions(patient.conditions)
    reset({
      full_name: patient.full_name ?? '',
      initials: patient.initials ?? '',
      age: patient.age ? String(patient.age) : '',
      gender: (patient.gender ?? '') as '' | 'male' | 'female',
      conditions: split.known,
      additional_conditions: split.extra,
      medications: patient.medications?.join(', ') ?? '',
      notes: patient.notes ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id, reset])

  const watchedInitials = useWatch({ control, name: 'initials' }) ?? ''
  const watchedAge = useWatch({ control, name: 'age' }) ?? ''
  const watchedGender = (useWatch({ control, name: 'gender' }) ?? '') as
    | ''
    | 'male'
    | 'female'
  const watchedConditions = useWatch({ control, name: 'conditions' }) ?? []
  const watchedMeds = useWatch({ control, name: 'medications' }) ?? ''

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-[--radius-md] border border-border bg-surface p-6 shadow-[--shadow-sm]"
    >
      <h3 className="text-xl font-bold tracking-tight text-text">
        {isEdit ? `עריכת מטופל ${patient.patient_code}` : 'מטופל חדש'}
      </h3>

      <PatientImageUpload
        currentInitials={watchedInitials}
        currentAge={watchedAge}
        currentGender={watchedGender}
        currentMedications={watchedMeds}
        currentConditions={watchedConditions}
        onApply={(ex) => {
          if (ex.initials !== undefined)
            setValue('initials', ex.initials, { shouldDirty: true })
          if (ex.age !== undefined)
            setValue('age', ex.age, { shouldDirty: true })
          if (ex.gender !== undefined)
            setValue('gender', ex.gender, { shouldDirty: true })
          if (ex.conditions !== undefined)
            setValue('conditions', ex.conditions, { shouldDirty: true })
          if (ex.medications !== undefined)
            setValue('medications', ex.medications, { shouldDirty: true })
        }}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pf-fullname" className="text-sm font-medium text-text">
          שם מלא
        </label>
        <Input
          id="pf-fullname"
          placeholder="לדוגמה: אבי כהן"
          aria-invalid={!!errors.full_name}
          aria-describedby={errors.full_name ? 'pf-fullname-err' : 'pf-fullname-hint'}
          {...register('full_name')}
        />
        {errors.full_name ? (
          <span id="pf-fullname-err" role="alert" className="text-xs font-medium text-[--color-danger-fg]">
            {errors.full_name.message}
          </span>
        ) : (
          <span id="pf-fullname-hint" className="text-xs text-text-muted">
            לשימושך הפרטי בהכנה לביקור. לא נשלח ל-AI ולא יופיע בשבלונה.
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-initials" className="text-sm font-medium text-text">
            ראשי תיבות <span aria-hidden className="text-[--color-danger-fg]">*</span>
          </label>
          <Input
            id="pf-initials"
            placeholder="א.ב."
            aria-invalid={!!errors.initials}
            aria-describedby={errors.initials ? 'pf-initials-err' : undefined}
            {...register('initials')}
          />
          {errors.initials && (
            <span id="pf-initials-err" role="alert" className="text-xs font-medium text-[--color-danger-fg]">
              {errors.initials.message}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-age" className="text-sm font-medium text-text">גיל</label>
          <Input
            id="pf-age"
            type="number"
            placeholder="65"
            aria-invalid={!!errors.age}
            aria-describedby={errors.age ? 'pf-age-err' : undefined}
            {...register('age')}
          />
          {errors.age && (
            <span id="pf-age-err" role="alert" className="text-xs font-medium text-[--color-danger-fg]">
              {errors.age.message}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-gender" className="text-sm font-medium text-text">מין</label>
          <Select id="pf-gender" {...register('gender')}>
            <option value="">—</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">מחלות רקע</label>
        <div className="flex flex-wrap gap-3 rounded-md border border-border bg-muted p-3">
          {CONDITION_OPTIONS.map((c) => (
            <label
              key={c.value}
              className="flex cursor-pointer items-center gap-2 text-sm text-text"
            >
              <input
                type="checkbox"
                value={c.value}
                {...register('conditions')}
                className="h-4 w-4 accent-primary-500"
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">
          מחלות נוספות / מצבים כרוניים נוספים (מופרדים בפסיקים)
        </label>
        <Input
          {...register('additional_conditions')}
          placeholder="דיכאון, פיברומיאלגיה, אוסטאופורוזיס..."
        />
        <span className="text-xs text-text-muted">
          כל מצב כרוני שלא ברשימת ה-checkbox למעלה. יישלח ל-AI ויופיע בסעיף
          "מחלות רקע" בשבלונה.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">
          תרופות (מופרדות בפסיקים)
        </label>
        <Input
          {...register('medications')}
          placeholder="Metformin 850mg, Atorvastatin 40mg"
          dir="ltr"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">הערות</label>
        <Textarea {...register('notes')} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={isPending}>
          {isEdit ? 'שמור שינויים' : 'הוסף מטופל'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            ביטול
          </Button>
        )}
      </div>
    </form>
  )
}
