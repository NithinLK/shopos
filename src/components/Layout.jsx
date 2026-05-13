import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../hooks/useApp'
import { ShoppingCart, Package, Receipt, BarChart2, Users, Settings, LogOut, Menu, X, Store } from 'lucide-react'
import { nameToColor, canAccess } from '../utils/helpers'

const navItems = [
  { path: '/sales', label: 'Sales', icon: ShoppingCart, permission: 'sales' },
  { path: '/items', label: 'Items', icon: Package, permission: 'items' },
  { path: '/receipts', label: 'Receipts', icon: Receipt, permission: 'receipts' },
  { path: '/reports', label: 'Reports', icon: BarChart2, permission: 'reports' },
  { path: '/staff', label: 'Staff', icon: Users, permission: 'staff' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings' },
]

export default function Layout({ children }) {
  const { currentUser, logout, settings, sidebarOpen, setSidebarOpen } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  const go = (path) => { navigate(path); setSidebarOpen(false) }
  const bg = nameToColor(currentUser?.name)

  const allowed = navItems.filter(n => {
    if (n.permission === 'items' && currentUser?.role === 'cashier') return true
    return canAccess(currentUser?.role, n.permission)
  })

  return (
    <div className="h-full flex flex-col bg-surface-900 overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center gap-3 px-4 py-3 bg-surface-800 border-b border-white/5 shrink-0 z-10">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <Menu size={22} className="text-white" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <img src="/logo.png" alt="Mundakathil Stores" className="h-7 object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: bg }}>
            {currentUser?.name?.[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-slate-300 hidden sm:block">{currentUser?.name}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-surface-800 z-50 border-r border-white/8 flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: bg }}>
              {currentUser?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-white">{currentUser?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{currentUser?.role}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-white/10">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {allowed.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path
            return (
              <button key={path} onClick={() => go(path)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl mb-1 transition-all text-left ${active ? 'bg-brand-500 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                <Icon size={20} />
                <span className="font-medium">{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/5">
          <button onClick={() => { logout(); setSidebarOpen(false) }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Switch User / Logout</span>
          </button>
        </div>
      </aside>
    </div>
  )
}