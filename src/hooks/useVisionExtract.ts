import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ExtractMode = 'labs' | 'medications' | 'patient'

export interface LabExtractResult {
  values?: Record<string, string | number>
  test_date?: string | null
  warnings?: string[]
}

export interface MedExtractResult {
  medications?: string[]
  warnings?: string[]
}

export interface PatientExtractResult {
  initials?: string | null
  age?: number | null
  gender?: 'male' | 'female' | null
  conditions?: string[]
  medications?: string[]
  warnings?: string[]
}

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

export function useVisionExtract<T = unknown>() {
  return useMutation({
    mutationFn: async (input: {
      file: File
      mode: ExtractMode
    }): Promise<T> => {
      if (!input.file.type.startsWith('image/')) {
        throw new Error('יש להעלות קובץ תמונה (JPG/PNG/WEBP)')
      }
      const base64 = await fileToBase64(input.file)
      const mediaType = input.file.type as
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp'
        | 'image/gif'

      const { data, error } = await supabase.functions.invoke<{
        extracted: T
      }>('vision-extract', {
        body: {
          image_base64: base64,
          media_type: mediaType,
          mode: input.mode,
        },
      })

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
      if (!data?.extracted) throw new Error('תגובה ריקה')
      return data.extracted
    },
  })
}
