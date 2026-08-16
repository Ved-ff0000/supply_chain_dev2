import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from './Toast'
import { EmptyState, ErrorState, LoadingRows } from './States'
import {
  allowedNextStatuses,
  formatDateTime,
  formatHours,
  formatStatus,
  priorityTone,
  statusTone
} from '../lib/domain'

/**
 * Shipment detail modal: timeline, predicted ETA, notifications and the
 * status-change control. Status options are limited to transitions the
 * backend state machine will accept.
 */

export default function ShipmentDetail({ shipmentId, onClose, onChanged }) {
  const { isStaff } = useAuth()
  const toast = useToast()

  const [shipment, setShipment] = useState(null)
  const [events, setEvents] = useState([])
  const [eta, setEta] = useState(null)
  const [notifications, setNotifications] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nextStatus, setNextStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const shipmentResponse = await api.get(`/shipments/${shipmentId}`)
      const record = shipmentResponse.data
      setShipment(record)

      const [eventsRes, etaRes, notificationsRes] = await Promise.allSettled([
        api.get(`/events/shipment/${shipmentId}`),
        api.get(`/shipments/${shipmentId}/eta`),
        api.get(`/notifications/shipment/${shipmentId}`)
      ])

      setEvents(eventsRes.status === 'fulfilled' ? eventsRes.value.data || [] : [])
      setEta(etaRes.status === 'fulfilled' ? etaRes.value.data : null)
      setNotifications(
        notificationsRes.status === 'fulfilled'
          ? notificationsRes.value.data || []
          : []
      )
    } catch (loadError) {
      setError(loadError.message || 'Could not load this shipment.')
    } finally {
      setLoading(false)
    }
  }, [shipmentId])

  useEffect(() => {
    load()
  }, [load])

  // Close on Escape.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const changeStatus = async () => {
    if (!nextStatus) return

    setSaving(true)

    try {
      await api.patch(`/shipments/${shipmentId}/status`, { status: nextStatus })
      toast.success(`Status updated to ${formatStatus(nextStatus)}.`)
      setNextStatus('')
      await load()
      onChanged?.()
    } catch (statusError) {
      toast.error(statusError.message || 'Could not update the status.')
    } finally {
      setSaving(false)
    }
  }

  const transitions = shipment ? allowedNextStatuses(shipment.status) : []

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-panel scroll-area"
        style={{ maxWidth: 680 }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '20px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 5 }}>
              Shipment
            </div>
            <h2 className="h1-page" style={{ fontSize: 19 }}>
              {loading ? 'Loading…' : shipment?.tracking_number || 'Shipment'}
            </h2>
            {shipment && (
              <div className="body-text-secondary" style={{ marginTop: 4 }}>
                {shipment.origin} → {shipment.destination}
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          {loading ? (
            <LoadingRows rows={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 14,
                  marginBottom: 22
                }}
              >
                <div>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>Status</div>
                  <span className={`status-pill ${statusTone(shipment.status)}`}>
                    {formatStatus(shipment.status)}
                  </span>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>Priority</div>
                  <span className={`status-pill ${priorityTone(shipment.priority)}`}>
                    {formatStatus(shipment.priority)}
                  </span>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>Carrier</div>
                  <div className="body-text">{shipment.carrier}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>Customer</div>
                  <div className="body-text">{shipment.customer}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>Expected</div>
                  <div className="body-text">{formatDateTime(shipment.expected_delivery)}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 5 }}>Delivered</div>
                  <div className="body-text">{formatDateTime(shipment.actual_delivery)}</div>
                </div>
              </div>

              {/* Predicted ETA ------------------------------------------ */}
              <div
                className="rule"
                style={{
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 22
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  Predicted ETA
                </div>

                {!eta ? (
                  <div className="body-text-secondary">
                    Not enough history on this carrier and route to predict an ETA.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12
                    }}
                  >
                    <div>
                      <div className="kpi-caption">Estimated arrival</div>
                      <div className="body-text" style={{ fontWeight: 600 }}>
                        {formatDateTime(
                          eta.predicted_eta || eta.estimated_delivery || eta.eta
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="kpi-caption">Avg transit</div>
                      <div className="body-text" style={{ fontWeight: 600 }}>
                        {formatHours(
                          eta.avg_transit_hours ?? eta.average_transit_hours
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="kpi-caption">Confidence</div>
                      <div className="body-text" style={{ fontWeight: 600 }}>
                        {eta.confidence || eta.sample_size
                          ? eta.confidence || `${eta.sample_size} shipments`
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status control ----------------------------------------- */}
              {isStaff && transitions.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    Update status
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      className="input-control"
                      style={{ width: 'auto', minWidth: 200 }}
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value)}
                      aria-label="Next status"
                    >
                      <option value="">Select next status…</option>
                      {transitions.map((status) => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={changeStatus}
                      disabled={!nextStatus || saving}
                    >
                      {saving ? 'Updating…' : 'Apply'}
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline ------------------------------------------------ */}
              <div style={{ marginBottom: 22 }}>
                <div className="h2-section" style={{ marginBottom: 12 }}>
                  Timeline
                </div>

                {events.length === 0 ? (
                  <EmptyState
                    title="No events recorded"
                    description="Events appear as the shipment moves through its lifecycle."
                    compact
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {events.map((event, index) => (
                      <div
                        key={event.id}
                        style={{ display: 'flex', gap: 12, paddingBottom: 14 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flexShrink: 0
                          }}
                        >
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background:
                                index === 0 ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.22)',
                              marginTop: 4
                            }}
                          />
                          {index < events.length - 1 && (
                            <span
                              style={{
                                width: 1,
                                flex: 1,
                                minHeight: 22,
                                background: 'rgba(255,255,255,0.10)',
                                marginTop: 4
                              }}
                            />
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 10,
                              flexWrap: 'wrap'
                            }}
                          >
                            <span className={`status-pill ${statusTone(event.status)}`}>
                              {formatStatus(event.status)}
                            </span>
                            <span className="kpi-caption">
                              {formatDateTime(event.event_time)}
                            </span>
                          </div>
                          {event.description && (
                            <div className="body-text-secondary" style={{ marginTop: 5 }}>
                              {event.description}
                            </div>
                          )}
                          {event.location && (
                            <div className="kpi-caption" style={{ marginTop: 3 }}>
                              {event.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notifications ------------------------------------------ */}
              <div>
                <div className="h2-section" style={{ marginBottom: 12 }}>
                  Notifications
                </div>

                {notifications.length === 0 ? (
                  <EmptyState
                    title="No notifications"
                    description="Notifications generated for this shipment will be listed here."
                    compact
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        style={{
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 8,
                          padding: 12
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap'
                          }}
                        >
                          <span className="body-text" style={{ fontWeight: 600 }}>
                            {notification.title}
                          </span>
                          <span className="kpi-caption">
                            {formatDateTime(notification.created_at)}
                          </span>
                        </div>
                        <div className="body-text-secondary" style={{ marginTop: 4 }}>
                          {notification.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
