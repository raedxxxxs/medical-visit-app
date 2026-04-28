import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export interface CritiqueResult {
  verdict: 'ok' | 'revised'
  corrections: string[]
  revised_summary: string | null
}

interface CritiqueResponse {
  critique: CritiqueResult
}

interface CritiqueInput {
  files: File[]
  draft: string
}

/**
 * Second-pass review: re-shows the source images to Claude alongside the draft
 * summary and asks it to either confirm faithfulness or return a corrected
 * version. Reuses the summarize-chart endpoint via the `critique_draft` flag.
 *
 * Failure here is non-fatal — the caller should keep showing the original
 * draft when this throws (it's a quality boost, not a hard requirement).
 */
export function useCritiqueChart() {
  return useMutation({
    mutationFn: async ({ files, draft }: CritiqueInput): Promise<CritiqueResult> => {
      const valid = files.filter((f) => f.type.startsWith('image/'))
      if (valid.length === 0) throw new Error('אין תמונות לבקרה')
      const images = await Promise.all(
        valid.map(async (f) => ({
          base64: await fileToBase64(f),
          media_type: f.type,
        })),
      )
      const { data, error } = await supabase.functions.invoke<CritiqueResponse>(
        'summarize-chart',
        { body: { images, critique_draft: draft } },
      )
      if (error) {
        let detail = error.message
        try {
          const ctx = error.context as Response | undefined
          if (ctx?.json) {
            const body = await ctx.json()
            if (body?.error) detail = body.error
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail)
      }
      if (!data?.critique) throw new Error('בקרה ריקה')
      return data.critique
    },
  })
}
