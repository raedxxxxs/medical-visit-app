import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Stethoscope, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  email: z.string().min(1, 'יש להזין אימייל').email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'הסיסמה חייבת להכיל לפחות 6 תווים'),
})

type LoginFormData = z.infer<typeof loginSchema>

type Mode = 'signin' | 'signup'

export function Login() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  if (session) {
    const from = (location.state as { from?: { pathname: string } } | null)
      ?.from?.pathname
    return <Navigate to={from ?? '/'} replace />
  }

  const onSubmit = async (data: LoginFormData) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      if (mode === 'signin') {
        await signIn(data.email, data.password)
        navigate('/', { replace: true })
      } else {
        await signUp(data.email, data.password)
        setSuccessMessage(
          'נשלח אימייל אישור. אם אישור אימייל מבוטל בהגדרות — אפשר להתחבר ישירות.',
        )
        setMode('signin')
        reset({ email: data.email, password: '' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      setErrorMessage(translateAuthError(message))
    }
  }

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="rounded-full bg-primary-50 p-3 dark:bg-primary-900/40">
            <Stethoscope className="h-6 w-6 text-primary-600 dark:text-primary-300" />
          </div>
          <h2 className="text-xl font-bold text-text">ביקור מכוון</h2>
          <p className="text-sm text-text-muted">
            {mode === 'signin' ? 'ברוך הבא, התחבר למערכת' : 'יצירת חשבון חדש'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text">
              אימייל
            </label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="name@example.com"
              {...register('email')}
            />
            {errors.email && (
              <span className="text-xs text-danger">{errors.email.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text">
              סיסמה
            </label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              {...register('password')}
            />
            {errors.password && (
              <span className="text-xs text-danger">
                {errors.password.message}
              </span>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              {successMessage}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signin' ? 'התחבר' : 'צור חשבון'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-text-muted">
          {mode === 'signin' ? 'אין לך חשבון?' : 'יש לך כבר חשבון?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-primary-600 hover:underline dark:text-primary-300"
          >
            {mode === 'signin' ? 'הירשם' : 'התחבר'}
          </button>
        </div>
      </div>
    </div>
  )
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) {
    return 'אימייל או סיסמה שגויים'
  }
  if (lower.includes('user already registered')) {
    return 'משתמש כבר קיים — נסה להתחבר'
  }
  if (lower.includes('email not confirmed')) {
    return 'יש לאשר את כתובת האימייל לפני התחברות'
  }
  if (lower.includes('password should be')) {
    return 'הסיסמה אינה עומדת בדרישות'
  }
  return message
}
