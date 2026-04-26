import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { VisitDraft } from '@/lib/visits'

export interface GenerateResponse {
  template: string
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  model?: string
  guidelines_used?: { id: string; title: string }[]
}

export function useGenerateVisit() {
  return useMutation({
    mutationFn: async (input: {
      draft: VisitDraft
      patient_summary?: string
    }): Promise<GenerateResponse> => {
      const { draft, patient_summary } = input
      if (!draft.visit_type) throw new Error('יש לבחור סוג ביקור')
      if (draft.guidelines_selected.length === 0) {
        throw new Error('יש לבחור לפחות הנחיה אחת')
      }

      const { data, error } = await supabase.functions.invoke<GenerateResponse>(
        'generate-visit',
        {
          body: {
            patient_data: {
              labs: draft.labs,
              vitals: draft.vitals,
              anamnesis: draft.anamnesis,
            },
            visit_type: draft.visit_type,
            visit_date: draft.visit_date,
            guideline_ids: draft.guidelines_selected,
            patient_summary,
          },
        },
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
              if (body.details) {
                detail += ` | ${JSON.stringify(body.details).slice(0, 300)}`
              }
            }
          }
        } catch {
          // ignore parse errors, fall back to message
        }
        throw new Error(detail)
      }
      if (!data) throw new Error('תגובה ריקה מהשרת')
      return data
    },
  })
}
