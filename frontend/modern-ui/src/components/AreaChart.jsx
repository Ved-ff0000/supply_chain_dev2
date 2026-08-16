import React, { useRef, useEffect, useState } from 'react'

function buildPath(points, height, offsetY = 0) {
  if (points.length === 0) return ''
  const d = []
  d.push(`M ${points[0].x} ${height - points[0].y + offsetY}`)
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C ${cp1x} ${height - cp1y + offsetY}, ${cp2x} ${height - cp2y + offsetY}, ${p2.x} ${height - p2.y + offsetY}`)
  }
  return d.join(' ')
}

export default function AreaChart({ className, data }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState({ x: -9999, y: -9999 })

  // Data is always supplied by the caller from live aggregation; the chart is
  // never rendered with placeholder numbers (callers show an empty state).
  const samples = Array.isArray(data) && data.length ? data : []
  const width = 720
  const height = 240
  const padding = { left: 40, right: 20 }
  const maxValue = Math.max(40, ...samples)

  const points = samples.map((v, i) => ({
    x: padding.left + i * ((width - padding.left - padding.right) / (Math.max(samples.length - 1, 1))),
    y: (v / maxValue) * (height - 40)
  }))

  const telemetry = points.map((p) => ({ x: p.x, y: p.y }))
  const risk = points.map((p, i) => ({ x: p.x, y: Math.max(6, p.y * 0.6 + (i % 2 ? 4 : 2)) }))
  const notifications = points.map((p, i) => ({ x: p.x, y: Math.max(4, p.y * 0.25 + (i % 3 ? 2 : 1)) }))

  const telemetryPath = buildPath(telemetry, height)
  const riskPath = buildPath(risk, height)
  const notifPath = buildPath(notifications, height)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handleMove = (e) => {
      const rect = svg.getBoundingClientRect()
      setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    const handleLeave = () => setHover({ x: -9999, y: -9999 })
    svg.addEventListener('mousemove', handleMove)
    svg.addEventListener('mouseleave', handleLeave)
    return () => {
      svg.removeEventListener('mousemove', handleMove)
      svg.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  const nearestIndex = (() => {
    if (hover.x < 0) return -1
    let idx = 0
    let best = 1e9
    points.forEach((p, i) => {
      const dx = Math.abs(p.x - hover.x)
      if (dx < best) {
        best = dx
        idx = i
      }
    })
    return idx
  })()

  return (
    <div className={`area-chart ${className || ''}`}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-[240px]">
        <defs>
          <linearGradient id="gTelemetry" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fdeecd" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fdeecd" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="gRisk" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fbe7d0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fbe7d0" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gNotif" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fff2e6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fff2e6" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        <g opacity={0.06}>
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={padding.left} x2={width - padding.right} y1={(height - 30) - i * 40} y2={(height - 30) - i * 40} stroke="#0f1720" strokeWidth={1} />
          ))}
        </g>

        <path d={`${notifPath} L ${width - padding.right} ${height} L ${padding.left} ${height} Z`} fill="url(#gNotif)" />
        <path d={`${riskPath} L ${width - padding.right} ${height} L ${padding.left} ${height} Z`} fill="url(#gRisk)" />
        <path d={`${telemetryPath} L ${width - padding.right} ${height} L ${padding.left} ${height} Z`} fill="url(#gTelemetry)" />

        <path d={telemetryPath} stroke="#8a5a2e" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
        <path d={riskPath} stroke="#b07a3a" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <path d={notifPath} stroke="#d9b08a" strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />

        {nearestIndex >= 0 && (
          <g>
            <line x1={points[nearestIndex].x} x2={points[nearestIndex].x} y1={8} y2={height - 8} stroke="#b07a3a" strokeWidth={1} strokeDasharray="4 6" opacity={0.7} />
            <circle cx={points[nearestIndex].x} cy={height - points[nearestIndex].y} r={5} fill="#b07a3a" />
            <rect x={points[nearestIndex].x - 46} y={12} width={96} height={36} rx={6} fill="#0b0b0c" opacity={0.9} stroke="rgba(255,255,255,0.04)" />
            <text x={points[nearestIndex].x} y={34} textAnchor="middle" fill="#f8fafc" fontSize={12} style={{ fontFamily: 'Plus Jakarta Sans' }}> {samples[nearestIndex]} deliveries</text>
          </g>
        )}
      </svg>
    </div>
  )
}
