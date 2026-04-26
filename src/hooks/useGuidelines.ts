import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  deleteGuidelineFile,
  uploadGuidelineFile,
} from '@/lib/storage'
import { extractTextFromPdf, type ExtractProgress } from '@/lib/pdfText'
import type { Guideline, GuidelineCategory } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

const QUERY_KEY = ['guidelines'] as const

export function useGuidelines() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Guideline[]> => {
      const { data, error } = await supabase
        .from('guidelines')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Guideline[]
    },
  })
}

export interface UploadInput {
  title: string
  category: GuidelineCategory
  notes?: string
  file: File
  onExtractProgress?: (p: ExtractProgress) => void
}

export function useUploadGuideline() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: UploadInput) => {
      if (!user) throw new Error('לא מחובר')

      // 1. Extract text from PDF (in browser, before upload)
      let extractedText: string | null = null
      try {
        extractedText = await extractTextFromPdf(
          input.file,
          input.onExtractProgress,
        )
      } catch (err) {
        console.warn('PDF text extraction failed:', err)
        // Continue without text — upload PDF anyway
      }

      // 2. Upload file to Storage
      const { path } = await uploadGuidelineFile(user.id, input.file)

      // 3. Insert DB row with extracted text
      const { error } = await supabase.from('guidelines').insert({
        user_id: user.id,
        title: input.title,
        category: input.category,
        file_url: path,
        file_name: input.file.name,
        file_size: input.file.size,
        extracted_text: extractedText,
        notes: input.notes ?? null,
        is_active: true,
      })
      if (error) {
        await deleteGuidelineFile(path).catch(() => {})
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteGuideline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (g: Guideline) => {
      const { error } = await supabase
        .from('guidelines')
        .delete()
        .eq('id', g.id)
      if (error) throw error
      await deleteGuidelineFile(g.file_url).catch(() => {})
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useToggleGuidelineActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (g: Guideline) => {
      const { error } = await supabase
        .from('guidelines')
        .update({ is_active: !g.is_active, updated_at: new Date().toISOString() })
        .eq('id', g.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/**
 * Extract text from an already-uploaded guideline (retroactive).
 * Downloads the PDF from Storage, extracts text in browser, updates DB.
 */
export function useExtractGuidelineText() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      guideline,
      onProgress,
    }: {
      guideline: Guideline
      onProgress?: (p: ExtractProgress) => void
    }) => {
      const { data: file, error: dErr } = await supabase.storage
        .from('guidelines')
        .download(guideline.file_url)
      if (dErr || !file) {
        throw new Error(dErr?.message ?? 'שגיאה בהורדת הקובץ')
      }
      const buf = await file.arrayBuffer()
      const text = await extractTextFromPdf(buf, onProgress)
      const { error } = await supabase
        .from('guidelines')
        .update({
          extracted_text: text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guideline.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
