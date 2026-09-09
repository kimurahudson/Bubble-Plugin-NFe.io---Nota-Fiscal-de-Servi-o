import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Transactions from './pages/Transactions'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import Banks from './pages/Banks'
import ImportCsv from './pages/ImportCsv'
import Security from './pages/Security'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'

function PrivateArea() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Carregando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  )
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route path="/verificar-email" element={<VerifyEmail />} />
        <Route path="/" element={<PrivateArea />}>
          <Route index element={<Transactions />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="importar" element={<ImportCsv />} />
          <Route path="categorias" element={<Categories />} />
          <Route path="bancos" element={<Banks />} />
          <Route path="seguranca" element={<Security />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
