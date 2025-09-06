export function getUserId() {
  return localStorage.getItem('userId') || 'demo-user'
}

export function setUserId(id: string) {
  localStorage.setItem('userId', id)
}

export function headers() {
  return { 'Content-Type': 'application/json', 'X-User-Id': getUserId() }
}
