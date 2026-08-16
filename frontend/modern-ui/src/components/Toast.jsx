import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Toast notifications.
 *
 * Every mutating action in the app confirms through this provider, so success
 * and failure feedback is consistent everywhere.
 */

const ToastContext = createContext(null)

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast))
    )

    // Let the exit animation finish before unmounting.
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 200)
  }, [])

  const push = useCallback(
    (message, variant = 'info', duration = 4200) => {
      const id = ++nextId

      setToasts((current) => [...current, { id, message, variant, leaving: false }])

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }

      return id
    },
    [dismiss]
  )

  const value = useMemo(
    () => ({
      push,
      success: (message, duration) => push(message, 'success', duration),
      error: (message, duration) => push(message, 'error', duration ?? 6000),
      info: (message, duration) => push(message, 'info', duration),
      dismiss
    }),
    [push, dismiss]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.variant}${toast.leaving ? ' is-leaving' : ''}`}
          >
            <span className="toast-accent" aria-hidden />
            <span className="body-text" style={{ flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="clickable"
              style={{
                background: 'none',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                fontSize: 15,
                lineHeight: 1,
                padding: 0
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}
