import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, authApi, onUnauthorized, tokenStore } from './api'

/**
 * Session state for the whole app.
 *
 * On boot the stored user is trusted optimistically so the shell can render
 * immediately, then /auth/me revalidates against the server. Any 401 that the
 * API client cannot recover from clears the session and drops the user back on
 * the login screen.
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.getUser())
  const [initialising, setInitialising] = useState(true)

  // Revalidate a stored session once at start-up.
  useEffect(() => {
    let alive = true

    const bootstrap = async () => {
      if (!tokenStore.getAccess()) {
        if (alive) setInitialising(false)
        return
      }

      try {
        const response = await api.get('/auth/me')
        const freshUser = response.data || response.user

        if (alive && freshUser) {
          setUser(freshUser)
          tokenStore.set({ user: freshUser })
        }
      } catch {
        // The API client already cleared the session on a fatal 401.
        if (alive) setUser(null)
      } finally {
        if (alive) setInitialising(false)
      }
    }

    bootstrap()
    return () => {
      alive = false
    }
  }, [])

  // Central reaction to an unrecoverable 401.
  useEffect(() => onUnauthorized(() => setUser(null)), [])

  const login = useCallback(async (email, password) => {
    const loggedIn = await authApi.login(email, password)
    setUser(loggedIn)
    return loggedIn
  }, [])

  const register = useCallback(async (details) => {
    const registered = await authApi.register(details)
    setUser(registered)
    return registered
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me')
    const freshUser = response.data || response.user

    if (freshUser) {
      setUser(freshUser)
      tokenStore.set({ user: freshUser })
    }

    return freshUser
  }, [])

  const role = String(user?.role || '').toUpperCase()

  const value = useMemo(
    () => ({
      user,
      role,
      initialising,
      isAuthenticated: Boolean(user),
      isAdmin: role === 'ADMIN',
      isStaff: role === 'ADMIN' || role === 'OPERATIONS',
      isCustomer: role === 'CUSTOMER',
      login,
      register,
      logout,
      refreshUser
    }),
    [user, role, initialising, login, register, logout, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
