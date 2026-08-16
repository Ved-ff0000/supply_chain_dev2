import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import Dashboard from './components/Dashboard'
import Shipments from './components/Shipments'
import BackgroundSurface from './components/BackgroundSurface'

const NAV = [
  { key: 'dashboard', label: 'Analytics' },
  { key: 'shipments', label: 'Shipments' }
]

const containerVariant = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } }
}

const panelVariant = {
  hidden: { y: 18, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.16,1,0.3,1] } }
}

const DEMO_LOGIN = {
  email: 'admin@supplychain.local',
  password: 'Admin123!'
}

const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
})

async function readJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed')
  }
  return payload
}

export default function App(){
  const [view, setView] = useState('dashboard')
  const [token, setToken] = useState(() => localStorage.getItem('supplychain_token') || '')
  const [dashboardSummary, setDashboardSummary] = useState(null)
  const [onTimeRate, setOnTimeRate] = useState(null)
  const [trendData, setTrendData] = useState(null)
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(false)
  const navRef = useRef(null)
  const activeIndex = NAV.findIndex(n => n.key === view)

  useEffect(() => {
    document.title = 'SupplyChain Notification Hub — Premium'
  }, [])

  useEffect(() => {
    let alive = true

    const bootstrap = async () => {
      try {
        setLoading(true)
        let authToken = token

        if (!authToken) {
          const authResponse = await readJson('/api/auth/login', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(DEMO_LOGIN)
          })
          authToken = authResponse.token
          localStorage.setItem('supplychain_token', authToken)
          setToken(authToken)
        }

        if (!alive) return

        const [summary, onTime, trend, shipmentData] = await Promise.all([
          readJson('/api/dashboard/summary', { headers: getAuthHeaders(authToken) }),
          readJson('/api/dashboard/on-time-rate', { headers: getAuthHeaders(authToken) }),
          readJson('/api/dashboard/deliveries-over-time?interval=day&range=30d', { headers: getAuthHeaders(authToken) }),
          readJson('/api/shipments?limit=25', { headers: getAuthHeaders(authToken) })
        ])

        if (!alive) return

        setDashboardSummary(summary.data || {})
        setOnTimeRate(onTime.data || {})
        setTrendData(trend.data || [])
        setShipments(shipmentData.data || [])
      } catch (error) {
        console.error('Failed to load live dashboard data:', error)
      } finally {
        if (alive) setLoading(false)
      }
    }

    bootstrap()
    return () => { alive = false }
  }, [token])

  const runDelayDetector = async () => {
    try {
      const authToken = token || localStorage.getItem('supplychain_token')
      const resp = await fetch('/api/jobs/delay-detection', {
        method: 'POST',
        headers: getAuthHeaders(authToken),
        body: JSON.stringify({ dryRun: false })
      })

      const payload = await resp.json()
      if (resp.ok) {
        console.log('Delay detector run:', payload)
        alert(`Delay detector executed: ${payload.data?.delayed_count || 0} flagged.`)
      } else {
        console.error('Delay detector failed:', payload)
        alert(`Delay detector failed: ${payload.message || 'see console'}`)
      }
    } catch (err) {
      console.error('Network error running delay detector', err)
      alert('Network error running delay detector; see console.')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] body-font text-zinc-100">
      <BackgroundSurface />
      <motion.div initial="hidden" animate="show" variants={containerVariant} className="content-layer max-w-[1200px] mx-auto px-6 py-8">
        <header className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="hdr text-2xl font-semibold">SupplyChain Notification Hub</div>
            <div className="text-sm text-zinc-400 mt-1">Telemetry · Transit risk · Notifications</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-zinc-300">Ops • Elena Rostova</div>
            <div className="px-3 py-2 border rule rounded-md text-sm text-zinc-300">ENV: Demo</div>
          </div>
        </header>

        <div className="grid grid-cols-[220px_1fr] gap-6">
          <nav className="pt-2 relative" ref={navRef}>
            <div style={{position: 'absolute', top: `${18 + activeIndex * 44}px`}} className="nav-marker" aria-hidden />
            <ul className="space-y-2">
              {NAV.map(item => (
                <li key={item.key}>
                  <motion.button
                    onClick={() => setView(item.key)}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`w-full text-left px-3 py-2 text-sm underline-grow ${view===item.key? 'text-zinc-100 font-semibold nav-active':'text-zinc-400'} clickable`}
                  >
                    {item.label}
                  </motion.button>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-4 border-t rule">
              <div className="text-xs text-slate-500 mb-2">Quick Actions</div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={runDelayDetector} className="w-full text-left px-3 py-2 text-sm border rule rounded-md clickable btn-pulse conic-glow">Run Delay Detector</motion.button>
            </div>
          </nav>

          <main>
            <motion.div variants={panelVariant} className="">
              {view === 'dashboard' && (
                <Dashboard
                  summary={dashboardSummary}
                  onTime={onTimeRate}
                  trendData={trendData}
                  loading={loading}
                />
              )}
              {view === 'shipments' && <Shipments rows={shipments} loading={loading} />}
            </motion.div>
          </main>
        </div>
      </motion.div>
    </div>
  )
}
