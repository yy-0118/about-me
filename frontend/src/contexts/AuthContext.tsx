import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { adminLogin } from '../lib/api'
import { clearToken, getToken, setToken } from '../lib/auth'

interface AuthContextValue {
  isAdmin: boolean
  expiresAt: string | null
  login: (password: string) => Promise<void>
  logout: () => void
  authedFetch: typeof fetch
}

const AuthContext = createContext<AuthContextValue>({
  isAdmin: false,
  expiresAt: null,
  login: async () => {},
  logout: () => {},
  authedFetch: fetch,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(getToken())
  const [expiresAt, setExpiresAt] = useState<string | null>(
    localStorage.getItem('admin_token_expires'),
  )

  useEffect(() => {
    if (!token) return
    const ms = new Date(expiresAt || 0).getTime() - Date.now()
    if (ms <= 0) {
      clearToken()
      setTokenState(null)
      setExpiresAt(null)
      return
    }
    const t = window.setTimeout(() => {
      clearToken()
      setTokenState(null)
      setExpiresAt(null)
    }, ms)
    return () => window.clearTimeout(t)
  }, [token, expiresAt])

  const login = useCallback(async (password: string): Promise<void> => {
    const resp = await adminLogin(password)
    setToken(resp.token, resp.expires_at)
    setTokenState(resp.token)
    setExpiresAt(resp.expires_at)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setExpiresAt(null)
  }, [])

  const authedFetch = useCallback(
    (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers || {})
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return fetch(input, { ...init, headers })
    },
    [token],
  )

  return (
    <AuthContext.Provider
      value={{ isAdmin: !!token, expiresAt, login, logout, authedFetch }}
    >
      {children}
    </AuthContext.Provider>
  )
}
