import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Visit } from '@/types/database'
import type { VisitDraft } from '@/lib/visits'

const QUERY_KEY = ['visits'] as const

export function useVisits() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Visit[]> => {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .order('visit_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Visit[]
    },
  })
}

export function useSaveVisit() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (draft: VisitDraft) => {
      if (!user) throw new Error('לא מחובר')
      if (!draft.patient_id) throw new Error('יש לבחור מטופל')
      if (!draft.visit_type) throw new Error('יש לבחור סוג ביקור')

      const { error } = await supabase.from('visits').insert({
        user_id: user.id,
        patient_id: draft.patient_id,
        visit_type: draft.visit_type,
        visit_date: draft.visit_date,
        patient_data: {
          labs: draft.labs,
          vitals: draft.vitals,
          anamnesis: draft.anamnesis,
        },
        generated_template: draft.generated_template,
        guidelines_used:
          draft.guidelines_selected.length > 0
            ? draft.guidelines_selected
            : null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteVisit() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('לא מחובר')
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useToggleVisitFavorite() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (visit: Visit) => {
      if (!user) throw new Error('לא מחובר')
      const { error } = await supabase
        .from('visits')
        .update({ is_favorite: !visit.is_favorite })
        .eq('id', visit.id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
