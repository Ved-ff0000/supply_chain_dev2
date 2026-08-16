import React, { useCallback, useEffect, useState } from 'react'
import { authApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorState, LoadingRows } from '../components/States'
import { formatDateTime, formatRelative } from '../lib/domain'

/**
 * Account settings: profile summary, email-verification notice and active
 * session management (list + revoke).
 */

export default function SettingsView() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await authApi.sessions()
      setSessions(response.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load your sessions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const revoke = async (session) => {
    setBusy(true)

    try {
      await authApi.revokeSession(session.id)
      toast.success('Session revoked.')
      await load()
    } catch (revokeError) {
      toast.error(revokeError.message || 'Could not revoke the session.')
    } finally {
      setBusy(false)
    }
  }

  const revokeAll = async () => {
    if (!window.confirm('Sign out of every other device?')) return

    setBusy(true)

    try {
      const response = await authApi.revokeAllSessions()
      toast.success(response.message || 'Other sessions revoked.')
      await load()
    } catch (revokeError) {
      toast.error(revokeError.message || 'Could not revoke sessions.')
    } finally {
      setBusy(false)
    }
  }

  const resendVerification = async () => {
    setBusy(true)

    try {
      const response = await authApi.resendVerification()
      toast.success(response.message || 'Verification email sent.')
      await refreshUser()
    } catch (verifyError) {
      toast.error(verifyError.message || 'Could not send the verification email.')
    } finally {
      setBusy(false)
    }
  }

  const activeSessions = sessions.filter((session) => !session.revoked)

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Account</div>
        <h1 className="h1-page">Settings</h1>
        <div className="body-text-secondary" style={{ marginTop: 4 }}>
          Profile, verification and device access
        </div>
      </div>

      {/* Email verification notice ------------------------------------- */}
      {user && user.email_verified === false && (
        <div
          className="rounded-md"
          style={{
            marginBottom: 16,
            padding: 16,
            border: '1px solid rgba(245,158,11,0.28)',
            background: 'rgba(245,158,11,0.07)'
          }}
        >
          <div className="eyebrow" style={{ color: '#fcd34d', marginBottom: 6 }}>
            Verify your email
          </div>
          <div className="body-text" style={{ marginBottom: 12 }}>
            Confirm <strong>{user.email}</strong> to secure your account and receive
            shipment notifications by email.
          </div>
          <button type="button" className="btn btn-sm" onClick={resendVerification} disabled={busy}>
            Resend verification email
          </button>
        </div>
      )}

      {/* Profile -------------------------------------------------------- */}
      <div className="p-4 glass-surface rule rounded-md" style={{ marginBottom: 16 }}>
        <div className="h2-section" style={{ marginBottom: 14 }}>Profile</div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Name</div>
            <div className="body-text">{user?.name || '—'}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Email</div>
            <div className="body-text">{user?.email || '—'}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Role</div>
            <span className="status-pill status-progress">{user?.role}</span>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Email verified</div>
            <span
              className={`status-pill ${
                user?.email_verified === false ? 'status-warn' : 'status-success'
              }`}
            >
              {user?.email_verified === false ? 'Pending' : 'Verified'}
            </span>
          </div>
        </div>
      </div>

      {/* Sessions ------------------------------------------------------- */}
      <div className="glass-surface rule rounded-md" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex items-center gap-3">
            <div className="pill-badge">Sessions</div>
            <span className="eyebrow">{activeSessions.length} active</span>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={revokeAll}
            disabled={busy || activeSessions.length <= 1}
          >
            Sign out other devices
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 18 }}><LoadingRows rows={3} /></div>
        ) : error ? (
          <div style={{ padding: 18 }}><ErrorState message={error} onRetry={load} /></div>
        ) : sessions.length === 0 ? (
          <EmptyState title="No sessions found" compact />
        ) : (
          <div className="table-scroll scroll-area">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>IP address</th>
                  <th>Signed in</th>
                  <th>Last active</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td style={{ maxWidth: 260 }}>
                      <span className="body-text">
                        {session.user_agent || 'Unknown device'}
                      </span>
                    </td>
                    <td className="cell-mono cell-muted">{session.ip_address || '—'}</td>
                    <td className="cell-muted">{formatDateTime(session.created_at)}</td>
                    <td className="cell-muted">{formatRelative(session.last_active_at)}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          session.revoked ? 'status-neutral' : 'status-success'
                        }`}
                      >
                        {session.revoked ? 'Revoked' : 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!session.revoked && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => revoke(session)}
                          disabled={busy}
                        >
                          Revoke
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
    </section>
  )
}
