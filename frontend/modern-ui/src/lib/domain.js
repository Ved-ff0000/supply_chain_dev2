/**
 * Shared domain helpers: status vocabulary, formatting, and the client-side
 * mirror of the backend transition rules.
 *
 * The authoritative state machine lives in
 * backend/src/constants/statusTransitions.js. This copy exists only to keep
 * the UI from offering a transition the server will reject; the server still
 * validates every change.
 */

export const SHIPMENT_STATUSES = [
  'PENDING_APPROVAL',
  'CREATED',
  'PICKED_UP',
  'ARRIVED_AT_ORIGIN',
  'DEPARTED_ORIGIN',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'CUSTOMS_HOLD',
  'CUSTOMS_CLEARED',
  'OUT_FOR_DELIVERY',
  'DELIVERY_ATTEMPTED',
  'DELIVERED',
  'DELAYED',
  'LOST',
  'DAMAGED',
  'CANCELLED',
  'RETURNED'
]

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

export const STATUS_TRANSITIONS = {
  PENDING_APPROVAL: ['CREATED', 'CANCELLED'],
  CREATED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'ARRIVED_AT_ORIGIN', 'DELAYED', 'CANCELLED'],
  ARRIVED_AT_ORIGIN: ['DEPARTED_ORIGIN', 'IN_TRANSIT', 'DELAYED', 'CANCELLED'],
  DEPARTED_ORIGIN: ['IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DELAYED', 'LOST', 'DAMAGED'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION', 'CUSTOMS_HOLD', 'DELAYED', 'LOST', 'DAMAGED'],
  ARRIVED_AT_DESTINATION: ['CUSTOMS_HOLD', 'CUSTOMS_CLEARED', 'OUT_FOR_DELIVERY', 'DELAYED'],
  CUSTOMS_HOLD: ['CUSTOMS_CLEARED', 'DELAYED', 'RETURNED'],
  CUSTOMS_CLEARED: ['OUT_FOR_DELIVERY', 'IN_TRANSIT'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ATTEMPTED', 'DELAYED'],
  DELIVERY_ATTEMPTED: ['OUT_FOR_DELIVERY', 'RETURNED'],
  DELAYED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'CUSTOMS_HOLD', 'DELIVERED'],
  DAMAGED: ['RETURNED', 'IN_TRANSIT'],
  LOST: ['RETURNED'],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: []
}

export const allowedNextStatuses = (current) =>
  STATUS_TRANSITIONS[String(current || '').toUpperCase()] || []

/**
 * Map a status onto one of the shared pill classes.
 */
export const statusTone = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'DELIVERED':
    case 'CUSTOMS_CLEARED':
      return 'status-success'
    case 'DELAYED':
    case 'LOST':
    case 'DAMAGED':
      return 'status-danger'
    case 'CUSTOMS_HOLD':
    case 'DELIVERY_ATTEMPTED':
      return 'status-warn'
    case 'IN_TRANSIT':
    case 'DEPARTED_ORIGIN':
      return 'status-info'
    case 'OUT_FOR_DELIVERY':
      return 'status-purple'
    case 'PENDING_APPROVAL':
      return 'status-warn'
    case 'CANCELLED':
    case 'RETURNED':
      return 'status-neutral'
    default:
      return 'status-progress'
  }
}

export const priorityTone = (priority) => {
  switch (String(priority || '').toUpperCase()) {
    case 'URGENT':
      return 'status-danger'
    case 'HIGH':
      return 'status-warn'
    case 'LOW':
      return 'status-neutral'
    default:
      return 'status-progress'
  }
}

export const formatStatus = (status) =>
  String(status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())

// ------------------------------------------------------
// Formatting
// ------------------------------------------------------

export const formatDateTime = (value) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export const formatDate = (value) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

export const formatRelative = (value) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return formatDate(value)
}

export const formatNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString('en-US') : '—'
}

export const formatPercent = (value, digits = 1) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${numeric.toFixed(digits)}%` : '—'
}

export const formatHours = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  if (numeric < 48) return `${numeric.toFixed(1)}h`
  return `${(numeric / 24).toFixed(1)}d`
}
