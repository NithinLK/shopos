// ─────────────────────────────────────────────────────────────────────────
// Small localStorage-backed helpers used for offline support:
//  - CACHE_KEYS: last-known-good copies of data needed to use the app with
//    no network (item catalog, categories, staff list, store settings)
//  - PENDING_SALES_KEY: a queue of sales made while offline, synced to
//    Supabase once the connection comes back
// ─────────────────────────────────────────────────────────────────────────

const PREFIX = 'shopos_'
export const CACHE_KEYS = {
  items: `${PREFIX}cache_items`,
  categories: `${PREFIX}cache_categories`,
  users: `${PREFIX}cache_users`,
  settings: `${PREFIX}cache_settings`,
}
const PENDING_SALES_KEY = `${PREFIX}pending_sales`

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable — safe to ignore, worst case is a stale cache
  }
}

export const cacheGet = (key, fallback = null) => readJSON(key, fallback)
export const cacheSet = (key, value) => writeJSON(key, value)

// ── Pending sales queue ─────────────────────────────────────────────────
export const getPendingSales = () => readJSON(PENDING_SALES_KEY, [])

export const addPendingSale = (sale) => {
  const queue = getPendingSales()
  queue.push(sale)
  writeJSON(PENDING_SALES_KEY, queue)
  return queue
}

export const removePendingSale = (localId) => {
  const queue = getPendingSales().filter(s => s.localId !== localId)
  writeJSON(PENDING_SALES_KEY, queue)
  return queue
}

export const getPendingSalesCount = () => getPendingSales().length