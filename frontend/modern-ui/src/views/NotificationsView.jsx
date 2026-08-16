import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useNotifications } from '../lib/notifications'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorState, LoadingRows } from '../components/States'
import { formatRelative, formatStatus, statusTone } from '../lib/domain'

/**
 * Notifications: a live feed plus the delivery-preference editor.
 */

const TABS = [
  { key: 'feed', label: 'Feed' },
  { key: 'preferences', label: 'Preferences' }
]

function PreferencesPanel() {
  const toast = useToast()

  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true

    api
      .get('/notifications/preferences')
      .then((response) => {
        if (alive) setPrefs(response.data || {})
      })
      .catch((prefsError) => {
        if (alive) setError(prefsError.message || 'Could not load preferences.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

  const toggle = (key) => (event) =>
    setPrefs((current) => ({ ...current, [key]: event.target.checked }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await api.put('/notifications/preferences', {
        email_enabled: Boolean(prefs.email_enabled),
        in_app_enabled: Boolean(prefs.in_app_enabled),
        webhook_enabled: Boolean(prefs.webhook_enabled),
        webhook_url: prefs.webhook_url || null,
        notify_in_transit: Boolean(prefs.notify_in_transit),
        notify_customs_hold: Boolean(prefs.notify_customs_hold),
        notify_delayed: Boolean(prefs.notify_delayed),
        notify_out_for_delivery: Boolean(prefs.notify_out_for_delivery),
        notify_delivered: Boolean(prefs.notify_delivered)
      })

      setPrefs(response.data || prefs)
      toast.success('Preferences saved.')
    } catch (saveError) {
      toast.error(saveError.message || 'Could not save preferences.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 18 }}>
        <LoadingRows rows={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 18 }}>
        <ErrorState message={error} />
      </div>
    )
  }

  const channels = [
    { key: 'email_enabled', label: 'Email', caption: 'Status updates sent to your inbox' },
    { key: 'in_app_enabled', label: 'In-app', caption: 'Live notifications inside the hub' },
    { key: 'webhook_enabled', label: 'Webhook', caption: 'POST events to your own endpoint' }
  ]

  const statusToggles = [
    { key: 'notify_in_transit', label: 'In transit' },
    { key: 'notify_customs_hold', label: 'Customs hold' },
    { key: 'notify_delayed', label: 'Delayed' },
    { key: 'notify_out_for_delivery', label: 'Out for delivery' },
    { key: 'notify_delivered', label: 'Delivered' }
  ]

  return (
    <form onSubmit={save} style={{ padding: 20 }}>
      <div className="h2-section" style={{ marginBottom: 4 }}>
        Delivery channels
      </div>
      <div className="body-text-secondary" style={{ marginBottom: 16 }}>
        Choose how shipment updates reach you.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {channels.map((channel) => (
          <label
            key={channel.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 11,
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(prefs[channel.key])}
              onChange={toggle(channel.key)}
              style={{ marginTop: 3 }}
            />
            <span>
              <span className="kpi-label" style={{ display: 'block' }}>
                {channel.label}
              </span>
              <span className="kpi-caption">{channel.caption}</span>
            </span>
          </label>
        ))}
      </div>

      {prefs.webhook_enabled && (
        <div style={{ marginBottom: 24 }}>
          <label className="field-label" htmlFor="webhook-url">
            Webhook URL
          </label>
          <input
            id="webhook-url"
            className="input-control"
            type="url"
            placeholder="https://example.com/hooks/supplychain"
            value={prefs.webhook_url || ''}
            onChange={(event) =>
              setPrefs((current) => ({ ...current, webhook_url: event.target.value }))
            }
          />
          <div className="kpi-caption" style={{ marginTop: 5 }}>
            Deliveries are retried with exponential backoff and signed with HMAC-SHA256.
          </div>
        </div>
      )}

      <div className="h2-section" style={{ marginBottom: 4 }}>
        Status triggers
      </div>
      <div className="body-text-secondary" style={{ marginBottom: 16 }}>
        Only notify me when a shipment reaches these states.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
          marginBottom: 24
        }}
      >
        {statusToggles.map((item) => (
          <label
            key={item.key}
            style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={Boolean(prefs[item.key])}
              onChange={toggle(item.key)}
            />
            <span className="body-text">{item.label}</span>
          </label>
        ))}
      </div>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  )
}

export default function NotificationsView() {
  const { notifications, unreadCount, loading, error, connected, reload, markRead, markAllRead } =
    useNotifications()

  const toast = useToast()
  const [tab, setTab] = useState('feed')

  const handleMarkAll = async () => {
    try {
      await markAllRead()
      toast.success('All notifications marked as read.')
    } catch (markError) {
      toast.error(markError.message || 'Could not mark all as read.')
    }
  }

  const handleMarkRead = async (notification) => {
    try {
      await markRead(notification.id)
    } catch (markError) {
      toast.error(markError.message || 'Could not mark as read.')
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
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Notifications
          </div>
          <h1 className="h1-page">Notification Center</h1>
          <div className="body-text-secondary" style={{ marginTop: 4 }}>
            {unreadCount} unread ·{' '}
            <span style={{ color: connected ? '#6ee7b7' : '#a1a1aa' }}>
              {connected ? 'Live stream connected' : 'Reconnecting…'}
            </span>
          </div>
        </div>

        {tab === 'feed' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={reload} disabled={loading}>
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`btn btn-sm${tab === item.key ? ' btn-primary' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="glass-surface rule rounded-md" style={{ overflow: 'hidden' }}>
        {tab === 'preferences' ? (
          <PreferencesPanel />
        ) : loading ? (
          <div style={{ padding: 18 }}>
            <LoadingRows rows={5} />
          </div>
        ) : error ? (
          <div style={{ padding: 18 }}>
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="Shipment updates will appear here as they happen."
          />
        ) : (
          <div>
            {notifications.map((notification) => {
              const isUnread = String(notification.status).toUpperCase() === 'UNREAD'

              return (
                <div
                  key={notification.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isUnread ? 'rgba(79,70,229,0.045)' : 'transparent'
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isUnread ? 'var(--accent)' : 'transparent',
                      marginTop: 7,
                      flexShrink: 0
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: 4
                      }}
                    >
                      <span className={`status-pill ${statusTone(notification.type)}`}>
                        {formatStatus(notification.type)}
                      </span>
                      <span className="body-text" style={{ fontWeight: 600 }}>
                        {notification.title}
                      </span>
                    </div>

                    <div className="body-text-secondary">{notification.message}</div>

                    <div className="kpi-caption" style={{ marginTop: 5 }}>
                      {formatRelative(notification.created_at)}
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleMarkRead(notification)}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
