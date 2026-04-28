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

export type SummaryMode = 'chart' | 'hospitalization'

export interface ChartSummaryResponse {
  summary: string
  mode?: SummaryMode
  images_processed: number
  usage?: unknown
  model?: string
}

export function useSummarizeChart(defaultMode: SummaryMode = 'chart') {
  return useMutation({
    mutationFn: async (
      input: File[] | { files: File[]; mode?: SummaryMode },
    ): Promise<ChartSummaryResponse> => {
      const files = Array.isArray(input) ? input : input.files
      const mode: SummaryMode = Array.isArray(input)
        ? defaultMode
        : input.mode ?? defaultMode

      const validImages = files.filter((f) => f.type.startsWith('image/'))
      if (validImages.length === 0) {
        throw new Error('יש לצרף לפחות תמונה אחת')
      }
      const images = await Promise.all(
        validImages.map(async (f) => ({
          base64: await fileToBase64(f),
          media_type: f.type,
        })),
      )

      const { data, error } = await supabase.functions.invoke<ChartSummaryResponse>(
        'summarize-chart',
        { body: { images, mode } },
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
          // ignore
        }
        throw new Error(detail)
      }
      if (!data?.summary) throw new Error('סיכום ריק')
      return data
    },
  })
}
