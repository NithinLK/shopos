import { useState, useEffect } from 'react'
import { useApp } from '../hooks/useApp'
import { supabase } from '../utils/supabase'
import { Store, Delete } from 'lucide-react'
import { nameToColor } from '../utils/helpers'

export default function LoginPage() {
  const { login, settings } = useApp()
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('users').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [])

  const handlePin = (digit) => {
    if (pin.length >= 4) return
    const newPin = pin + digit
    setPin(newPin)
    setError('')
    if (newPin.length === 4) {
      setTimeout(() => checkPin(newPin), 100)
    }
  }

  const checkPin = async (enteredPin) => {
    if (enteredPin === selected.pin_code) {
      login(selected)
    } else {
      setError('Wrong PIN. Try again.')
      setPin('')
    }
  }

  const backspace = () => { setPin(p => p.slice(0, -1)); setError('') }

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-surface-900">
      <div className="text-center">
        <Store size={48} className="text-brand-400 mx-auto mb-4 animate-pulse" />
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  )

  return (
    <div className="h-full bg-surface-900 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Mundakathil Stores" className="h-24 object-contain mx-auto mb-2" />
<p className="text-slate-400 text-sm mt-1">Point of Sale</p>
        </div>

        {!selected ? (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">Select your profile</p>
            <div className="grid grid-cols-2 gap-3">
              {users.map(u => (
                <button key={u.id} onClick={() => setSelected(u)}
                  className="card p-4 flex flex-col items-center gap-2 hover:border-brand-500/30 hover:bg-surface-600 transition-all active:scale-95">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                    style={{ background: nameToColor(u.name) }}>
                    {u.name[0].toUpperCase()}
                  </div>
                  <span className="text-white font-medium text-sm text-center">{u.name}</span>
                  <span className={`role-${u.role}`}>{u.role}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="animate-fade-in">
            {/* Selected user */}
            <div className="flex items-center gap-3 mb-6 p-4 card">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: nameToColor(selected.name) }}>
                {selected.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white">{selected.name}</p>
                <p className="text-xs text-slate-400 capitalize">{selected.role}</p>
              </div>
              <button onClick={() => { setSelected(null); setPin(''); setError('') }}
                className="ml-auto text-slate-400 hover:text-white text-sm underline">Change</button>
            </div>

            {/* PIN dots */}
            <p className="text-center text-slate-400 text-sm mb-4">Enter your PIN</p>
            <div className="flex justify-center gap-4 mb-6">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${i < pin.length ? 'bg-brand-400 border-brand-400' : 'border-white/30'}`} />
              ))}
            </div>
            {error && <p className="text-red-400 text-sm text-center mb-4 animate-fade-in">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => handlePin(String(n))} className="numpad-btn">{n}</button>
              ))}
              <div />
              <button onClick={() => handlePin('0')} className="numpad-btn">0</button>
              <button onClick={backspace} className="numpad-btn">
                <Delete size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}