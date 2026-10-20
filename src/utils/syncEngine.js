import { supabase } from './supabase'
import { getPendingSales, removePendingSale } from './offlineStore'

// Same "read current stock, then write" approach used for receipt edits/voids —
// avoids relying on any SQL-side arithmetic, and deliberately allows the result
// to go negative (an offline oversell should show up the same way an online one does).
const adjustStock = async (itemId, delta) => {
  if (!itemId || !delta) return
  // Atomic in-database update (see supabase_adjust_stock.sql); `delta` is units sold.
  const { error } = await supabase.rpc('adjust_stock', { p_item_id: itemId, p_delta: -delta })
  if (error) console.error('Stock update failed during sync for item', itemId, error)
}

// Pushes every locally-queued sale to Supabase, in the order they were made.
// Stops at the first one that fails (e.g. connection dropped mid-sync) and
// leaves it — and everything after it — in the queue for the next attempt,
// so nothing is skipped or double-counted.
export async function syncPendingSales() {
  const queue = getPendingSales()
  let syncedCount = 0

  for (const sale of queue) {
    try {
      const { data: txn, error: txnErr } = await supabase.from('transactions').insert({
        transaction_number: sale.transaction_number,
        status: 'completed',
        payment_method: sale.payment_method,
        subtotal: sale.subtotal,
        discount_amount: sale.discount_amount,
        discount_type: sale.discount_type,
        discount_value: sale.discount_value,
        total: sale.total,
        cashier_id: sale.cashier_id,
        created_at: sale.created_offline_at, // preserve the actual time of sale, not sync time
      }).select().single()
      if (txnErr) throw txnErr

      const { error: itemsErr } = await supabase.from('transaction_items').insert(
        sale.items.map(i => ({
          transaction_id: txn.id,
          item_id: i.item_id,
          item_name: i.item_name,
          item_price: i.item_price,
          item_cost: i.item_cost,
          quantity: i.quantity,
          line_total: i.line_total,
        }))
      )
      if (itemsErr) throw itemsErr

      for (const item of sale.items) {
        if (item.track_stock) await adjustStock(item.item_id, item.quantity)
      }

      removePendingSale(sale.localId)
      syncedCount++
    } catch (e) {
      // Still offline, or the request genuinely failed — stop here and try again later.
      return { syncedCount, remaining: getPendingSales().length, error: e.message || 'Sync failed' }
    }
  }

  return { syncedCount, remaining: 0, error: null }
}