import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../hooks/useApp'
import { Plus, Edit2, X, Users, ToggleLeft, ToggleRight } from 'lucide-react'
import { nameToColor, canAccess } from '../utils/helpers'

const emptyUser = { name:'', pin_code:'', role:'cashier', is_active:true }

export default function StaffPage() {
  const { currentUser } = useApp()
  const canEdit = canAccess(currentUser?.role, 'staff')
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState(emptyUser)
  const [saving, setSaving] = useState(false)

  const load = () => supabase.from('users').select('*').order('name').then(({ data }) => setUsers(data || []))
  useEffect(() => { load() }, [])

  const openForm = (user = null) => {
    setEditUser(user); setForm(user ? { ...user, pin_code: '' } : emptyUser); setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) return alert('Name is required')
    if (!editUser && (!form.pin_code || form.pin_code.length !== 4)) return alert('4-digit PIN required')
    if (form.pin_code && form.pin_code.length !== 4) return alert('PIN must be exactly 4 digits')
    setSaving(true)
    const payload = { name: form.name.trim(), role: form.role, is_active: form.is_active }
    if (form.pin_code) payload.pin_code = form.pin_code
    if (editUser) await supabase.from('users').update(payload).eq('id', editUser.id)
    else await supabase.from('users').insert({ ...payload, pin_code: form.pin_code })
    setSaving(false); setShowForm(false); load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="h-full flex flex-col bg-surface-900">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-800 border-b border-white/5">
        <h2 className="text-white font-bold">Staff Members</h2>
        {canEdit && (
          <button onClick={() => openForm()} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Add Staff
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-bounce p-4 space-y-3">
        {users.map(u => (
          <div key={u.id} className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
              style={{ background: nameToColor(u.name) }}>
              {u.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold">{u.name}</p>
                {!u.is_active && <span className="text-xs text-slate-500 bg-slate-500/10 px-2 py-0.5 rounded">Inactive</span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`role-${u.role}`}>{u.role}</span>
                <span className="text-slate-500 text-xs">PIN: {'•'.repeat(4)}</span>
              </div>
            </div>
            {canEdit && (
              <button onClick={() => openForm(u)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white">
                <Edit2 size={16} />
              </button>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Users size={40} className="mb-3 opacity-30" />
            <p>No staff added yet</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <h3 className="text-white font-bold text-lg">{editUser ? 'Edit Staff' : 'New Staff Member'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Full Name *</label>
                <input className="input-field" placeholder="e.g. Rahul Kumar" value={form.name} onChange={e => f('name', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">{editUser ? 'New PIN (leave blank to keep current)' : '4-Digit PIN *'}</label>
                <input type="password" inputMode="numeric" maxLength={4} className="input-field font-mono tracking-widest text-center text-xl"
                  placeholder="••••" value={form.pin_code} onChange={e => f('pin_code', e.target.value.replace(/\D/g,'').slice(0,4))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {['cashier','manager','admin'].map(r => (
                    <button key={r} onClick={() => f('role', r)}
                      className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${form.role === r ? 'bg-brand-500 text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <div className="mt-2 p-3 bg-surface-700/50 rounded-xl text-xs text-slate-400 space-y-1">
                  <p>🔵 <b className="text-slate-300">Cashier:</b> Sales only, can view items</p>
                  <p>🟡 <b className="text-slate-300">Manager:</b> + Receipts, Reports, Edit invoices</p>
                  <p>🟣 <b className="text-slate-300">Admin:</b> Full access including Staff & Settings</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-700 rounded-xl">
                <p className="text-white text-sm font-medium">Active Account</p>
                <button onClick={() => f('is_active', !form.is_active)}>
                  {form.is_active ? <ToggleRight size={28} className="text-brand-400" /> : <ToggleLeft size={28} className="text-slate-500" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}