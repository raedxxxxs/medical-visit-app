import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
    >
      {isDark ? (
        <Sun key="sun" className="h-4 w-4 animate-rotate-icon" />
      ) : (
        <Moon key="moon" className="h-4 w-4 animate-rotate-icon" />
      )}
    </Button>
  )
}
