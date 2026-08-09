import { useState, useEffect } from 'react'

// navigator.onLine only reflects whether the device has *a* network connection,
// not whether Supabase is actually reachable — but it's a good, zero-cost first
// signal, and the sync engine will simply fail quietly and retry if a request
// still doesn't go through.
export function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}