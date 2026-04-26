import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Auto-close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen flex-col">
      <Header onMenuClick={() => setSidebarOpen((s) => !s)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
