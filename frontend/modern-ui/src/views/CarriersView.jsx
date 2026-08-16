import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorState, LoadingRows } from '../components/States'
import { formatDate } from '../lib/domain'

/**
 * Carrier management (OPERATIONS/ADMIN).
 *
 * Create is ADMIN-only and delete is ADMIN-only, matching the backend route
 * guards exactly so the UI never offers an action the API will refuse.
 */

function CarrierForm({ carrier, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = Boolean(carrier)

  const [form, setForm] = useState({
    name: carrier?.name || '',
    code: carrier?.code || '',
    api_enabled: Boolean(carrier?.api_enabled)
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (isEdit) {
        await api.patch(`/carriers/${carrier.id}`, {
          name: form.name.trim(),
          api_enabled: form.api_enabled
        })
        toast.success(`${form.name} updated.`)
      } else {
        await api.post('/carriers', {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          api_enabled: form.api_enabled
        })
        toast.success(`${form.name} created.`)
      }

      onSaved()
    } catch (submitError) {
      setError(submitError.message || 'Could not save the carrier.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-panel"
        style={{ maxWidth: 460 }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="eyebrow" style={{ marginBottom: 5 }}>Carrier</div>
          <h2 className="h1-page" style={{ fontSize: 19 }}>
            {isEdit ? 'Edit carrier' : 'New carrier'}
          </h2>
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

          <div style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="carrier-name">Name</label>
            <input
              id="carrier-name"
              className="input-control"
              required
              value={form.name}
              onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
              placeholder="DHL Express"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="carrier-code">Code</label>
            <input
              id="carrier-code"
              className="input-control"
              required
              disabled={isEdit}
              value={form.code}
              onChange={(event) => setForm((c) => ({ ...c, code: event.target.value }))}
              placeholder="DHL"
            />
            {isEdit && (
              <div className="kpi-caption" style={{ marginTop: 5 }}>
                Carrier codes are immutable once created.
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.api_enabled}
              onChange={(event) =>
                setForm((c) => ({ ...c, api_enabled: event.target.checked }))
              }
            />
            <span className="body-text">API integration enabled</span>
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create carrier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CarriersView() {
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formState, setFormState] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get('/carriers')
      setCarriers(response.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load carriers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (carrier) => {
    if (!window.confirm(`Delete carrier ${carrier.name}?`)) return

    try {
      await api.delete(`/carriers/${carrier.id}`)
      toast.success(`${carrier.name} deleted.`)
      await load()
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the carrier.')
    }
  }

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
          <div className="eyebrow" style={{ marginBottom: 6 }}>Network</div>
          <h1 className="h1-page">Carriers</h1>
          <div className="body-text-secondary" style={{ marginTop: 4 }}>
            {loading ? 'Loading carriers…' : `${carriers.length} carrier(s)`}
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormState({})}
          >
            New Carrier
          </button>
        )}
      </div>

      <div className="glass-surface rule rounded-md" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex items-center gap-3">
            <div className="pill-badge">Carrier</div>
            <span className="eyebrow">Registered partners</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 18 }}><LoadingRows rows={4} /></div>
        ) : error ? (
          <div style={{ padding: 18 }}><ErrorState message={error} onRetry={load} /></div>
        ) : carriers.length === 0 ? (
          <EmptyState
            title="No carriers configured"
            description="Add a carrier before creating shipments."
          />
        ) : (
          <div className="table-scroll scroll-area">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>API</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((carrier) => (
                  <tr key={carrier.id}>
                    <td>{carrier.name}</td>
                    <td className="cell-mono">{carrier.code}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          carrier.api_enabled ? 'status-success' : 'status-neutral'
                        }`}
                      >
                        {carrier.api_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="cell-muted">{formatDate(carrier.created_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setFormState({ carrier })}
                      >
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          style={{ marginLeft: 6 }}
                          onClick={() => remove(carrier)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formState && (
        <CarrierForm
          carrier={formState.carrier}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null)
            load()
          }}
        />
      )}
    </section>
  )
}
