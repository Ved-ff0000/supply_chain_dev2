import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { authApi } from '../lib/api'
import { useToast } from '../components/Toast'

/**
 * Unauthenticated surface: login, register, forgot password, reset password
 * and email verification.
 *
 * Reuses the same obsidian glass-surface card, rule borders, eyebrow labels
 * and button styles as the signed-in application, so the entry point does not
 * introduce a second visual language.
 */

const panelVariant = {
  hidden: { y: 16, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }
}

function Field({ id, label, hint, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="input-control" {...props} />
      {hint && (
        <div className="kpi-caption" style={{ marginTop: 5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

export default function AuthView() {
  const { login, register } = useAuth()
  const toast = useToast()

  // Deep links from emails decide the initial mode.
  const [mode, setMode] = useState(() => {
    const path = window.location.pathname
    const params = new URLSearchParams(window.location.search)

    if (path.includes('reset-password') || params.get('token')) {
      if (path.includes('verify-email')) return 'verify'
      if (path.includes('reset-password')) return 'reset'
    }

    if (path.includes('verify-email')) return 'verify'
    return 'login'
  })

  const [emailToken] = useState(
    () => new URLSearchParams(window.location.search).get('token') || ''
  )

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  // Verification links resolve as soon as the screen mounts.
  useEffect(() => {
    if (mode !== 'verify' || !emailToken) return

    let alive = true
    setBusy(true)

    authApi
      .verifyEmail(emailToken)
      .then(() => {
        if (!alive) return
        setNotice('Your email address has been verified. You can sign in now.')
        setError('')
      })
      .catch((verifyError) => {
        if (!alive) return
        setError(verifyError.message || 'This verification link is invalid or has expired.')
      })
      .finally(() => {
        if (alive) setBusy(false)
      })

    return () => {
      alive = false
    }
  }, [mode, emailToken])

  const clearMessages = () => {
    setError('')
    setNotice('')
  }

  const switchMode = (next) => {
    clearMessages()
    setMode(next)
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    clearMessages()
    setBusy(true)

    try {
      const user = await login(form.email.trim(), form.password)
      toast.success(`Welcome back, ${user.name || user.email}`)
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    clearMessages()

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setBusy(true)

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: 'CUSTOMER'
      })

      toast.success('Account created. Check your email to verify your address.')
    } catch (registerError) {
      setError(registerError.message || 'Unable to create your account.')
    } finally {
      setBusy(false)
    }
  }

  const handleForgot = async (event) => {
    event.preventDefault()
    clearMessages()
    setBusy(true)

    try {
      const response = await authApi.forgotPassword(form.email.trim())
      setNotice(
        response.message ||
          'If an account exists for that email, a reset link has been sent.'
      )
    } catch (forgotError) {
      setError(forgotError.message || 'Unable to send the reset link.')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (event) => {
    event.preventDefault()
    clearMessages()

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setBusy(true)

    try {
      await authApi.resetPassword(emailToken, form.password)
      setNotice('Password updated. You can sign in with your new password.')
      setMode('login')
      toast.success('Password updated')
    } catch (resetError) {
      setError(resetError.message || 'Unable to reset your password.')
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    login: { h1: 'Sign in', eyebrow: 'Account access' },
    register: { h1: 'Create account', eyebrow: 'Get started' },
    forgot: { h1: 'Reset password', eyebrow: 'Account recovery' },
    reset: { h1: 'Choose a new password', eyebrow: 'Account recovery' },
    verify: { h1: 'Email verification', eyebrow: 'Account security' }
  }

  const current = titles[mode] || titles.login

  return (
    <div
      className="body-font"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px'
      }}
    >
      <motion.div
        initial="hidden"
        animate="show"
        variants={panelVariant}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <div className="h1-page" style={{ fontSize: 20, marginBottom: 4 }}>
            SupplyChain Notification Hub
          </div>
          <div className="eyebrow">Telemetry · Transit risk · Notifications</div>
        </div>

        <div className="glass-surface rule rounded-md" style={{ padding: 26 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {current.eyebrow}
          </div>
          <h1 className="h1-page" style={{ fontSize: 21, marginBottom: 20 }}>
            {current.h1}
          </h1>

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

          {notice && (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(16,185,129,0.28)',
                background: 'rgba(16,185,129,0.08)'
              }}
            >
              <span className="body-text" style={{ color: '#6ee7b7' }}>{notice}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} noValidate>
              <Field
                id="login-email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={update('email')}
                placeholder="you@company.com"
              />
              <Field
                id="login-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
              />

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 6 }}
                disabled={busy}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 16
                }}
              >
                <button
                  type="button"
                  className="clickable"
                  onClick={() => switchMode('forgot')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <span className="body-text-secondary">Forgot password?</span>
                </button>
                <button
                  type="button"
                  className="clickable"
                  onClick={() => switchMode('register')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <span className="body-text-secondary">Create account</span>
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} noValidate>
              <Field
                id="register-name"
                label="Full name"
                required
                value={form.name}
                onChange={update('name')}
                placeholder="Jane Cooper"
              />
              <Field
                id="register-email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={update('email')}
                placeholder="you@company.com"
              />
              <Field
                id="register-password"
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={update('password')}
                hint="At least 8 characters."
              />
              <Field
                id="register-confirm"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
              />

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 6 }}
                disabled={busy}
              >
                {busy ? 'Creating account…' : 'Create account'}
              </button>

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button
                  type="button"
                  className="clickable"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <span className="body-text-secondary">Already have an account? Sign in</span>
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} noValidate>
              <p className="body-text-secondary" style={{ marginBottom: 16 }}>
                Enter your email and we will send a link to reset your password.
              </p>

              <Field
                id="forgot-email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={update('email')}
                placeholder="you@company.com"
              />

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 6 }}
                disabled={busy}
              >
                {busy ? 'Sending…' : 'Send reset link'}
              </button>

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button
                  type="button"
                  className="clickable"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <span className="body-text-secondary">Back to sign in</span>
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} noValidate>
              {!emailToken ? (
                <p className="body-text-secondary">
                  This reset link is missing its token. Request a new link from the
                  forgot-password screen.
                </p>
              ) : (
                <>
                  <Field
                    id="reset-password"
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={form.password}
                    onChange={update('password')}
                    hint="At least 8 characters."
                  />
                  <Field
                    id="reset-confirm"
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={form.confirmPassword}
                    onChange={update('confirmPassword')}
                  />

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 6 }}
                    disabled={busy}
                  >
                    {busy ? 'Updating…' : 'Update password'}
                  </button>
                </>
              )}

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button
                  type="button"
                  className="clickable"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <span className="body-text-secondary">Back to sign in</span>
                </button>
              </div>
            </form>
          )}

          {mode === 'verify' && (
            <div>
              {busy && <p className="body-text-secondary">Verifying your email…</p>}

              {!busy && !emailToken && (
                <p className="body-text-secondary">
                  Open the verification link from your inbox to confirm your email
                  address.
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 18 }}
                onClick={() => switchMode('login')}
              >
                Go to sign in
              </button>
            </div>
          )}
        </div>

        <p
          className="kpi-caption"
          style={{ textAlign: 'center', marginTop: 16 }}
        >
          Demo accounts are listed in the project README.
        </p>
      </motion.div>
    </div>
  )
}
