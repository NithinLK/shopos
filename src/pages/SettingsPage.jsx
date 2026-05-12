import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../hooks/useApp'
import { Save, Store, Percent, MessageSquare, Smartphone } from 'lucide-react'
import { canAccess } from '../utils/helpers'

export default function SettingsPage() {
  const { settings, currentUser, refreshSettings } = useApp()
  const canEdit = canAccess(currentUser?.role, 'settings')
  const [form, setForm] = useState({ ...settings })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    const { data } = await supabase.from('store_settings').select('id').limit(1).single()
    if (data) await supabase.from('store_settings').update(form).eq('id', data.id)
    else await supabase.from('store_settings').insert(form)
    await refreshSettings()
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="h-full overflow-y-auto no-bounce bg-surface-900 p-4 space-y-4">
      {/* Store Info */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Store size={18} className="text-brand-400" />
          <h3 className="text-white font-semibold">Store Information</h3>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Store Name</label>
          <input className="input-field" value={form.store_name || ''} onChange={e => f('store_name', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Currency Symbol</label>
            <input className="input-field" value={form.currency_symbol || ''} onChange={e => f('currency_symbol', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Currency Code</label>
            <input className="input-field" value={form.currency_code || ''} onChange={e => f('currency_code', e.target.value)} disabled={!canEdit} />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Store Phone</label>
          <input className="input-field" value={form.store_phone || ''} onChange={e => f('store_phone', e.target.value)} disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Store Address</label>
          <textarea className="input-field resize-none" rows={2} value={form.store_address || ''} onChange={e => f('store_address', e.target.value)} disabled={!canEdit} />
        </div>
      </div>

      {/* UPI */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone size={18} className="text-brand-400" />
          <h3 className="text-white font-semibold">Payment</h3>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">UPI ID</label>
          <input className="input-field font-mono" placeholder="yourname@upi" value={form.upi_id || ''} onChange={e => f('upi_id', e.target.value)} disabled={!canEdit} />
        </div>
      </div>

      {/* Tax */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Percent size={18} className="text-brand-400" />
          <h3 className="text-white font-semibold">Tax</h3>
        </div>
        <div className="flex items-center justify-between p-3 bg-surface-700 rounded-xl">
          <p className="text-white text-sm font-medium">Enable Tax</p>
          <button onClick={() => canEdit && f('enable_tax', !form.enable_tax)}
            className={`w-11 h-6 rounded-full transition-colors relative ${form.enable_tax ? 'bg-brand-500' : 'bg-surface-500'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.enable_tax ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {form.enable_tax && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Tax Rate (%)</label>
              <input type="number" className="input-field" value={form.tax_rate || ''} onChange={e => f('tax_rate', e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Tax Name</label>
              <input className="input-field" value={form.tax_name || ''} onChange={e => f('tax_name', e.target.value)} disabled={!canEdit} />
            </div>
          </div>
        )}
      </div>

      {/* Receipt */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={18} className="text-brand-400" />
          <h3 className="text-white font-semibold">Receipt</h3>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Receipt Footer Message</label>
          <textarea className="input-field resize-none" rows={2} value={form.receipt_footer || ''} onChange={e => f('receipt_footer', e.target.value)} disabled={!canEdit} />
        </div>
      </div>

      {canEdit && (
        <button onClick={save} disabled={saving}
          className={`btn-primary w-full flex items-center justify-center gap-2 text-base ${saved ? 'bg-green-500 hover:bg-green-500' : ''}`}>
          <Save size={18} />
          {saved ? 'Saved! ✓' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      )}

      <div className="text-center text-slate-600 text-xs pb-4">ShopOS v1.0 • Built with ❤️</div>
    </div>
  )
}