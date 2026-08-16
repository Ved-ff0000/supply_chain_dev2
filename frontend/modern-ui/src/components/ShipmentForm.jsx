import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from './Toast'
import { PRIORITIES, formatStatus } from '../lib/domain'

/**
 * Create / edit / request shipment form.
 *
 * Three modes share one component because the fields are the same shape:
 *   create  — OPERATIONS/ADMIN, posts to /shipments
 *   edit    — OPERATIONS/ADMIN, patches /shipments/:id
 *   request — CUSTOMER, posts to /shipments/request (PENDING_APPROVAL)
 */

const toDateTimeLocal = (value) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function ShipmentForm({ mode, shipment, carriers, onClose, onSaved }) {
  const toast = useToast()

  const isEdit = mode === 'edit'
  const isRequest = mode === 'request'

  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState(() => ({
    tracking_number: shipment?.tracking_number || '',
    carrier_id: shipment?.carrier_id || '',
    customer_id: shipment?.customer_id || '',
    origin: shipment?.origin || '',
    destination: shipment?.destination || '',
    priority: shipment?.priority || 'NORMAL',
    expected_delivery: toDateTimeLocal(shipment?.expected_delivery),
    notes: ''
  }))

  // Staff creating a shipment must choose a customer.
  useEffect(() => {
    if (isRequest) return

    api
      .get('/shipments')
      .then((response) => {
        const unique = new Map()

        ;(response.data || []).forEach((row) => {
          if (row.customer_id && !unique.has(row.customer_id)) {
            unique.set(row.customer_id, { id: row.customer_id, name: row.customer })
          }
        })

        setCustomers(Array.from(unique.values()))
      })
      .catch(() => setCustomers([]))
  }, [isRequest])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        priority: form.priority,
        expected_delivery: form.expected_delivery
          ? new Date(form.expected_delivery).toISOString()
          : null
      }

      if (isRequest) {
        await api.post('/shipments/request', {
          ...payload,
          carrier_id: Number(form.carrier_id),
          notes: form.notes.trim() || undefined
        })

        toast.success('Request submitted for approval.')
      } else if (isEdit) {
        await api.patch(`/shipments/${shipment.id}`, payload)
        toast.success(`${shipment.tracking_number} updated.`)
      } else {
        await api.post('/shipments', {
          ...payload,
          tracking_number: form.tracking_number.trim(),
          carrier_id: Number(form.carrier_id),
          customer_id: Number(form.customer_id)
        })

        toast.success('Shipment created.')
      }

      onSaved()
    } catch (submitError) {
      setError(submitError.message || 'Could not save the shipment.')
    } finally {
      setSaving(false)
    }
  }

  const title = isRequest
    ? 'Request a shipment'
    : isEdit
      ? 'Edit shipment'
      : 'New shipment'

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-panel scroll-area"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 5 }}>
            {isRequest ? 'Customer request' : 'Shipment'}
          </div>
          <h2 className="h1-page" style={{ fontSize: 19 }}>
            {title}
          </h2>
          {isRequest && (
            <div className="body-text-secondary" style={{ marginTop: 4 }}>
              Your request is reviewed by operations before it enters the network.
            </div>
          )}
        </div>

        <form onSubmit={submit} style={{ padding: '20px 22px' }} noValidate>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.28)',
                background: 'rgba(239,68,68,0.08)'
              }}
            >
              <span className="body-text" style={{ color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          {!isEdit && !isRequest && (
            <div style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="form-tracking">
                Tracking number
              </label>
              <input
                id="form-tracking"
                className="input-control"
                required
                value={form.tracking_number}
                onChange={update('tracking_number')}
                placeholder="DHL-984210"
              />
            </div>
          )}

          {isEdit && (
            <div style={{ marginBottom: 14 }}>
              <div className="field-label">Tracking number</div>
              <div className="cell-mono">{shipment.tracking_number}</div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 14
            }}
          >
            {!isEdit && (
              <div>
                <label className="field-label" htmlFor="form-carrier">Carrier</label>
                <select
                  id="form-carrier"
                  className="input-control"
                  required
                  value={form.carrier_id}
                  onChange={update('carrier_id')}
                >
                  <option value="">Select carrier…</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isEdit && !isRequest && (
              <div>
                <label className="field-label" htmlFor="form-customer">Customer</label>
                <select
                  id="form-customer"
                  className="input-control"
                  required
                  value={form.customer_id}
                  onChange={update('customer_id')}
                >
                  <option value="">Select customer…</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="form-origin">Origin</label>
              <input
                id="form-origin"
                className="input-control"
                required
                value={form.origin}
                onChange={update('origin')}
                placeholder="Shenzhen, CN"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="form-destination">Destination</label>
              <input
                id="form-destination"
                className="input-control"
                required
                value={form.destination}
                onChange={update('destination')}
                placeholder="Frankfurt, DE"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="form-priority">Priority</label>
              <select
                id="form-priority"
                className="input-control"
                value={form.priority}
                onChange={update('priority')}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {formatStatus(priority)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="form-expected">
                Expected delivery
              </label>
              <input
                id="form-expected"
                className="input-control"
                type="datetime-local"
                value={form.expected_delivery}
                onChange={update('expected_delivery')}
              />
            </div>
          </div>

          {isRequest && (
            <div style={{ marginTop: 14 }}>
              <label className="field-label" htmlFor="form-notes">
                Notes (optional)
              </label>
              <textarea
                id="form-notes"
                className="input-control"
                rows={3}
                style={{ resize: 'vertical' }}
                value={form.notes}
                onChange={update('notes')}
                placeholder="Anything operations should know…"
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              marginTop: 22
            }}
          >
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? 'Saving…'
                : isRequest
                  ? 'Submit request'
                  : isEdit
                    ? 'Save changes'
                    : 'Create shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
