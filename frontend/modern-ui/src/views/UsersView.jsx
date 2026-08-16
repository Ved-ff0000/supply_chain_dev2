import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorState, LoadingRows } from '../components/States'
import { formatDateTime } from '../lib/domain'

/**
 * User and role management (ADMIN only).
 */

const ROLES = ['CUSTOMER', 'OPERATIONS', 'ADMIN']

export default function UsersView() {
  const { user: currentUser } = useAuth()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get('/users')
      setUsers(response.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const changeRole = async (user, role) => {
    setBusyId(user.id)

    try {
      await api.patch(`/users/${user.id}/role`, { role })
      toast.success(`${user.name} is now ${role}.`)
      await load()
    } catch (roleError) {
      toast.error(roleError.message || 'Could not change the role.')
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (user) => {
    setBusyId(user.id)

    try {
      await api.patch(`/users/${user.id}/status`, { is_active: !user.is_active })
      toast.success(`${user.name} ${user.is_active ? 'deactivated' : 'activated'}.`)
      await load()
    } catch (statusError) {
      toast.error(statusError.message || 'Could not change the status.')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (user) => {
    if (!window.confirm(`Delete user ${user.email}?`)) return

    setBusyId(user.id)

    try {
      await api.delete(`/users/${user.id}`)
      toast.success(`${user.email} deleted.`)
      await load()
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the user.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Administration</div>
        <h1 className="h1-page">Users &amp; Roles</h1>
        <div className="body-text-secondary" style={{ marginTop: 4 }}>
          {loading ? 'Loading users…' : `${users.length} account(s)`}
        </div>
      </div>

      <div className="glass-surface rule rounded-md" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex items-center gap-3">
            <div className="pill-badge">Users</div>
            <span className="eyebrow">Access control</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 18 }}><LoadingRows rows={4} /></div>
        ) : error ? (
          <div style={{ padding: 18 }}><ErrorState message={error} onRetry={load} /></div>
        ) : users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <div className="table-scroll scroll-area">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = currentUser && user.id === currentUser.id

                  return (
                    <tr key={user.id}>
                      <td>
                        {user.name}
                        {isSelf && (
                          <span className="kpi-caption" style={{ marginLeft: 6 }}>
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="cell-muted">{user.email}</td>
                      <td>
                        <select
                          className="input-control"
                          style={{ width: 'auto', minWidth: 130, padding: '5px 8px', fontSize: 12 }}
                          value={String(user.role).toUpperCase()}
                          disabled={isSelf || busyId === user.id}
                          onChange={(event) => changeRole(user, event.target.value)}
                          aria-label={`Role for ${user.name}`}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            user.is_active ? 'status-success' : 'status-neutral'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="cell-muted cell-mono">
                        {formatDateTime(user.last_login)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={isSelf || busyId === user.id}
                          onClick={() => toggleActive(user)}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          style={{ marginLeft: 6 }}
                          disabled={isSelf || busyId === user.id}
                          onClick={() => remove(user)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
