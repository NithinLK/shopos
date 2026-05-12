import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { useCart } from '../hooks/useCart'
import { useApp } from '../hooks/useApp'
import { Search, X, Plus, Minus, Trash2, Tag, ChevronUp, Delete, CreditCard, Banknote, CheckCircle, Share2, Package } from 'lucide-react'
import { formatCurrency, generateTxnNumber, formatWhatsAppReceipt, formatDate } from '../utils/helpers'

export default function SalesPage() {
  const { settings, currentUser } = useApp()
  const cart = useCart()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [showCart, setShowCart] = useState(false)
  const [qtyModal, setQtyModal] = useState(null)
  const [qtyInput, setQtyInput] = useState('')
  const [discountModal, setDiscountModal] = useState(false)
  const [paymentModal, setPaymentModal] = useState(false)
  const [successModal, setSuccessModal] = useState(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [processing, setProcessing] = useState(false)
  const sym = settings.currency_symbol || '₹'

  useEffect(() => {
    supabase.from('items').select('*, categories(name,color)').eq('is_active', true).order('name')
      .then(({ data }) => setItems(data || []))
    supabase.from('categories').select('*').order('name')
      .then(({ data }) => setCategories(data || []))
  }, [])

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || (item.barcode || '').includes(search)
    const matchCat = activeCategory === 'all' || item.category_id === activeCategory
    return matchSearch && matchCat
  })

  const handleItemTap = (item) => {
    const inCart = cart.items.find(i => i.id === item.id)
    if (inCart) { setQtyModal(item); setQtyInput(String(inCart.quantity)) }
    else cart.addItem(item)
  }

  const applyQty = () => {
    if (qtyInput === '' || Number(qtyInput) <= 0) cart.removeItem(qtyModal.id)
    else cart.setQuantity(qtyModal.id, Number(qtyInput))
    setQtyModal(null); setQtyInput('')
  }

  const numpadPress = (val) => {
    if (val === 'back') setQtyInput(p => p.slice(0,-1))
    else if (val === '.') { if (!qtyInput.includes('.')) setQtyInput(p => p + '.') }
    else setQtyInput(p => p + val)
  }

  const processPayment = async (method) => {
    if (cart.items.length === 0) return
    setProcessing(true)
    try {
      const txnNumber = generateTxnNumber()
      const { data: txn, error } = await supabase.from('transactions').insert({
        transaction_number: txnNumber,
        status: 'completed',
        payment_method: method,
        subtotal: cart.totals.subtotal,
        discount_amount: cart.totals.discountAmount,
        discount_type: cart.discount.type,
        discount_value: cart.discount.value,
        total: cart.totals.total,
        cashier_id: currentUser.id,
      }).select().single()

      if (error) throw error

      const txnItems = cart.items.map(i => ({
        transaction_id: txn.id,
        item_id: i.id,
        item_name: i.name,
        item_price: i.price,
        item_cost: i.cost,
        quantity: i.quantity,
        line_total: i.price * i.quantity - (i.line_discount || 0),
      }))
      await supabase.from('transaction_items').insert(txnItems)

      // Update stock
      for (const item of cart.items) {
        if (item.track_stock) {
          await supabase.from('items').update({
            stock_quantity: Math.max(0, (item.stock_quantity || 0) - item.quantity)
          }).eq('id', item.id)
        }
      }

      setSuccessModal({ txn, items: txnItems, discountAmount: cart.totals.discountAmount })
      setPaymentModal(false)
      cart.clearCart()
      setShowCart(false)
    } catch (e) {
      alert('Payment failed: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  const shareWhatsApp = () => {
    if (!customerPhone || !successModal) return
    const msg = formatWhatsAppReceipt(successModal.txn, successModal.items, settings.store_name, successModal.discountAmount)
    window.open(`https://wa.me/${customerPhone.replace(/\D/g,'')}?text=${msg}`, '_blank')
  }

  const CatalogPanel = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field pl-9 py-2.5 text-sm" placeholder="Search items or scan barcode..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-slate-400" /></button>}
        </div>
      </div>
      {/* Categories */}
      <div className="flex gap-2 px-3 overflow-x-auto pb-2 no-scrollbar">
        <button onClick={() => setActiveCategory('all')} className={`cat-pill ${activeCategory === 'all' ? 'active' : ''}`}>All</button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCategory(c.id)} className={`cat-pill ${activeCategory === c.id ? 'active' : ''}`}>{c.icon} {c.name}</button>
        ))}
      </div>
      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 content-start no-bounce">
        {filtered.map(item => {
          const inCart = cart.items.find(i => i.id === item.id)
          return (
            <button key={item.id} onClick={() => handleItemTap(item)} className={`item-tile ${inCart ? 'in-cart' : ''}`}>
              <div className="flex-1">
                <p className="text-white text-sm font-medium leading-tight line-clamp-2">{item.name}</p>
                {item.categories && <p className="text-xs text-slate-500 mt-0.5">{item.categories.name}</p>}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-brand-400 font-bold text-sm">{formatCurrency(item.price, sym)}</span>
                {inCart && <span className="bg-brand-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{inCart.quantity}</span>}
              </div>
              {item.track_stock && <p className="text-xs text-slate-500 mt-0.5">Stock: {item.stock_quantity}</p>}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 sm:col-span-3 text-center py-12 text-slate-500">
            <Package size={32} className="mx-auto mb-2 opacity-30" />
            <p>No items found</p>
          </div>
        )}
      </div>
    </div>
  )

  const CartPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="font-bold text-white">Current Sale</h2>
        <div className="flex gap-2">
          <button onClick={() => setDiscountModal(true)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white">
            <Tag size={18} />
          </button>
          {cart.items.length > 0 && (
            <button onClick={cart.clearCart} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 no-bounce">
        {cart.items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <ShoppingCartIcon />
            <p className="mt-3 text-sm">Tap items to add them here</p>
          </div>
        ) : (
          cart.items.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-white/5">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.name}</p>
                <p className="text-slate-400 text-xs">{formatCurrency(item.price, sym)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => cart.setQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center hover:bg-surface-500">
                  <Minus size={14} className="text-white" />
                </button>
                <span className="text-white font-semibold w-8 text-center text-sm">{item.quantity}</span>
                <button onClick={() => cart.setQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center hover:bg-brand-600">
                  <Plus size={14} className="text-white" />
                </button>
              </div>
              <span className="text-white font-bold text-sm w-16 text-right">
                {formatCurrency(item.price * item.quantity, sym)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t border-white/5 space-y-2">
        <div className="flex justify-between text-sm text-slate-400">
          <span>Subtotal</span><span>{formatCurrency(cart.totals.subtotal, sym)}</span>
        </div>
        {cart.totals.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-400">
            <span>Discount {cart.discount.type === 'percent' ? `(${cart.discount.value}%)` : ''}</span>
            <span>-{formatCurrency(cart.totals.discountAmount, sym)}</span>
          </div>
        )}
        <div className="flex justify-between text-white font-bold text-lg pt-1 border-t border-white/10">
          <span>Total</span><span>{formatCurrency(cart.totals.total, sym)}</span>
        </div>
        <button onClick={() => setPaymentModal(true)} disabled={cart.items.length === 0} className="charge-btn mt-2">
          CHARGE {formatCurrency(cart.totals.total, sym)}
        </button>
      </div>
    </div>
  )

  return (
    <div className="h-full flex overflow-hidden">
      {/* TABLET: split screen */}
      <div className="hidden md:flex w-full h-full">
        <div className="w-96 border-r border-white/5 flex flex-col bg-surface-800 shrink-0">
          <CartPanel />
        </div>
        <div className="flex-1 overflow-hidden bg-surface-900">
          <CatalogPanel />
        </div>
      </div>

      {/* MOBILE: catalog + slide-up cart */}
      <div className="md:hidden w-full h-full flex flex-col relative">
        <div className="flex-1 overflow-hidden bg-surface-900">
          <CatalogPanel />
        </div>
        {/* Sticky cart bar */}
        {cart.totals.itemCount > 0 && !showCart && (
          <button onClick={() => setShowCart(true)}
            className="fixed bottom-4 left-4 right-4 bg-brand-500 rounded-2xl p-4 flex items-center justify-between shadow-2xl z-20 animate-slide-up">
            <div className="flex items-center gap-3">
              <span className="bg-white text-brand-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">{cart.totals.itemCount}</span>
              <span className="text-white font-semibold">View Cart</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">{formatCurrency(cart.totals.total, sym)}</span>
              <ChevronUp size={18} className="text-white" />
            </div>
          </button>
        )}
        {/* Slide-up cart modal */}
        {showCart && (
          <div className="fixed inset-0 z-30 flex flex-col">
            <div className="flex-1 bg-black/50" onClick={() => setShowCart(false)} />
            <div className="h-4/5 bg-surface-800 rounded-t-3xl flex flex-col animate-slide-up">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="font-bold text-white text-lg">Current Sale</h2>
                <button onClick={() => setShowCart(false)} className="p-2 rounded-xl hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="flex-1 overflow-hidden"><CartPanel /></div>
            </div>
          </div>
        )}
      </div>

      {/* Qty Modal */}
      {qtyModal && (
        <div className="modal-overlay" onClick={() => setQtyModal(null)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-1">{qtyModal.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{formatCurrency(qtyModal.price, sym)} each</p>
            <div className="text-center text-4xl font-bold text-white mb-6 h-12 flex items-center justify-center bg-surface-700 rounded-xl">
              {qtyInput || '0'}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => numpadPress(String(n))} className="numpad-btn">{n}</button>
              ))}
              <button onClick={() => numpadPress('.')} className="numpad-btn text-base">.</button>
              <button onClick={() => numpadPress('0')} className="numpad-btn">0</button>
              <button onClick={() => numpadPress('back')} className="numpad-btn"><Delete size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { cart.removeItem(qtyModal.id); setQtyModal(null) }} className="btn-danger py-3">Remove</button>
              <button onClick={applyQty} className="btn-primary">Set Qty</button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {discountModal && (
        <div className="modal-overlay" onClick={() => setDiscountModal(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4">Apply Discount</h3>
            <div className="flex gap-2 mb-4">
              {['fixed','percent'].map(t => (
                <button key={t} onClick={() => cart.setDiscount({ ...cart.discount, type: t })}
                  className={`flex-1 py-2 rounded-xl font-medium text-sm transition-all ${cart.discount.type === t ? 'bg-brand-500 text-white' : 'bg-surface-700 text-slate-400'}`}>
                  {t === 'fixed' ? `${sym} Fixed` : '% Percent'}
                </button>
              ))}
            </div>
            <input type="number" className="input-field text-xl text-center font-bold mb-4" placeholder="0"
              value={cart.discount.value || ''} onChange={e => cart.setDiscount({ ...cart.discount, value: Number(e.target.value) })} />
            <div className="flex gap-3">
              <button onClick={() => { cart.setDiscount({ type: 'fixed', value: 0 }); setDiscountModal(false) }} className="btn-secondary flex-1">Remove</button>
              <button onClick={() => setDiscountModal(false)} className="btn-primary flex-1">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-xl mb-1">Select Payment</h3>
            <p className="text-slate-400 mb-6">Total: <span className="text-white font-bold text-lg">{formatCurrency(cart.totals.total, sym)}</span></p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => processPayment('upi')} disabled={processing}
                className="flex flex-col items-center gap-3 p-6 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-2xl transition-all active:scale-95">
                <CreditCard size={32} className="text-purple-400" />
                <span className="text-white font-bold text-lg">UPI</span>
                <span className="text-purple-300 text-xs">Google Pay, PhonePe...</span>
              </button>
              <button onClick={() => processPayment('cash')} disabled={processing}
                className="flex flex-col items-center gap-3 p-6 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-2xl transition-all active:scale-95">
                <Banknote size={32} className="text-green-400" />
                <span className="text-white font-bold text-lg">Cash</span>
                <span className="text-green-300 text-xs">Exact or with change</span>
              </button>
            </div>
            {processing && <p className="text-center text-brand-400 mt-4 animate-pulse">Processing...</p>}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModal && (
        <div className="modal-overlay">
          <div className="modal-content p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-green-400" />
            </div>
            <h3 className="text-white font-bold text-2xl mb-1">Payment Done!</h3>
            <p className="text-slate-400 mb-1">{successModal.txn.transaction_number}</p>
            <p className="text-green-400 font-bold text-xl mb-6">{formatCurrency(successModal.txn.total, sym)}</p>
            <div className="bg-surface-700 rounded-2xl p-4 mb-4">
              <p className="text-slate-400 text-sm mb-2">Share receipt via WhatsApp (optional)</p>
              <div className="flex gap-2">
                <input className="input-field text-sm" placeholder="Customer phone (e.g. 919876543210)"
                  value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                <button onClick={shareWhatsApp} className="btn-primary px-3 shrink-0 bg-green-600 hover:bg-green-700">
                  <Share2 size={18} />
                </button>
              </div>
            </div>
            <button onClick={() => { setSuccessModal(null); setCustomerPhone('') }} className="btn-primary w-full">
              New Sale
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingCartIcon() {
  return <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
}