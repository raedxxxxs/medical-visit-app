import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  setCachedBrief,
  type PrepBriefData,
} from '@/lib/prep-queue'

interface GenerateInput {
  patient_id: string
  reason?: string
  visit_date?: string
}

interface GenerateResponse {
  brief: PrepBriefData
  usage?: unknown
  model?: string
  visits_considered?: number
}

export function useGeneratePrepBrief() {
  return useMutation({
    mutationFn: async (input: GenerateInput): Promise<GenerateResponse> => {
      const { data, error } = await supabase.functions.invoke<GenerateResponse>(
        'generate-prep-brief',
        { body: input },
      )

      if (error) {
        let detail = error.message
        try {
          const ctx = error.context as Response | undefined
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json()
            if (body?.error) {
              detail =
                typeof body.error === 'string'
                  ? body.error
                  : JSON.stringify(body.error)
            }
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail)
      }
      if (!data) throw new Error('תגובה ריקה מהשרת')
      // Cache by patient + today
      const dateKey = input.visit_date ?? new Date().toISOString().slice(0, 10)
      setCachedBrief(input.patient_id, dateKey, data.brief)
      return data
    },
  })
}
