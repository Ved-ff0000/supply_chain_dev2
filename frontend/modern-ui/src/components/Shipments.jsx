import React from 'react'

const formatETA = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export default function Shipments({ rows = [], loading = false }){
  const data = rows.length
    ? rows.slice(0, 6).map((r) => ({
        id: r.id,
        tracking: r.tracking_number,
        customer: r.customer || r.customer_name || 'Customer',
        carrier: r.carrier || r.carrier_name || 'Carrier',
        route: `${r.origin || 'Origin'} → ${r.destination || 'Destination'}`,
        status: r.status,
        eta: formatETA(r.expected_delivery || r.actual_delivery)
      }))
    : [
        { id: 101, tracking: 'DHL-984210', customer: 'Acme Logistics', carrier: 'DHL', route: 'Shenzhen → Frankfurt', status: 'IN_TRANSIT', eta: 'Aug 17 14:00' },
        { id: 102, tracking: 'FDX-441092', customer: 'Acme Logistics', carrier: 'FedEx', route: 'Chicago → Rotterdam', status: 'CUSTOMS_HOLD', eta: 'Aug 14 09:00' },
        { id: 103, tracking: 'UPS-772901', customer: 'Global Tech', carrier: 'UPS', route: 'Incheon → LA', status: 'DELAYED', eta: 'Aug 13 09:00' }
      ]

  return (
    <section>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="pill-badge">Inspector</div>
            <h2 className="hdr text-lg">Shipment Command Center</h2>
            <span className="ml-2 text-xs text-zinc-400 font-mono">{rows.length || 128}</span>
          </div>
          <div className="text-sm text-zinc-400 flex items-center gap-3"><span className="live-dot cyan blink" />Manage consignments</div>
        </div>
      </div>

      <div className="overflow-auto glass-surface rule rounded-md stagger-1">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor: 'rgba(255,255,255,0.03)'}}>
          <div className="flex items-center gap-3"><div className="pill-badge">Shipments</div><div className="text-xs text-zinc-300">{loading ? 'Syncing live feed' : 'Active feed'}</div></div>
          <div className="text-xs text-zinc-400">Updated: Live</div>
        </div>
        <table className="min-w-full text-sm table-compact">
          <thead>
            <tr className="text-slate-600 text-left">
              <th className="px-3 py-2">Tracking #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Carrier</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">ETA</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.id} className="border-t rule hover:bg-white/2 transition-colors">
                <td className="px-3 py-2 font-mono text-slate-900">{r.tracking}</td>
                <td className="px-3 py-2">{r.customer}</td>
                <td className="px-3 py-2">{r.carrier}</td>
                <td className="px-3 py-2 text-slate-600">{r.route}</td>
                <td className="px-3 py-2"><span className="font-mono text-xs text-zinc-300">{r.status}</span></td>
                <td className="px-3 py-2 font-mono">{r.eta}</td>
                <td className="px-3 py-2 text-right">
                  <button className="text-sm px-2 py-1 border rule rounded-md clickable">ETA</button>
                  <button className="text-sm px-2 py-1 ml-2 border rule rounded-md clickable">Update</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
