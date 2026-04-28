import { useState } from 'react'
import { Stethoscope, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="md:hidden"
            aria-label="תפריט"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <Stethoscope className="h-5 w-5 text-primary-500" />
        <h1 className="text-lg font-semibold tracking-tight text-text">ביקור מכוון</h1>
      </div>
      <div className="flex items-center gap-2">
        {user?.email && (
          <span className="hidden text-sm text-text-muted sm:inline" dir="ltr">
            {user.email}
          </span>
        )}
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          loading={isSigningOut}
          aria-label="התנתק"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">התנתק</span>
        </Button>
      </div>
    </header>
  )
}
