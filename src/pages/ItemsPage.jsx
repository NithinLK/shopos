import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../hooks/useApp'
import { Plus, Search, X, Edit2, Package, ToggleLeft, ToggleRight, ChevronDown, AlertTriangle } from 'lucide-react'
import { formatCurrency, canAccess, getStockStatus } from '../utils/helpers'

const emptyItem = { name:'', price:'', cost:'', category_id:'', barcode:'', track_stock:false, stock_quantity:'', low_stock_alert:5, expiry_date:'', is_active:true }

export default function ItemsPage() {
  const { currentUser, settings } = useApp()
  const sym = settings.currency_symbol || '₹'
  const canEdit = canAccess(currentUser?.role, 'edit_items')
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('items').select('*, categories(name)').order('name')
    setItems(data || [])
  }

  useEffect(() => {
    load()
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data || []))
  }, [])

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.barcode||'').includes(search))

  const openForm = (item = null) => {
    setEditItem(item)
    setForm(item ? { ...item, price: item.price || '', cost: item.cost || '', stock_quantity: item.stock_quantity || '' } : emptyItem)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.price) return alert('Name and Price are required')
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      cost: form.cost ? Number(form.cost) : null,
      category_id: form.category_id || null,
      barcode: form.barcode || null,
      track_stock: form.track_stock,
      stock_quantity: form.track_stock ? Number(form.stock_quantity || 0) : 0,
      low_stock_alert: Number(form.low_stock_alert || 5),
      expiry_date: form.expiry_date || null,
      is_active: form.is_active,
    }
    if (editItem) {
      await supabase.from('items').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('items').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="h-full flex flex-col bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-800 border-b border-white/5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field pl-9 py-2 text-sm" placeholder="Search items..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canEdit && (
          <button onClick={() => openForm()} className="btn-primary flex items-center gap-2 shrink-0">
            <Plus size={18} /><span className="hidden sm:inline">Add Item</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-bounce">
        {/* Column headers */}
        <div className="grid grid-cols-12 px-4 py-2 border-b border-white/5 text-xs text-slate-500 font-medium">
          <div className="col-span-5">ITEM NAME</div>
          <div className="col-span-3 text-right">PRICE</div>
          <div className="col-span-3 text-right">STOCK</div>
          <div className="col-span-1" />
        </div>

        {filtered.map(item => {
          const stockStatus = getStockStatus(item)
          return (
            <div key={item.id} className="grid grid-cols-12 items-center px-4 py-3.5 border-b border-white/5 hover:bg-white/3 transition-colors">
              <div className="col-span-5">
                <p className={`font-medium text-sm ${!item.is_active ? 'text-slate-500 line-through' : 'text-white'}`}>{item.name}</p>
                {item.categories && <p className="text-xs text-slate-500">{item.categories.name}</p>}
                {item.expiry_date && new Date(item.expiry_date) < new Date(Date.now() + 7*86400000) && (
                  <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={10} /> Expires {new Date(item.expiry_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="col-span-3 text-right">
                <span className="text-brand-400 font-semibold text-sm">{formatCurrency(item.price, sym)}</span>
                {item.cost && <p className="text-xs text-slate-500">Cost: {formatCurrency(item.cost, sym)}</p>}
              </div>
              <div className="col-span-3 text-right">
                {item.track_stock ? (
                  stockStatus === 'out' ? <span className="out-stock">Out of Stock</span> :
                  stockStatus === 'low' ? <span className="low-stock">Low: {item.stock_quantity}</span> :
                  <span className="in-stock-badge">{item.stock_quantity}</span>
                ) : <span className="text-slate-500 text-xs">—</span>}
              </div>
              <div className="col-span-1 flex justify-end">
                {canEdit && (
                  <button onClick={() => openForm(item)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                    <Edit2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Package size={40} className="mb-3 opacity-30" />
            <p>No items found</p>
            {canEdit && <button onClick={() => openForm()} className="mt-4 btn-primary text-sm">Add First Item</button>}
          </div>
        )}
      </div>

      {/* Item Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <h3 className="text-white font-bold text-lg">{editItem ? 'Edit Item' : 'New Item'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Item Name *</label>
                <input className="input-field" placeholder="e.g. Masala Tea" value={form.name} onChange={e => f('name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Price ({sym}) *</label>
                  <input type="number" className="input-field" placeholder="0.00" value={form.price} onChange={e => f('price', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Cost ({sym})</label>
                  <input type="number" className="input-field" placeholder="0.00" value={form.cost} onChange={e => f('cost', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Category</label>
                <div className="relative">
                  <select className="input-field appearance-none pr-8" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                    <option value="">No Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Barcode / SKU</label>
                <input className="input-field font-mono" placeholder="Scan or type barcode" value={form.barcode} onChange={e => f('barcode', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Expiry Date</label>
                <input type="date" className="input-field" value={form.expiry_date || ''} onChange={e => f('expiry_date', e.target.value)} />
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-700 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Track Stock</p>
                  <p className="text-slate-500 text-xs">Monitor inventory levels</p>
                </div>
                <button onClick={() => f('track_stock', !form.track_stock)}>
                  {form.track_stock ? <ToggleRight size={28} className="text-brand-400" /> : <ToggleLeft size={28} className="text-slate-500" />}
                </button>
              </div>
              {form.track_stock && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">In Stock Qty</label>
                    <input type="number" className="input-field" placeholder="0" value={form.stock_quantity} onChange={e => f('stock_quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Low Stock Alert</label>
                    <input type="number" className="input-field" placeholder="5" value={form.low_stock_alert} onChange={e => f('low_stock_alert', e.target.value)} />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-surface-700 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Active / Visible</p>
                  <p className="text-slate-500 text-xs">Show this item in POS</p>
                </div>
                <button onClick={() => f('is_active', !form.is_active)}>
                  {form.is_active ? <ToggleRight size={28} className="text-brand-400" /> : <ToggleLeft size={28} className="text-slate-500" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Item'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}