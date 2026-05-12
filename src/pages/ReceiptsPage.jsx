import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../hooks/useApp'
import { Search, Calendar, ChevronRight, X, Edit2, Plus, Minus, Save, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate, canAccess, generateTxnNumber } from '../utils/helpers'

export default function ReceiptsPage() {
  const { currentUser, settings } = useApp()
  const sym = settings.currency_symbol || '₹'
  const canEdit = canAccess(currentUser?.role, 'edit_invoice')
  const [transactions, setTransactions] = useState([])
  const [selected, setSelected] = useState(null)
  const [txnItems, setTxnItems] = useState([])
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('today')
  const [editMode, setEditMode] = useState(false)
  const [editItems, setEditItems] = useState([])
  const [allItems, setAllItems] = useState([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    let q = supabase.from('transactions').select('*, users(name)').order('created_at', { ascending: false })
    if (dateFilter === 'today') {
      const today = new Date(); today.setHours(0,0,0,0)
      q = q.gte('created_at', today.toISOString())
    } else if (dateFilter === 'week') {
      const w = new Date(); w.setDate(w.getDate()-7)
      q = q.gte('created_at', w.toISOString())
    }
    const { data } = await q
    setTransactions(data || [])
  }

  useEffect(() => { load() }, [dateFilter])

  useEffect(() => {
    supabase.from('items').select('*').eq('is_active', true).order('name').then(({ data }) => setAllItems(data || []))
  }, [])

  const openReceipt = async (txn) => {
    setSelected(txn)
    setEditMode(false)
    const { data } = await supabase.from('transaction_items').select('*').eq('transaction_id', txn.id)
    setTxnItems(data || [])
    setEditItems(data ? data.map(i => ({ ...i })) : [])
  }

  const saveEdit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      // Mark original as superseded
      await supabase.from('transactions').update({ status: 'superseded' }).eq('id', selected.id)

      // New totals
      const newSubtotal = editItems.reduce((s, i) => s + (i.item_price * i.quantity), 0)
      const newTotal = newSubtotal - (selected.discount_amount || 0)

      // Create new transaction
      const { data: newTxn } = await supabase.from('transactions').insert({
        transaction_number: generateTxnNumber(),
        status: 'completed',
        payment_method: selected.payment_method,
        subtotal: newSubtotal,
        discount_amount: selected.discount_amount,
        discount_type: selected.discount_type,
        discount_value: selected.discount_value,
        total: Math.max(0, newTotal),
        cashier_id: currentUser.id,
        original_transaction_id: selected.id,
      }).select().single()

      // Insert new items
      await supabase.from('transaction_items').insert(
        editItems.map(i => ({
          transaction_id: newTxn.id,
          item_id: i.item_id,
          item_name: i.item_name,
          item_price: i.item_price,
          item_cost: i.item_cost,
          quantity: i.quantity,
          line_total: i.item_price * i.quantity,
        }))
      )

      // Stock adjustments: reverse old, apply new
      for (const old of txnItems) {
        if (old.item_id) {
          const newQty = editItems.find(e => e.item_id === old.item_id)?.quantity || 0
          const diff = old.quantity - newQty
          if (diff !== 0) {
            await supabase.from('items').update({
              stock_quantity: supabase.raw(`stock_quantity + ${diff}`)
            }).eq('id', old.item_id).eq('track_stock', true)
          }
        }
      }

      setSaving(false)
      setEditMode(false)
      setSelected(null)
      load()
      alert('Invoice updated successfully!')
    } catch (e) {
      setSaving(false)
      alert('Error: ' + e.message)
    }
  }

  const filtered = transactions.filter(t =>
    !search || t.transaction_number.includes(search) ||
    (t.customer_phone || '').includes(search)
  )

  const statusColor = { completed: 'text-green-400', superseded: 'text-slate-500', refunded: 'text-red-400', void: 'text-red-400' }

  return (
    <div className="h-full flex flex-col bg-surface-900">
      {/* Header */}
      <div className="px-4 py-3 bg-surface-800 border-b border-white/5 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field pl-9 py-2 text-sm" placeholder="Search by receipt number or phone..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['today','week','all'].map(f => (
            <button key={f} onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${dateFilter === f ? 'bg-brand-500 text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}>
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-bounce">
        {filtered.map(txn => (
          <button key={txn.id} onClick={() => openReceipt(txn)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/5 hover:bg-white/3 transition-colors text-left">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">{txn.transaction_number}</span>
                <span className={`text-xs font-medium capitalize ${statusColor[txn.status] || 'text-slate-400'}`}>
                  {txn.status === 'superseded' ? '(edited)' : ''}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">{formatDate(txn.created_at, 'full')} • {txn.users?.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white font-semibold">{formatCurrency(txn.total, sym)}</p>
              <p className="text-xs text-slate-500 capitalize">{txn.payment_method}</p>
            </div>
            <ChevronRight size={16} className="text-slate-600 shrink-0" />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Calendar size={40} className="mb-3 opacity-30" />
            <p>No receipts found</p>
          </div>
        )}
      </div>

      {/* Receipt Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <div>
                <h3 className="text-white font-bold">{selected.transaction_number}</h3>
                <p className="text-slate-400 text-xs">{formatDate(selected.created_at, 'full')}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && selected.status === 'completed' && !editMode && (
                  <button onClick={() => setEditMode(true)} className="p-2 rounded-xl bg-brand-500/20 text-brand-400 hover:bg-brand-500/30">
                    <Edit2 size={16} />
                  </button>
                )}
                <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
              </div>
            </div>

            {editMode && (
              <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <p className="text-amber-300 text-xs">Editing creates a new invoice. Original is kept for audit.</p>
              </div>
            )}

            <div className="p-5 space-y-2">
              {(editMode ? editItems : txnItems).map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <div className="flex-1">
                    <p className="text-white text-sm">{item.item_name}</p>
                    <p className="text-slate-500 text-xs">{formatCurrency(item.item_price, sym)} each</p>
                  </div>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditItems(p => p.map((e,i) => i===idx ? {...e, quantity: Math.max(0, e.quantity-1)} : e).filter(e => e.quantity > 0))}
                        className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center">
                        <Minus size={14} className="text-white" />
                      </button>
                      <span className="text-white w-6 text-center font-semibold text-sm">{item.quantity}</span>
                      <button onClick={() => setEditItems(p => p.map((e,i) => i===idx ? {...e, quantity: e.quantity+1} : e))}
                        className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">x{item.quantity}</span>
                  )}
                  <span className="text-white font-semibold text-sm w-16 text-right">
                    {formatCurrency(item.item_price * item.quantity, sym)}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-5 pb-5 space-y-2 border-t border-white/5 pt-4">
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Payment</span><span className="capitalize">{selected.payment_method}</span>
              </div>
              {selected.discount_amount > 0 && (
                <div className="flex justify-between text-green-400 text-sm">
                  <span>Discount</span><span>-{formatCurrency(selected.discount_amount, sym)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/10">
                <span>Total</span><span>{formatCurrency(selected.total, sym)}</span>
              </div>
              {editMode && (
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setEditMode(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <Save size={16} />{saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}