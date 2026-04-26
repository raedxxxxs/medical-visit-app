import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'חסרים משתני סביבה: VITE_SUPABASE_URL ו/או VITE_SUPABASE_ANON_KEY. הגדר אותם בקובץ .env',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
