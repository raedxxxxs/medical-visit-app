import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Guidelines } from '@/pages/Guidelines'
import { Patients } from '@/pages/Patients'
import { NewVisit } from '@/pages/NewVisit'
import { Templates } from '@/pages/Templates'

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="guidelines" element={<Guidelines />} />
            <Route path="patients" element={<Patients />} />
            <Route path="visit/new" element={<NewVisit />} />
            <Route path="templates" element={<Templates />} />
          </Route>
        </Routes>
      </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
