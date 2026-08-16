import React, { useCallback, useEffect, useState } from 'react'
import AreaChart from './AreaChart'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from './Toast'
import { EmptyState, ErrorState, LoadingCard, LoadingRows } from './States'
import { formatNumber, formatPercent } from '../lib/domain'

/**
 * Analytics dashboard.
 *
 * Every figure comes from a live SQL aggregation endpoint — there are no
 * placeholder numbers. Each KPI card owns its own loading/error state so one
 * slow query never blanks the whole page.
 */

const RANGES = [
  { value: '7d', label: 'Past 7 days' },
  { value: '30d', label: 'Past 30 days' },
  { value: '90d', label: 'Past 90 days' },
  { value: '1y', label: 'Past year' }
]

function KpiCard({ label, caption, value, loading, error, delay = 0 }) {
  if (loading) return <LoadingCard label={label} />

  return (
    <div
      className="p-4 glass-surface rule rounded-md stagger-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-number" style={{ marginTop: 10 }}>
        {error ? '—' : value}
      </div>
      <div className="kpi-caption" style={{ marginTop: 4 }}>
        {error ? 'Unavailable' : caption}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { isStaff } = useAuth()
  const toast = useToast()

  const [range, setRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [active, setActive] = useState(null)
  const [delays, setDelays] = useState(null)
  const [unread, setUnread] = useState(null)
  const [onTime, setOnTime] = useState(null)
  const [trend, setTrend] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    // Settle everything together so one failing card cannot block the others.
    const results = await Promise.allSettled([
      api.get('/dashboard/active-shipments-count'),
      api.get('/dashboard/delays-24h'),
      api.get('/dashboard/unread-notifications-count'),
      api.get('/dashboard/on-time-rate'),
      api.get(`/dashboard/deliveries-over-time?interval=day&range=${range}`)
    ])

    const [activeRes, delaysRes, unreadRes, onTimeRes, trendRes] = results

    setActive(activeRes.status === 'fulfilled' ? activeRes.value.data : null)
    setDelays(delaysRes.status === 'fulfilled' ? delaysRes.value.data : null)
    setUnread(unreadRes.status === 'fulfilled' ? unreadRes.value.data : null)
    setOnTime(onTimeRes.status === 'fulfilled' ? onTimeRes.value.data : null)
    setTrend(trendRes.status === 'fulfilled' ? trendRes.value.data || [] : [])

    if (results.every((result) => result.status === 'rejected')) {
      setError(results[0].reason?.message || 'Could not load analytics data.')
    }

    setLoading(false)
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  const runDelayDetector = async () => {
    setRunning(true)

    try {
      const response = await api.post('/jobs/delay-detection', { dryRun: false })
      const flagged = response.data?.delayed_count ?? 0
      const scanned = response.data?.total_scanned ?? 0

      toast.success(
        flagged > 0
          ? `Delay detector flagged ${flagged} of ${scanned} shipment(s) as delayed.`
          : `Delay detector scanned ${scanned} shipment(s); none are overdue.`
      )

      await load()
    } catch (jobError) {
      toast.error(jobError.message || 'Delay detector failed to run.')
    } finally {
      setRunning(false)
    }
  }

  const exportReport = async () => {
    setExporting(true)

    try {
      await api.download(
        `/dashboard/export?dataset=deliveries&range=${range}`,
        `deliveries-over-time-${range}.csv`
      )
      toast.success('Report exported.')
    } catch (exportError) {
      toast.error(exportError.message || 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const carriers = (onTime?.carriers || []).filter(
    (carrier) => Number(carrier.total_evaluated_shipments) > 0
  )

  const chartSeries = trend.map((point) => Number(point.delivery_count || 0))

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Analytics
          </div>
          <h1 className="h1-page">Logistics Analytics</h1>
          <div className="body-text-secondary" style={{ marginTop: 4 }}>
            Telemetry · Transit risk · Notifications
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            className="input-control"
            style={{ width: 'auto', minWidth: 150 }}
            value={range}
            onChange={(event) => setRange(event.target.value)}
            aria-label="Date range"
          >
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>

          <button
            type="button"
            className="btn"
            onClick={exportReport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export Report'}
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard
              label="Active Shipments"
              caption={
                active
                  ? `${formatNumber(active.urgent_count)} urgent · ${formatNumber(
                      active.high_count
                    )} high priority`
                  : 'Across carriers'
              }
              value={formatNumber(active?.active_count ?? 0)}
              loading={loading}
              error={!loading && !active}
              delay={60}
            />
            <KpiCard
              label="On-Time Rate"
              caption={
                onTime?.summary?.total_evaluated_shipments
                  ? `${formatNumber(
                      onTime.summary.on_time_count
                    )} of ${formatNumber(
                      onTime.summary.total_evaluated_shipments
                    )} delivered on time`
                  : 'No delivered shipments yet'
              }
              value={
                onTime?.summary?.overall_on_time_rate_pct == null
                  ? '—'
                  : formatPercent(onTime.summary.overall_on_time_rate_pct)
              }
              loading={loading}
              error={!loading && !onTime}
              delay={140}
            />
            <KpiCard
              label="Delays (24h)"
              caption={
                delays
                  ? `${formatNumber(delays.high_priority_delays)} high priority · auto-detected`
                  : 'Auto-detected'
              }
              value={formatNumber(delays?.delays_24h ?? 0)}
              loading={loading}
              error={!loading && !delays}
              delay={220}
            />
            <KpiCard
              label="Unread Notifications"
              caption={
                unread
                  ? `${formatNumber(unread.last_24h_count)} in the last 24 hours`
                  : 'In-app'
              }
              value={formatNumber(unread?.unread_count ?? 0)}
              loading={loading}
              error={!loading && !unread}
              delay={300}
            />
          </div>

          <div className="analytics-grid">
            <div className="p-0 glass-surface rule rounded-md stagger-2">
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="pill-badge">Analytics</div>
                  <div className="h2-section">Deliveries Over Time</div>
                </div>
                <div className="eyebrow">
                  {RANGES.find((option) => option.value === range)?.label}
                </div>
              </div>

              <div className="p-4">
                {loading ? (
                  <LoadingRows rows={5} height={18} />
                ) : chartSeries.length === 0 ? (
                  <EmptyState
                    title="No deliveries in this period"
                    description="Once shipments are marked delivered they will chart here."
                    compact
                  />
                ) : (
                  <AreaChart data={chartSeries} />
                )}
              </div>
            </div>

            <div className="p-0 glass-surface rule rounded-md stagger-right">
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="pill-badge">Carrier</div>
                  <div className="h2-section">Carrier On-Time Rate</div>
                </div>
              </div>

              <div className="p-4">
                {loading ? (
                  <LoadingRows rows={3} />
                ) : carriers.length === 0 ? (
                  <EmptyState
                    title="No carrier data yet"
                    description="Rates appear once shipments have been delivered against an expected date."
                    compact
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {carriers.map((carrier) => (
                      <div key={carrier.carrier_id}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 5
                          }}
                        >
                          <span className="body-text">{carrier.carrier_name}</span>
                          <span
                            className="cell-mono"
                            style={{ fontWeight: 600 }}
                          >
                            {formatPercent(carrier.on_time_rate_pct)}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.05)',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(Number(carrier.on_time_rate_pct) || 0, 100)}%`,
                              height: '100%',
                              borderRadius: 2,
                              background:
                                'linear-gradient(90deg, var(--accent), var(--accent-cyan))'
                            }}
                          />
                        </div>
                        <div className="kpi-caption" style={{ marginTop: 4 }}>
                          {formatNumber(carrier.on_time_count)} on time ·{' '}
                          {formatNumber(carrier.late_count)} late
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isStaff && (
            <div
              className="p-4 glass-surface rule rounded-md"
              style={{ marginTop: 24 }}
            >
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Quick Actions
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={runDelayDetector}
                  disabled={running}
                >
                  {running ? 'Running detector…' : 'Run Delay Detector'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={exportReport}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting…' : 'Export Report'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
