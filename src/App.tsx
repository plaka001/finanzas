import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import LoginPage from './auth/LoginPage'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import QuickAddPage from './pages/QuickAddPage'
import DebtsPage from './pages/DebtsPage'
import GoalsPage from './pages/GoalsPage'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/movimientos" element={<TransactionsPage />} />
        <Route path="/deudas" element={<DebtsPage />} />
        <Route path="/metas" element={<GoalsPage />} />
      </Route>
      <Route path="/agregar" element={<QuickAddPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
