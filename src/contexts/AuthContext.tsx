import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * All localStorage keys that hold user-scoped (and possibly identifiable)
 * data. Cleared on sign-out / session expiry so a shared browser doesn't
 * leak prep queues, cached briefs, drafts, or filter state to the next user.
 */
const USER_DATA_KEYS = [
  'visit-draft',
  'prep-queue',
  'prep-brief-cache',
  'prep-checked-items',
  'cohort-filters',
]

function clearLocalUserData() {
  try {
    for (const key of USER_DATA_KEYS) localStorage.removeItem(key)
  } catch {
    // ignore — private mode / quota errors are non-fatal here.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession)
        // On any sign-out (explicit or session expiry), clear local user data.
        if (event === 'SIGNED_OUT' || newSession === null) {
          clearLocalUserData()
        }
      },
    )

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    // Clear any local user-scoped state so it doesn't leak to next user.
    clearLocalUserData()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
