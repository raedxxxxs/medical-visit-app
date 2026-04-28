import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { renderVisitTemplate, type VisitTemplate } from '@/lib/visit-template'
import type { VisitDraft } from '@/lib/visits'

export interface GenerateResponse {
  /** Markdown rendering of the structured template — what's persisted as `generated_template`. */
  template: string
  /** Raw structured data — useful for future per-section editing. */
  structured: VisitTemplate
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  model?: string
  guidelines_used?: { id: string; title: string }[]
}

interface ServerResponse {
  template: VisitTemplate
  usage?: GenerateResponse['usage']
  model?: string
  guidelines_used?: GenerateResponse['guidelines_used']
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

      const { data, error } = await supabase.functions.invoke<ServerResponse>(
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
            tone: draft.tone,
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
            }
          }
        } catch {
          // ignore
        }
        throw new Error(detail)
      }
      if (!data?.template) throw new Error('תגובה ריקה מהשרת')

      return {
        template: renderVisitTemplate(data.template),
        structured: data.template,
        usage: data.usage,
        model: data.model,
        guidelines_used: data.guidelines_used,
      }
    },
  })
}
