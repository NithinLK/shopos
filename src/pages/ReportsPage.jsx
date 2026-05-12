import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useApp } from '../hooks/useApp'
import { TrendingUp, DollarSign, ShoppingBag, BarChart2, Download } from 'lucide-react'
import { formatCurrency, getDateRange } from '../utils/helpers'

export default function ReportsPage() {
  const { settings } = useApp()
  const sym = settings.currency_symbol || '₹'
  const [preset, setPreset] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [stats, setStats] = useState({ grossSales: 0, totalCost: 0, netProfit: 0, txnCount: 0, discounts: 0 })
  const [itemSales, setItemSales] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    let start, end
    if (preset === 'custom' && customStart && customEnd) {
      start = new Date(customStart); end = new Date(customEnd); end.setHours(23,59,59,999)
    } else {
      const r = getDateRange(preset); start = r.start; end = r.end
    }

    const { data: txns } = await supabase.from('transactions')
      .select('*, transaction_items(*)')
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (!txns) { setLoading(false); return }

    let grossSales = 0, totalCost = 0, discounts = 0
    const itemMap = {}

    txns.forEach(t => {
      grossSales += Number(t.total)
      discounts += Number(t.discount_amount || 0)
      ;(t.transaction_items || []).forEach(ti => {
        totalCost += Number(ti.item_cost || 0) * Number(ti.quantity)
        const key = ti.item_name
        if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 }
        itemMap[key].qty += Number(ti.quantity)
        itemMap[key].revenue += Number(ti.line_total)
      })
    })

    setStats({ grossSales, totalCost, netProfit: grossSales - totalCost, txnCount: txns.length, discounts })
    setItemSales(Object.values(itemMap).sort((a,b) => b.revenue - a.revenue))
    setLoading(false)
  }

  useEffect(() => { load() }, [preset])

  const exportCSV = () => {
    const rows = [['Item','Qty Sold','Revenue']]
    itemSales.forEach(i => rows.push([i.name, i.qty, i.revenue.toFixed(2)]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `report-${preset}.csv`; a.click()
  }

  const statCards = [
    { label: 'Gross Sales', value: formatCurrency(stats.grossSales, sym), icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Transactions', value: stats.txnCount, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Cost of Goods', value: formatCurrency(stats.totalCost, sym), icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Net Profit', value: formatCurrency(stats.netProfit, sym), icon: TrendingUp, color: stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400', bg: stats.netProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10' },
  ]

  return (
    <div className="h-full overflow-y-auto no-bounce bg-surface-900 p-4 space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap gap-2">
        {['today','yesterday','week','month'].map(p => (
          <button key={p} onClick={() => setPreset(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${preset === p ? 'bg-brand-500 text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}>
            {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
        <button onClick={() => setPreset('custom')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${preset === 'custom' ? 'bg-brand-500 text-white' : 'bg-surface-700 text-slate-400 hover:text-white'}`}>
          Custom
        </button>
      </div>

      {preset === 'custom' && (
        <div className="flex gap-3 items-center">
          <input type="date" className="input-field text-sm" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          <span className="text-slate-400">to</span>
          <input type="date" className="input-field text-sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          <button onClick={load} className="btn-primary shrink-0 text-sm">Go</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-slate-400 text-xs">{s.label}</p>
            <p className={`font-bold text-lg ${s.color}`}>{loading ? '...' : s.value}</p>
          </div>
        ))}
      </div>

      {stats.discounts > 0 && (
        <div className="card p-3 flex items-center gap-3 border border-green-500/20 bg-green-500/5">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-green-400 font-semibold text-sm">Total Discounts Given</p>
            <p className="text-green-300 font-bold">{formatCurrency(stats.discounts, sym)}</p>
          </div>
        </div>
      )}

      {/* Item sales table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-white font-semibold">Item Sales Breakdown</h3>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : itemSales.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No sales in this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Item</th><th className="text-right">Qty Sold</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {itemSales.map((item, i) => (
                  <tr key={i}>
                    <td className="text-white">{item.name}</td>
                    <td className="text-right text-slate-300">{item.qty}</td>
                    <td className="text-right text-brand-400 font-semibold">{formatCurrency(item.revenue, sym)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}