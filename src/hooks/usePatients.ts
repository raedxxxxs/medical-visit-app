import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Patient } from '@/types/database'

const QUERY_KEY = ['patients'] as const

export function usePatients() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Patient[]> => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Patient[]
    },
  })
}

export type PatientInput = Omit<
  Patient,
  'id' | 'user_id' | 'created_at' | 'patient_code'
> & {
  patient_code?: string
}

async function nextPatientCode(
  userId: string,
  bump = 0,
): Promise<string> {
  const { data, error } = await supabase
    .from('patients')
    .select('patient_code')
    .eq('user_id', userId)
  if (error) throw error
  let max = 0
  for (const row of data ?? []) {
    const m = /^P-(\d+)$/.exec(row.patient_code as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `P-${String(max + 1 + bump).padStart(3, '0')}`
}

export function useCreatePatient() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: PatientInput) => {
      if (!user) throw new Error('לא מחובר')
      const explicitCode = input.patient_code
      // Retry on unique-violation in case two concurrent creates pick the same code.
      const MAX_TRIES = 5
      for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        const code =
          explicitCode ?? (await nextPatientCode(user.id, attempt))
        const { error } = await supabase.from('patients').insert({
          user_id: user.id,
          patient_code: code,
          full_name: input.full_name,
          initials: input.initials,
          age: input.age,
          gender: input.gender,
          conditions: input.conditions,
          medications: input.medications,
          notes: input.notes,
        })
        if (!error) return
        // 23505 = unique_violation in Postgres
        const isUniqueViolation =
          (error as { code?: string }).code === '23505' ||
          /duplicate key|unique/i.test(error.message ?? '')
        if (explicitCode || !isUniqueViolation || attempt === MAX_TRIES - 1) {
          throw error
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdatePatient() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ id, ...input }: PatientInput & { id: string }) => {
      if (!user) throw new Error('לא מחובר')
      const { error } = await supabase
        .from('patients')
        .update({
          full_name: input.full_name,
          initials: input.initials,
          age: input.age,
          gender: input.gender,
          conditions: input.conditions,
          medications: input.medications,
          notes: input.notes,
        })
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeletePatient() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('לא מחובר')
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
