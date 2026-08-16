import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { EmptyState, ErrorState, LoadingRows } from '../components/States'
import { formatDateTime, formatStatus } from '../lib/domain'

/**
 * Audit log viewer (ADMIN only).
 *
 * Reuses the shared table styling. Old/new values are rendered as an
 * expandable diff so a change can be inspected without leaving the row.
 */

const ENTITY_TYPES = ['', 'SHIPMENT', 'USER', 'CARRIER', 'SHIPMENT_EVENT']
const ACTIONS = [
  '',
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'REQUEST_CREATED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'PASSWORD_RESET',
  'ROLE_CHANGE'
]

const actionTone = (action) => {
  const value = String(action || '').toUpperCase()

  if (value.includes('DELETE') || value.includes('REJECT')) return 'status-danger'
  if (value.includes('CREATE') || value.includes('APPROVE')) return 'status-success'
  if (value.includes('STATUS')) return 'status-info'
  return 'status-progress'
}

function ValueDiff({ oldValue, newValue }) {
  const [open, setOpen] = useState(false)

  const hasValues = oldValue || newValue

  if (!hasValues) {
    return <span className="cell-muted">—</span>
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide' : 'View'}
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Before</div>
            <pre
              className="cell-mono"
              style={{
                margin: 0,
                padding: 8,
                borderRadius: 6,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.16)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 11
              }}
            >
              {oldValue ? JSON.stringify(oldValue, null, 2) : '—'}
            </pre>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>After</div>
            <pre
              className="cell-mono"
              style={{
                margin: 0,
                padding: 8,
                borderRadius: 6,
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.16)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 11
              }}
            >
              {newValue ? JSON.stringify(newValue, null, 2) : '—'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AuditLogView() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [filters, setFilters] = useState({ entity_type: '', action: '', entity_id: '' })
  const [applied, setApplied] = useState({ entity_type: '', action: '', entity_id: '' })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '25' })

    Object.entries(applied).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    try {
      const response = await api.get(`/audit-log?${params.toString()}`)
      const data = response.data || {}

      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
    } catch (loadError) {
      setError(loadError.message || 'Could not load the audit log.')
    } finally {
      setLoading(false)
    }
  }, [page, applied])

  useEffect(() => {
    load()
  }, [load])

  const applyFilters = (event) => {
    event.preventDefault()
    setPage(1)
    setApplied(filters)
  }

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Administration</div>
        <h1 className="h1-page">Audit Log</h1>
        <div className="body-text-secondary" style={{ marginTop: 4 }}>
          {loading ? 'Loading entries…' : `${total} recorded change(s)`}
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="p-4 glass-surface rule rounded-md"
        style={{ marginBottom: 16 }}
      >
        <div className="eyebrow" style={{ marginBottom: 12 }}>Filters</div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 12
          }}
        >
          <div>
            <label className="field-label" htmlFor="audit-entity">Entity type</label>
            <select
              id="audit-entity"
              className="input-control"
              value={filters.entity_type}
              onChange={(event) =>
                setFilters((c) => ({ ...c, entity_type: event.target.value }))
              }
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type || 'all'} value={type}>
                  {type ? formatStatus(type) : 'All entities'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="audit-action">Action</label>
            <select
              id="audit-action"
              className="input-control"
              value={filters.action}
              onChange={(event) => setFilters((c) => ({ ...c, action: event.target.value }))}
            >
              {ACTIONS.map((action) => (
                <option key={action || 'all'} value={action}>
                  {action ? formatStatus(action) : 'All actions'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="audit-entity-id">Entity ID</label>
            <input
              id="audit-entity-id"
              className="input-control"
              type="number"
              min="1"
              placeholder="e.g. 42"
              value={filters.entity_id}
              onChange={(event) =>
                setFilters((c) => ({ ...c, entity_id: event.target.value }))
              }
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-sm">Apply filters</button>
      </form>

      <div className="glass-surface rule rounded-md" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex items-center gap-3">
            <div className="pill-badge">Audit</div>
            <span className="eyebrow">Immutable change history</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 18 }}><LoadingRows rows={6} /></div>
        ) : error ? (
          <div style={{ padding: 18 }}><ErrorState message={error} onRetry={load} /></div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description="Changes to shipments, users and carriers are recorded here."
          />
        ) : (
          <div className="table-scroll scroll-area">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Changed by</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="cell-mono cell-muted" style={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.created_at)}
                    </td>
                    <td>
                      <span className="body-text">{formatStatus(log.entity_type)}</span>
                      <span className="cell-muted cell-mono" style={{ marginLeft: 6 }}>
                        #{log.entity_id}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${actionTone(log.action)}`}>
                        {formatStatus(log.action)}
                      </span>
                    </td>
                    <td>
                      {log.changed_by_name ? (
                        <>
                          <div className="body-text">{log.changed_by_name}</div>
                          <div className="kpi-caption">{log.changed_by_role}</div>
                        </>
                      ) : (
                        <span className="cell-muted">System</span>
                      )}
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <ValueDiff oldValue={log.old_value} newValue={log.new_value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid rgba(255,255,255,0.04)'
            }}
          >
            <span className="kpi-caption">
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
