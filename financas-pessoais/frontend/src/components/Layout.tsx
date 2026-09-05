import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', label: 'Lançamentos', icon: '📋' },
  { to: '/importar', label: 'Importar CSV', icon: '📥' },
  { to: '/categorias', label: 'Categorias', icon: '🏷️' },
  { to: '/bancos', label: 'Bancos', icon: '🏦' },
]

function linkClasses(isActive: boolean) {
  return [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-lime text-brand-dark' : 'text-white/80 hover:bg-white/10 hover:text-white',
  ].join(' ')
}

function mobileLinkClasses(isActive: boolean) {
  return [
    'flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium flex-1',
    isActive ? 'text-brand-dark' : 'text-gray-500',
  ].join(' ')
}

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-60 md:flex-col bg-brand-dark px-4 py-6 gap-1">
        <div className="mb-6 px-3">
          <p className="text-white font-bold text-lg leading-tight">Finanças</p>
          <p className="text-white/60 text-xs leading-tight">Pessoais</p>
        </div>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => linkClasses(isActive)}>
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <div className="mt-auto px-3 pt-4 border-t border-white/10">
          <p className="text-white/70 text-xs mb-2 truncate">{user?.name}</p>
          <button
            onClick={logout}
            className="text-white/70 text-xs underline hover:text-white"
          >
            Sair
          </button>
        </div>
      </aside>

      <header
        className="md:hidden flex items-center justify-between bg-brand-dark px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <div>
          <p className="text-white font-bold text-base leading-tight">Finanças Pessoais</p>
        </div>
        <button onClick={logout} className="text-white/80 text-xs underline">
          Sair
        </button>
      </header>

      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-8 overflow-x-hidden">
        <Outlet />
      </main>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => mobileLinkClasses(isActive)}>
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
