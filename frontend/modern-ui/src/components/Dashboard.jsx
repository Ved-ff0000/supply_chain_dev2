import React from 'react'
import AreaChart from './AreaChart'

const Metric = ({label, value, hint, delay=0}) => (
  <div className="p-4 glass-surface rule rounded-md stagger-1" style={{animationDelay: `${delay}ms`}}>
    <div className="text-xs text-zinc-400">{label}</div>
    <div className="mt-2 text-2xl font-semibold text-white font-mono">{value}</div>
    {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
  </div>
)

export default function Dashboard({ summary, onTime, trendData, loading }){
  const shipmentSummary = summary?.shipments || {}
  const notificationSummary = summary?.notifications || {}
  const onTimeSummary = onTime?.summary || {}

  const metrics = [
    { label: 'Active Shipments', value: Number(shipmentSummary.total_shipments ?? 128), hint: 'Across carriers', delay: 60 },
    { label: 'On-Time Rate', value: `${Number(onTimeSummary.overall_on_time_rate_pct ?? 91.3).toFixed(1)}%`, hint: 'Fleet overall', delay: 140 },
    { label: 'Delays (24h)', value: Number(shipmentSummary.delayed ?? 6), hint: 'Auto-detected', delay: 220 },
    { label: 'Unread Notifications', value: Number(notificationSummary.unread_notifications ?? 3), hint: 'In-app', delay: 300 }
  ]

  const carrierRows = (onTime?.carriers || [])
    .slice(0, 3)
    .map((item) => ({
      label: item.carrier_name || item.carrier_code || 'Carrier',
      value: `${Number(item.on_time_rate_pct ?? 0).toFixed(1)}%`
    }))

  const chartSeries = (trendData || [])
    .map((point) => Number(point.delivery_count || 0))
    .slice(-6)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="hdr text-lg word-anim" aria-label="Logistics Analytics">{ /* letter-by-letter */ }
            {'Logistics Analytics'.split(' ').map((w,wi)=> (
              <span key={wi} style={{marginRight:8}}>
                {w.split('').map((c, i)=> <span key={i} style={{animationDelay: `${i*25 + wi*80}ms`, color: 'white'}}>{c}</span>)}
              </span>
            ))}
          </h2>
          <div className="text-xs text-zinc-400 mt-1">Telemetry · Transit risk · Notifications</div>
        </div>
        <div className="text-sm text-zinc-400">Last 30 days</div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {loading ? (
          <div className="col-span-4 text-sm text-zinc-400">Syncing live telemetry…</div>
        ) : metrics.map((m,i) => <Metric key={m.label} {...m} delay={m.delay} />)}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="p-0 glass-surface rule rounded-md stagger-2">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor: 'rgba(255,255,255,0.03)'}}>
            <div className="flex items-center gap-3">
              <div className="pill-badge">Analytics</div>
              <div className="text-sm text-zinc-100 font-medium">Deliveries Over Time</div>
            </div>
            <div className="text-xs text-zinc-400">Stream: Telemetry · Risk · Notifications</div>
          </div>
          <div className="p-4">
            <AreaChart data={chartSeries.length ? chartSeries : undefined} />
          </div>
        </div>

        <div className="p-0 glass-surface rule rounded-md stagger-right">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor: 'rgba(255,255,255,0.03)'}}>
            <div className="flex items-center gap-3">
              <div className="pill-badge">Carrier</div>
              <div className="text-sm text-zinc-100 font-medium">Carrier On-Time Rate</div>
            </div>
            <div className="text-xs text-zinc-400">Delivered vs expected window</div>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {(carrierRows.length ? carrierRows : [
                { label: 'DHL', value: '93.9%' },
                { label: 'FedEx', value: '90.6%' },
                { label: 'UPS', value: '87.8%' }
              ]).map((carrier) => (
                <div key={carrier.label} className="flex justify-between text-sm">
                  <div>{carrier.label}</div>
                  <div className="font-semibold">{carrier.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
