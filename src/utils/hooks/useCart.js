import { useState, useCallback, useMemo } from 'react'

export function useCart() {
  const [items, setItems] = useState([])
  const [discount, setDiscount] = useState({ type: 'fixed', value: 0 })
  const [note, setNote] = useState('')

  const addItem = useCallback((item) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...item, quantity: 1, line_discount: 0 }]
    })
  }, [])

  const setQuantity = useCallback((itemId, qty) => {
    const q = Number(qty)
    if (q <= 0) setItems(prev => prev.filter(i => i.id !== itemId))
    else setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: q } : i))
  }, [])

  const removeItem = useCallback((itemId) => setItems(prev => prev.filter(i => i.id !== itemId)), [])

  const clearCart = useCallback(() => {
    setItems([]); setDiscount({ type: 'fixed', value: 0 }); setNote('')
  }, [])

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity - (i.line_discount || 0)), 0)
    const discountAmount = discount.type === 'percent'
      ? subtotal * (discount.value / 100)
      : Math.min(discount.value, subtotal)
    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    }
  }, [items, discount])

  return { items, discount, setDiscount, note, setNote, addItem, setQuantity, removeItem, clearCart, totals }
}