import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../hooks/useApp'
import { Search, Calendar, ChevronRight, X, Edit2, Plus, Minus, Trash2, Save, AlertCircle, Ban, Delete } from 'lucide-react'
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
  const [voiding, setVoiding] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [qtyPadIdx, setQtyPadIdx] = useState(null)
  const [qtyPadInput, setQtyPadInput] = useState('')

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
    setShowAddItem(false)
    setAddSearch('')
    const { data } = await supabase.from('transaction_items').select('*').eq('transaction_id', txn.id)
    setTxnItems(data || [])
    setEditItems(data ? data.map(i => ({ ...i })) : [])
  }

  const closeReceipt = () => {
    setSelected(null)
    setEditMode(false)
    setShowAddItem(false)
    setQtyPadIdx(null)
    setQtyPadInput('')
  }

  // Apply a stock change to a single item without relying on SQL-side arithmetic
  // (the previous version called supabase.raw(), which doesn't exist on the JS client
  // and was throwing on every edit save). Negative results are allowed on purpose —
  // see the note on the Items page / Sales checkout for why.
  const adjustStock = async (itemId, delta) => {
    if (!itemId || !delta) return
    const { data: row, error } = await supabase.from('items')
      .select('stock_quantity, track_stock').eq('id', itemId).single()
    if (error || !row || !row.track_stock) return
    await supabase.from('items')
      .update({ stock_quantity: (row.stock_quantity || 0) + delta })
      .eq('id', itemId)
  }

  const addItemToEdit = (item) => {
    setEditItems(prev => {
      const existing = prev.find(e => e.item_id === item.id)
      if (existing) {
        return prev.map(e => e.item_id === item.id ? { ...e, quantity: e.quantity + 1 } : e)
      }
      return [...prev, {
        item_id: item.id,
        item_name: item.name,
        item_price: item.price,
        item_cost: item.cost,
        quantity: 1,
      }]
    })
    setShowAddItem(false)
    setAddSearch('')
  }

  const removeEditItem = (idx) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx))
  }

  const openQtyPad = (idx) => {
    setQtyPadIdx(idx)
    setQtyPadInput(String(editItems[idx].quantity))
  }

  const numpadPress = (val) => {
    if (val === 'back') setQtyPadInput(p => p.slice(0, -1))
    else setQtyPadInput(p => (p === '0' ? val : p + val))
  }

  const applyQtyPad = () => {
    const num = Number(qtyPadInput)
    if (qtyPadIdx === null) return
    if (!qtyPadInput || num <= 0) {
      removeEditItem(qtyPadIdx)
    } else {
      setEditItems(prev => prev.map((e, i) => i === qtyPadIdx ? { ...e, quantity: num } : e))
    }
    setQtyPadIdx(null)
    setQtyPadInput('')
  }

  const saveEdit = async () => {
    if (!selected) return
    if (editItems.length === 0) {
      alert('An invoice needs at least one item. Use "Void Receipt" to cancel it entirely.')
      return
    }
    setSaving(true)
    try {
      // Mark original as superseded
      const { error: supersedeErr } = await supabase.from('transactions')
        .update({ status: 'superseded' }).eq('id', selected.id)
      if (supersedeErr) throw supersedeErr

      // New totals
      const newSubtotal = editItems.reduce((s, i) => s + (i.item_price * i.quantity), 0)
      const newTotal = newSubtotal - (selected.discount_amount || 0)

      // Create new transaction
      const { data: newTxn, error: insertErr } = await supabase.from('transactions').insert({
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
      if (insertErr) throw insertErr

      // Insert new items
      const { error: itemsErr } = await supabase.from('transaction_items').insert(
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
      if (itemsErr) throw itemsErr

      // Stock adjustments: reverse every old line, apply every new line (covers items
      // that were added or removed entirely during the edit, not just quantity changes).
      const diffByItem = {}
      txnItems.forEach(old => {
        if (old.item_id) diffByItem[old.item_id] = (diffByItem[old.item_id] || 0) + old.quantity
      })
      editItems.forEach(ne => {
        if (ne.item_id) diffByItem[ne.item_id] = (diffByItem[ne.item_id] || 0) - ne.quantity
      })
      for (const [itemId, diff] of Object.entries(diffByItem)) {
        if (diff !== 0) await adjustStock(itemId, diff)
      }

      setSaving(false)
      setEditMode(false)
      setSelected(null)
      load()
      alert('Invoice updated successfully!')
    } catch (e) {
      setSaving(false)
      alert('Error saving changes: ' + (e.message || 'Something went wrong. Please try again.'))
    }
  }

  const voidReceipt = async () => {
    if (!selected) return
    if (!window.confirm('Cancel this entire receipt? Stock for all items on it will be added back, and this cannot be undone.')) return
    setVoiding(true)
    try {
      const { error } = await supabase.from('transactions')
        .update({ status: 'void' }).eq('id', selected.id)
      if (error) throw error

      for (const item of txnItems) {
        if (item.item_id) await adjustStock(item.item_id, item.quantity)
      }

      setVoiding(false)
      closeReceipt()
      load()
      alert('Receipt cancelled and stock restored.')
    } catch (e) {
      setVoiding(false)
      alert('Error cancelling receipt: ' + (e.message || 'Something went wrong. Please try again.'))
    }
  }

  const filtered = transactions.filter(t =>
    !search || t.transaction_number.includes(search) ||
    (t.customer_phone || '').includes(search)
  )

  const addItemOptions = allItems.filter(i =>
    !addSearch || i.name.toLowerCase().includes(addSearch.toLowerCase()) || (i.barcode || '').includes(addSearch)
  )

  const statusColor = { completed: 'text-green-400', superseded: 'text-slate-500', refunded: 'text-red-400', void: 'text-red-400' }
  const editTotal = editItems.reduce((s, i) => s + i.item_price * i.quantity, 0) - (selected?.discount_amount || 0)

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
                  {txn.status === 'superseded' ? '(edited)' : txn.status === 'void' ? '(cancelled)' : ''}
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
        <div className="modal-overlay" onClick={closeReceipt}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <div>
                <h3 className="text-white font-bold">{selected.transaction_number}</h3>
                <p className="text-slate-400 text-xs">{formatDate(selected.created_at, 'full')}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && selected.status === 'completed' && !editMode && (
                  <>
                    <button onClick={() => setEditMode(true)} className="p-2 rounded-xl bg-brand-500/20 text-brand-400 hover:bg-brand-500/30" title="Edit receipt">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={voidReceipt} disabled={voiding} className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30" title="Cancel entire receipt">
                      <Ban size={16} />
                    </button>
                  </>
                )}
                <button onClick={closeReceipt}><X size={20} className="text-slate-400" /></button>
              </div>
            </div>

            {editMode && (
              <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <p className="text-amber-300 text-xs">Editing creates a new invoice and updates stock. The original is kept for audit.</p>
              </div>
            )}
            {voiding && (
              <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-red-300 text-xs">Cancelling receipt and restoring stock...</p>
              </div>
            )}

            <div className="p-5 space-y-2">
              {(editMode ? editItems : txnItems).map((item, idx) => (
                <div key={item.id || `${item.item_id}-${idx}`} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <div className="flex-1">
                    <p className="text-white text-sm">{item.item_name}</p>
                    <p className="text-slate-500 text-xs">{formatCurrency(item.item_price, sym)} each</p>
                  </div>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditItems(p => p.map((e,i) => i===idx ? {...e, quantity: Math.max(0, e.quantity-1)} : e).filter(e => e.quantity > 0))}
                        className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center shrink-0">
                        <Minus size={14} className="text-white" />
                      </button>
                      <button onClick={() => openQtyPad(idx)}
                        className="text-white w-8 text-center font-semibold text-sm rounded-lg hover:bg-white/10 py-0.5">
                        {item.quantity}
                      </button>
                      <button onClick={() => setEditItems(p => p.map((e,i) => i===idx ? {...e, quantity: e.quantity+1} : e))}
                        className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
                        <Plus size={14} className="text-white" />
                      </button>
                      <button onClick={() => removeEditItem(idx)}
                        className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center shrink-0" title="Remove item">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">x{item.quantity}</span>
                  )}
                  {!editMode && (
                    <span className="text-white font-semibold text-sm w-16 text-right">
                      {formatCurrency(item.item_price * item.quantity, sym)}
                    </span>
                  )}
                </div>
              ))}

              {editMode && (
                <button onClick={() => setShowAddItem(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/15 text-slate-400 hover:text-white hover:border-white/30 transition-all text-sm mt-1">
                  <Plus size={16} /> Add Item
                </button>
              )}
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
                <span>Total</span>
                <span>{formatCurrency(editMode ? Math.max(0, editTotal) : selected.total, sym)}</span>
              </div>
              {editMode && (
                <div className="flex gap-3 mt-4">
                  <button onClick={() => { setEditMode(false); setEditItems(txnItems.map(i => ({ ...i }))) }} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <Save size={16} />{saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Item Picker */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <h3 className="text-white font-bold">Add Item to Receipt</h3>
              <button onClick={() => setShowAddItem(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-4 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input-field pl-9 py-2 text-sm" placeholder="Search items..."
                  value={addSearch} onChange={e => setAddSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto px-2 pb-4">
              {addItemOptions.map(item => (
                <button key={item.id} onClick={() => addItemToEdit(item)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                  <span className="text-white text-sm">{item.name}</span>
                  <span className="text-brand-400 text-sm font-semibold">{formatCurrency(item.price, sym)}</span>
                </button>
              ))}
              {addItemOptions.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">No items found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Numeric Pad for Quantity Edit */}
      {qtyPadIdx !== null && (
        <div className="modal-overlay" onClick={() => { setQtyPadIdx(null); setQtyPadInput('') }}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-white font-bold text-lg">{editItems[qtyPadIdx]?.item_name}</h3>
              <button onClick={() => { setQtyPadIdx(null); setQtyPadInput('') }} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">Set quantity</p>

            <div className="text-center text-4xl font-bold text-white mb-6 h-16 flex items-center justify-center bg-surface-700 rounded-xl font-mono">
              {qtyPadInput || '0'}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => numpadPress(String(n))} className="numpad-btn">{n}</button>
              ))}
              <div />
              <button onClick={() => numpadPress('0')} className="numpad-btn">0</button>
              <button onClick={() => numpadPress('back')} className="numpad-btn"><Delete size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setQtyPadIdx(null); setQtyPadInput('') }} className="btn-secondary py-3">Cancel</button>
              <button onClick={applyQtyPad} className="btn-primary py-3">Set Quantity</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}