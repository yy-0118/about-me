const TOKEN_KEY = 'admin_token'
const EXPIRES_KEY = 'admin_token_expires'

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const expires = localStorage.getItem(EXPIRES_KEY)
  if (!token || !expires) return null
  if (new Date(expires).getTime() <= Date.now()) {
    clearToken()
    return null
  }
  return token
}

export function setToken(token: string, expiresAt: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXPIRES_KEY, expiresAt)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}
