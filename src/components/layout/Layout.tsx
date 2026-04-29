import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { Toaster } from '@/components/ui/toaster'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { PageTransition } from '@/components/ui/motion'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Auto-close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <ConfirmProvider>
      <div className="flex h-screen flex-col">
        <a href="#main" className="skip-link">
          דלג לתוכן
        </a>
        <Header onMenuClick={() => setSidebarOpen((s) => !s)} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-3 sm:p-6 outline-none"
          >
            <AnimatePresence mode="wait" initial={false}>
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>
        <Toaster />
        <CommandPalette />
      </div>
    </ConfirmProvider>
  )
}
