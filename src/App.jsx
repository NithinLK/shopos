import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './hooks/useApp'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import SalesPage from './pages/SalesPage'
import ItemsPage from './pages/ItemsPage'
import ReceiptsPage from './pages/ReceiptsPage'
import ReportsPage from './pages/ReportsPage'
import StaffPage from './pages/StaffPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children, permission }) {
  const { currentUser } = useApp()
  if (!currentUser) return <Navigate to="/login" replace />
  if (permission && !canCheck(currentUser.role, permission)) return <Navigate to="/" replace />
  return children
}

function canCheck(role, permission) {
  const p = { admin: ['sales','items','receipts','reports','staff','settings'], manager: ['sales','items','receipts','reports'], cashier: ['sales'] }
  return (p[role] || []).includes(permission)
}

export default function App() {
  const { currentUser } = useApp()
  if (!currentUser) return <LoginPage />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/sales" replace />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/sales" replace />} />
      </Routes>
    </Layout>
  )
}