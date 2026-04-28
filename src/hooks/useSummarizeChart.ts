import { useMutation } from '@tanstack/react-query'
import { streamEdgeFunction } from '@/lib/anthropic-stream'

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
  mode: SummaryMode
  images_processed: number
  usage?: unknown
  model?: string
}

interface SummarizeInput {
  files: File[]
  mode?: SummaryMode
  onProgress?: (accumulated: string) => void
  signal?: AbortSignal
}

export function useSummarizeChart(defaultMode: SummaryMode = 'chart') {
  return useMutation({
    mutationFn: async (
      input: File[] | SummarizeInput,
    ): Promise<ChartSummaryResponse> => {
      const files = Array.isArray(input) ? input : input.files
      const mode: SummaryMode = Array.isArray(input)
        ? defaultMode
        : input.mode ?? defaultMode
      const onProgress = Array.isArray(input) ? undefined : input.onProgress
      const signal = Array.isArray(input) ? undefined : input.signal

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

      const result = await streamEdgeFunction(
        'summarize-chart',
        { images, mode },
        {
          onDelta: (_chunk, accumulated) => onProgress?.(accumulated),
          signal,
        },
      )

      const summary = result.text.trim()
      if (!summary) throw new Error('סיכום ריק')

      return {
        summary,
        mode,
        images_processed: validImages.length,
        usage: result.usage,
        model: result.model,
      }
    },
  })
}
