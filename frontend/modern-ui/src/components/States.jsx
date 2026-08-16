import React from 'react'

/**
 * Loading / error / empty states.
 *
 * Every data surface in the app renders one of these instead of inventing its
 * own placeholder, so the three states look identical on every screen.
 */

export function LoadingRows({ rows = 4, height = 14 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{ height, width: `${100 - index * 7}%` }}
        />
      ))}
    </div>
  )
}

export function LoadingCard({ label = 'Loading' }) {
  return (
    <div className="p-4 glass-surface rule rounded-md">
      <div className="skeleton" style={{ height: 11, width: '45%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 26, width: '62%' }} />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry, compact = false }) {
  return (
    <div
      style={{
        padding: compact ? '16px 12px' : '28px 20px',
        textAlign: 'center',
        border: '1px solid rgba(239,68,68,0.22)',
        background: 'rgba(239,68,68,0.05)',
        borderRadius: 10
      }}
    >
      <div className="eyebrow" style={{ color: '#fca5a5', marginBottom: 6 }}>
        Error
      </div>
      <div className="body-text" style={{ marginBottom: onRetry ? 14 : 0 }}>
        {message || 'Something went wrong.'}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action, compact = false }) {
  return (
    <div style={{ padding: compact ? '20px 12px' : '40px 20px', textAlign: 'center' }}>
      <div className="h2-section" style={{ marginBottom: 6 }}>
        {title || 'Nothing here yet'}
      </div>
      {description && (
        <div className="body-text-secondary" style={{ maxWidth: 420, margin: '0 auto 16px' }}>
          {description}
        </div>
      )}
      {action}
    </div>
  )
}

/**
 * Full-page centred spinner used while the session is being restored.
 */
export function FullPageLoader({ label = 'Loading' }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 14
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.12)',
          borderTopColor: 'var(--accent)',
          animation: 'spinConic 800ms linear infinite'
        }}
      />
      <div className="eyebrow">{label}</div>
    </div>
  )
}
