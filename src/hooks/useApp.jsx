import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shopos_user')) } catch { return null }
  })
  const [settings, setSettings] = useState({
    store_name: 'My Store', currency_symbol: '₹', tax_rate: 0,
    enable_tax: false, upi_id: '', receipt_footer: 'Thank you for shopping with us!'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.from('store_settings').select('*').limit(1).single()
      .then(({ data }) => { if (data) setSettings(data) })
  }, [])

  const login = useCallback((user) => {
    setCurrentUser(user)
    localStorage.setItem('shopos_user', JSON.stringify(user))
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    localStorage.removeItem('shopos_user')
  }, [])

  const refreshSettings = useCallback(async () => {
    const { data } = await supabase.from('store_settings').select('*').limit(1).single()
    if (data) setSettings(data)
  }, [])

  return (
    <AppContext.Provider value={{ currentUser, login, logout, settings, refreshSettings, sidebarOpen, setSidebarOpen }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)