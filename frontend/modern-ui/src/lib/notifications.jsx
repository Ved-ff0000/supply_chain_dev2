import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, tokenStore } from './api'
import { useAuth } from './auth'

/**
 * Live notification state shared by the bell badge and the notifications feed.
 *
 * Subscribes to the SSE stream so new notifications arrive without polling.
 * EventSource cannot send an Authorization header, so the access token is
 * passed as a query parameter (the backend accepts it for this route only).
 */

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)

  const sourceRef = useRef(null)
  const retryRef = useRef(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) return

    setLoading(true)
    setError('')

    try {
      const [listResponse, countResponse] = await Promise.all([
        api.get('/notifications?limit=50'),
        api.get('/notifications/unread-count')
      ])

      setNotifications(listResponse.data || [])
      setUnreadCount(Number(countResponse.unread_count) || 0)
    } catch (loadError) {
      setError(loadError.message || 'Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      load()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated, load])

  // ----------------------------------------------------
  // SSE subscription
  // ----------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated) return undefined

    let cancelled = false

    const connect = () => {
      if (cancelled) return

      const token = tokenStore.getAccess()
      if (!token) return

      const source = new EventSource(
        `/api/notifications/stream?token=${encodeURIComponent(token)}`
      )

      sourceRef.current = source

      source.addEventListener('connected', () => {
        if (!cancelled) setConnected(true)
      })

      source.addEventListener('notification', (event) => {
        if (cancelled) return

        try {
          const incoming = JSON.parse(event.data)

          setNotifications((current) => {
            if (current.some((item) => item.id === incoming.id)) {
              return current
            }
            return [incoming, ...current].slice(0, 100)
          })

          if (String(incoming.status).toUpperCase() === 'UNREAD') {
            setUnreadCount((count) => count + 1)
          }
        } catch {
          /* malformed frame — ignore */
        }
      })

      source.onerror = () => {
        setConnected(false)
        source.close()

        // The token may simply have rotated; reconnect with a fresh one.
        if (!cancelled) {
          retryRef.current = setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      setConnected(false)

      if (retryRef.current) clearTimeout(retryRef.current)
      if (sourceRef.current) sourceRef.current.close()
    }
  }, [isAuthenticated])

  // ----------------------------------------------------
  // Mutations
  // ----------------------------------------------------

  const markRead = useCallback(async (id) => {
    await api.patch(`/notifications/${id}/read`)

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: 'READ', read_at: new Date().toISOString() } : item
      )
    )

    setUnreadCount((count) => Math.max(count - 1, 0))
  }, [])

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read-all')

    setNotifications((current) =>
      current.map((item) => ({ ...item, status: 'READ' }))
    )

    setUnreadCount(0)
  }, [])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      connected,
      reload: load,
      markRead,
      markAllRead
    }),
    [notifications, unreadCount, loading, error, connected, load, markRead, markAllRead]
  )

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }

  return context
}
