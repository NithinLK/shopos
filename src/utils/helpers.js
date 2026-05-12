export const formatCurrency = (amount, symbol = '₹') => {
  if (amount === null || amount === undefined) return `${symbol}0.00`
  return `${symbol}${Number(amount).toFixed(2)}`
}

export const formatDate = (date, format = 'short') => {
  if (!date) return ''
  const d = new Date(date)
  if (format === 'short') return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  if (format === 'time') return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (format === 'full') return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

export const generateTxnNumber = () => {
  const now = new Date()
  const date = now.toISOString().slice(0,10).replace(/-/g,'')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `TXN-${date}-${rand}`
}

export const formatWhatsAppReceipt = (transaction, items, storeName, discountAmount = 0) => {
  const lines = items.map(i => `• ${i.item_name} x${i.quantity} — ₹${Number(i.line_total).toFixed(2)}`).join('\n')
  let msg = `🏪 *${storeName}*\n📋 Receipt #${transaction.transaction_number}\n📅 ${formatDate(transaction.created_at, 'full')}\n─────────────────\n${lines}\n─────────────────\n`
  if (discountAmount > 0) {
    msg += `\n🎉🎉🎉 *YOU SAVED ₹${Number(discountAmount).toFixed(2)} TODAY!* 🎉🎉🎉\n💸 *SPECIAL DISCOUNT APPLIED!* 💸\n\n`
  }
  msg += `Subtotal: ₹${Number(transaction.subtotal).toFixed(2)}\n`
  if (discountAmount > 0) msg += `Discount: -₹${Number(discountAmount).toFixed(2)}\n`
  msg += `*Total: ₹${Number(transaction.total).toFixed(2)}*\nPayment: ${transaction.payment_method.toUpperCase()}\n─────────────────\nThank you for shopping! 🙏`
  return encodeURIComponent(msg)
}

export const PERMISSIONS = {
  admin: ['sales','items','receipts','reports','staff','settings','edit_invoice','edit_items'],
  manager: ['sales','items','receipts','reports','edit_invoice'],
  cashier: ['sales','items_view'],
}
export const canAccess = (role, permission) => (PERMISSIONS[role] || []).includes(permission)

export const getDateRange = (preset) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch(preset) {
    case 'today': return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate()-1); return { start: y, end: new Date(y.getTime()+86400000-1) } }
    case 'week': { const w = new Date(today); w.setDate(w.getDate()-7); return { start: w, end: new Date(today.getTime()+86400000-1) } }
    case 'month': { const m = new Date(today); m.setDate(1); return { start: m, end: new Date(today.getTime()+86400000-1) } }
    default: return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
  }
}

export const nameToColor = (name) => {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444']
  let hash = 0
  for (let c of (name||'U')) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export const getStockStatus = (item) => {
  if (!item.track_stock) return null
  if (item.stock_quantity <= 0) return 'out'
  if (item.stock_quantity <= (item.low_stock_alert || 5)) return 'low'
  return 'ok'
}