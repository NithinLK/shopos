import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../hooks/useApp'
import {
  Plus, Search, X, Edit2, Package,
  ToggleLeft, ToggleRight, ChevronDown,
  AlertTriangle, Download
} from 'lucide-react'
import { formatCurrency, canAccess, getStockStatus, sanitizeInput, sanitizeNumber } from '../utils/helpers'

const emptyItem = {
  name: '', price: '', cost: '', category_id: '', barcode: '',
  sku: '', track_stock: false, stock_quantity: '', low_stock_alert: 5,
  expiry_date: '', is_active: true
}

export default function ItemsPage() {
  const { currentUser, settings } = useApp()
  const sym = settings.currency_symbol || '₹'
  const canEdit = canAccess(currentUser?.role, 'edit_items')

  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStock, setFilterStock] = useState('all') // all | low | out | tracked
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('items')
      .select('*, categories(name, color)')
      .order('name')
    setItems(data || [])
  }

  useEffect(() => {
    load()
    supabase.from('categories').select('*').order('name')
      .then(({ data }) => setCategories(data || []))
  }, [])

  // ── Filtering ──────────────────────────────────────────────
  const filtered = items.filter(item => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      item.name.toLowerCase().includes(q) ||
      (item.barcode || '').toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q)
    const matchCat = filterCategory === 'all' || item.category_id === filterCategory
    const matchStock =
      filterStock === 'all' ? true :
      filterStock === 'out' ? (item.track_stock && item.stock_quantity <= 0) :
      filterStock === 'low' ? (item.track_stock && item.stock_quantity > 0 && item.stock_quantity <= (item.low_stock_alert || 5)) :
      filterStock === 'tracked' ? item.track_stock : true
    return matchSearch && matchCat && matchStock
  })

  // ── CSV Export ─────────────────────────────────────────────
  const exportCSV = () => {
    const headers = [
      'Name', 'Price', 'Cost', 'Category', 'SKU', 'Barcode',
      'Track Stock', 'Stock Qty', 'Low Stock Alert',
      'Expiry Date', 'Active'
    ]
    const rows = filtered.map(item => [
      `"${(item.name || '').replace(/"/g, '""')}"`,
      item.price || 0,
      item.cost || '',
      `"${item.categories?.name || ''}"`,
      item.sku || '',
      item.barcode || '',
      item.track_stock ? 'Yes' : 'No',
      item.track_stock ? (item.stock_quantity || 0) : '',
      item.track_stock ? (item.low_stock_alert || 5) : '',
      item.expiry_date || '',
      item.is_active ? 'Yes' : 'No'
    ])

    // Summary rows at bottom
    const totalItems = filtered.length
    const totalValue = filtered.reduce((sum, i) =>
      sum + (i.track_stock ? (i.stock_quantity || 0) * (i.price || 0) : 0), 0)
    const outOfStock = filtered.filter(i => i.track_stock && i.stock_quantity <= 0).length
    const lowStock = filtered.filter(i =>
      i.track_stock && i.stock_quantity > 0 &&
      i.stock_quantity <= (i.low_stock_alert || 5)).length

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      '',
      `"SUMMARY"`,
      `"Total Items","${totalItems}"`,
      `"Out of Stock","${outOfStock}"`,
      `"Low Stock","${lowStock}"`,
      `"Total Stock Value (tracked items)","${sym}${totalValue.toFixed(2)}"`,
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mundakathil-items-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Form helpers ───────────────────────────────────────────
  const openForm = (item = null) => {
    setEditItem(item)
    setForm(item
      ? { ...item, price: item.price || '', cost: item.cost || '', stock_quantity: item.stock_quantity || '' }
      : emptyItem)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) return alert('Item name is required')
    if (!form.price && form.price !== 0) return alert('Price is required')
    setSaving(true)
    const payload = {
      name: sanitizeInput(form.name),
      price: sanitizeNumber(form.price, 0, 999999),
      cost: form.cost !== '' ? sanitizeNumber(form.cost, 0, 999999) : null,
      category_id: form.category_id || null,
      barcode: sanitizeInput(form.barcode) || null,
      sku: sanitizeInput(form.sku) || null,
      track_stock: form.track_stock,
      // Negative allowed on purpose: lets stock reflect an oversold item (sales exceeded
      // recorded inventory). Reports still count units sold from transaction line items,
      // not from this value, so oversold stock never affects sales/profit reporting.
      stock_quantity: form.track_stock ? sanitizeNumber(form.stock_quantity, -999999, 999999) : 0,
      low_stock_alert: sanitizeNumber(form.low_stock_alert, 1, 9999),
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

  const today = new Date().toISOString().slice(0, 10)
  const soonDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  // ── Stock summary counts ───────────────────────────────────
  const outCount = items.filter(i => i.track_stock && i.stock_quantity <= 0).length
  const lowCount = items.filter(i =>
    i.track_stock && i.stock_quantity > 0 &&
    i.stock_quantity <= (i.low_stock_alert || 5)).length

  return (
    <div className="h-full flex flex-col bg-surface-900">

      {/* ── Header ── */}
      <div className="px-4 py-3 bg-surface-800 border-b border-white/5 space-y-2">
        {/* Search + buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-9 py-2 text-sm"
              placeholder="Search name, SKU, barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="off" autoCorrect="off"
              autoCapitalize="off" spellCheck={false}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            title="Export to CSV"
            className="p-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 border border-white/10 text-slate-400 hover:text-white transition-all active:scale-95 shrink-0">
            <Download size={18} />
          </button>

          {/* Add Item (admin/manager only) */}
          {canEdit && (
            <button onClick={() => openForm()}
              className="btn-primary flex items-center gap-2 shrink-0">
              <Plus size={18} />
              <span className="hidden sm:inline">Add Item</span>
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Stock status filters */}
          {[
            { key: 'all', label: `All (${items.length})` },
            { key: 'out', label: `Out of Stock (${outCount})`, color: outCount > 0 ? 'text-red-400' : '' },
            { key: 'low', label: `Low Stock (${lowCount})`, color: lowCount > 0 ? 'text-amber-400' : '' },
            { key: 'tracked', label: 'Tracked' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStock(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                ${filterStock === f.key
                  ? 'bg-brand-500 text-white'
                  : `bg-surface-700 hover:text-white ${f.color || 'text-slate-400'}`}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Column headers ── */}
      <div className="grid grid-cols-12 px-4 py-2 border-b border-white/5 text-xs text-slate-500 font-medium bg-surface-900 sticky top-0 z-10">
        <div className="col-span-5">ITEM NAME</div>
        <div className="col-span-3 text-right">PRICE / COST</div>
        <div className="col-span-3 text-right">STOCK</div>
        <div className="col-span-1" />
      </div>

      {/* ── Item list ── */}
      <div className="flex-1 overflow-y-auto no-bounce">
        {filtered.map(item => {
          const stockStatus = getStockStatus(item)
          const expired = item.expiry_date && item.expiry_date < today
          const expiringSoon = item.expiry_date && !expired &&
            item.expiry_date <= soonDate
          return (
            <div key={item.id}
              className="grid grid-cols-12 items-center px-4 py-3.5 border-b border-white/5 hover:bg-white/3 transition-colors">
              {/* Name */}
              <div className="col-span-5 min-w-0 pr-2">
                <p className={`font-medium text-sm truncate ${!item.is_active ? 'text-slate-500 line-through' : 'text-white'}`}>
                  {item.name}
                </p>
                {item.categories && (
                  <p className="text-xs text-slate-500 truncate">{item.categories.name}</p>
                )}
                {item.sku && (
                  <p className="text-xs text-slate-600 font-mono">SKU: {item.sku}</p>
                )}
                {expired && (
                  <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={10} /> Expired!
                  </p>
                )}
                {expiringSoon && (
                  <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={10} /> Expires {item.expiry_date}
                  </p>
                )}
              </div>

              {/* Price / Cost */}
              <div className="col-span-3 text-right">
                <span className="text-brand-400 font-semibold text-sm">
                  {formatCurrency(item.price, sym)}
                </span>
                {item.cost != null && item.cost !== '' && (
                  <p className="text-xs text-slate-500">
                    Cost: {formatCurrency(item.cost, sym)}
                  </p>
                )}
                {item.cost != null && item.cost !== '' && item.price && (
                  <p className="text-xs text-green-500">
                    +{formatCurrency(item.price - item.cost, sym)}
                  </p>
                )}
              </div>

              {/* Stock */}
              <div className="col-span-3 text-right">
                {item.track_stock ? (
                  stockStatus === 'negative'
                    ? <span className="negative-stock" title="Sold more than was in stock">Oversold: {item.stock_quantity}</span>
                    : stockStatus === 'out'
                    ? <span className="out-stock">Out</span>
                    : stockStatus === 'low'
                    ? <span className="low-stock">Low: {item.stock_quantity}</span>
                    : <span className="in-stock-badge">{item.stock_quantity}</span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </div>

              {/* Edit */}
              <div className="col-span-1 flex justify-end">
                {canEdit && (
                  <button onClick={() => openForm(item)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
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
            <p className="text-sm">No items found</p>
            {canEdit && search === '' && (
              <button onClick={() => openForm()} className="mt-4 btn-primary text-sm">
                Add First Item
              </button>
            )}
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 text-center text-xs text-slate-600">
            Showing {filtered.length} of {items.length} items
            {search && ` matching "${search}"`}
          </div>
        )}
      </div>

      {/* ── Add/Edit Form Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <h3 className="text-white font-bold text-lg">
                {editItem ? 'Edit Item' : 'New Item'}
              </h3>
              <button onClick={() => setShowForm(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Form fields */}
            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '65vh' }}>
              {/* Name */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Item Name *</label>
                <input className="input-field" placeholder="e.g. Masala Tea"
                  value={form.name} onChange={e => f('name', e.target.value)} />
              </div>

              {/* Price + Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Selling Price ({sym}) *</label>
                  <input type="number" inputMode="decimal" className="input-field"
                    placeholder="0.00" value={form.price}
                    onChange={e => f('price', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Cost Price ({sym})</label>
                  <input type="number" inputMode="decimal" className="input-field"
                    placeholder="0.00" value={form.cost}
                    onChange={e => f('cost', e.target.value)} />
                </div>
              </div>

              {/* Margin preview */}
              {form.price && form.cost && Number(form.price) > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 text-xs text-green-400">
                  Margin: {formatCurrency(Number(form.price) - Number(form.cost), sym)}
                  {' '}({((Number(form.price) - Number(form.cost)) / Number(form.price) * 100).toFixed(1)}%)
                </div>
              )}

              {/* Category */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Category</label>
                <div className="relative">
                  <select className="input-field appearance-none pr-8"
                    value={form.category_id}
                    onChange={e => f('category_id', e.target.value)}>
                    <option value="">No Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Barcode + SKU */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Barcode</label>
                  <input className="input-field font-mono text-sm"
                    placeholder="Scan or type"
                    value={form.barcode}
                    onChange={e => f('barcode', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">SKU</label>
                  <input className="input-field font-mono text-sm"
                    placeholder="e.g. 10034"
                    value={form.sku}
                    onChange={e => f('sku', e.target.value)} />
                </div>
              </div>

              {/* Expiry date */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Expiry Date</label>
                <input type="date" className="input-field"
                  value={form.expiry_date || ''}
                  onChange={e => f('expiry_date', e.target.value)} />
              </div>

              {/* Track stock toggle */}
              <div className="flex items-center justify-between p-3 bg-surface-700 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Track Stock</p>
                  <p className="text-slate-500 text-xs">Monitor inventory levels</p>
                </div>
                <button onClick={() => f('track_stock', !form.track_stock)}>
                  {form.track_stock
                    ? <ToggleRight size={28} className="text-brand-400" />
                    : <ToggleLeft size={28} className="text-slate-500" />}
                </button>
              </div>

              {/* Stock qty + alert (only when tracking) */}
              {form.track_stock && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">In Stock Qty</label>
                    <input type="number" inputMode="decimal" className="input-field"
                      placeholder="0"
                      value={form.stock_quantity}
                      onChange={e => f('stock_quantity', e.target.value)} />
                    {Number(form.stock_quantity) < 0 && (
                      <p className="text-xs text-red-400 mt-1">Oversold — more was sold than was recorded in stock</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Low Stock Alert</label>
                    <input type="number" inputMode="numeric" className="input-field"
                      placeholder="5"
                      value={form.low_stock_alert}
                      onChange={e => f('low_stock_alert', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 bg-surface-700 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Visible in POS</p>
                  <p className="text-slate-500 text-xs">Show this item on sales screen</p>
                </div>
                <button onClick={() => f('is_active', !form.is_active)}>
                  {form.is_active
                    ? <ToggleRight size={28} className="text-brand-400" />
                    : <ToggleLeft size={28} className="text-slate-500" />}
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-white/5">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}