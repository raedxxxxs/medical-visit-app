import { Toaster as SonnerToaster, toast } from 'sonner'
import { useTheme } from '@/hooks/useTheme'

export { toast }

export function Toaster() {
  const { theme } = useTheme()
  return (
    <SonnerToaster
      dir="rtl"
      position="top-left"
      richColors
      closeButton
      offset={72}
      theme={theme === 'dark' ? 'dark' : 'light'}
      style={{ zIndex: 9999 }}
      toastOptions={{
        classNames: {
          toast:
            'font-sans border border-border bg-surface text-text shadow-[--shadow-lg] rounded-[--radius-md]',
          title: 'text-sm font-semibold',
          description: 'text-xs text-text-muted',
        },
      }}
    />
  )
}
