import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorState, LoadingRows } from '../components/States'
import { formatDateTime, formatStatus, priorityTone } from '../lib/domain'

/**
 * Pending customer shipment requests awaiting an OPERATIONS/ADMIN decision.
 *
 * Approve moves PENDING_APPROVAL -> CREATED and reject moves it to CANCELLED,
 * both through the shared backend status pipeline.
 */

export default function ApprovalsView() {
  const toast = useToast()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get('/shipments/requests/pending')
      setRequests(response.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load pending requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (request, decision) => {
    if (decision === 'reject' && !window.confirm(`Reject ${request.tracking_number}?`)) {
      return
    }

    setBusyId(request.id)

    try {
      await api.post(`/shipments/${request.id}/${decision}`)

      toast.success(
        decision === 'approve'
          ? `${request.tracking_number} approved.`
          : `${request.tracking_number} rejected.`
      )

      await load()
    } catch (decisionError) {
      toast.error(decisionError.message || 'Could not process the request.')
    } finally {
      setBusyId(null)
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
          <div className="eyebrow" style={{ marginBottom: 6 }}>Operations</div>
          <h1 className="h1-page">Pending Approvals</h1>
          <div className="body-text-secondary" style={{ marginTop: 4 }}>
            {loading ? 'Loading requests…' : `${requests.length} awaiting review`}
          </div>
        </div>

        <button type="button" className="btn" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="glass-surface rule rounded-md" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex items-center gap-3">
            <div className="pill-badge">Requests</div>
            <span className="eyebrow">Customer submitted</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 18 }}><LoadingRows rows={4} /></div>
        ) : error ? (
          <div style={{ padding: 18 }}><ErrorState message={error} onRetry={load} /></div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="Nothing awaiting approval"
            description="Customer shipment requests will appear here for review."
          />
        ) : (
          <div className="table-scroll scroll-area">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tracking #</th>
                  <th>Customer</th>
                  <th>Carrier</th>
                  <th>Route</th>
                  <th>Priority</th>
                  <th>Requested</th>
                  <th style={{ textAlign: 'right' }}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="cell-mono">{request.tracking_number}</td>
                    <td>
                      <div className="body-text">{request.customer}</div>
                      {request.requested_by_name && (
                        <div className="kpi-caption">by {request.requested_by_name}</div>
                      )}
                    </td>
                    <td>{request.carrier}</td>
                    <td className="cell-muted">
                      {request.origin} → {request.destination}
                    </td>
                    <td>
                      <span className={`status-pill ${priorityTone(request.priority)}`}>
                        {formatStatus(request.priority)}
                      </span>
                    </td>
                    <td className="cell-muted cell-mono">
                      {formatDateTime(request.created_at)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={busyId === request.id}
                        onClick={() => decide(request, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{ marginLeft: 6 }}
                        disabled={busyId === request.id}
                        onClick={() => decide(request, 'reject')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
