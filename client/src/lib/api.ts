export function getUserId() {
  return localStorage.getItem('userId') || ''
}

export function setUserId(id: string) {
  localStorage.setItem('userId', id)
}

export function headers() {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const uid = getUserId()
  if (uid) h['X-User-Id'] = uid // dev fallback only if explicitly set
  return h
}

export const fetchWithCreds = (input: RequestInfo | URL, init: RequestInit = {}) => {
  return fetch(input, { ...init, credentials: 'include' })
}

// Utility for clearing any dev-only header usage on logout
export function clearDevUserId() {
  try { localStorage.removeItem('userId') } catch {}
}
