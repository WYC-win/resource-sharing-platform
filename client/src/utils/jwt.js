/**
 * JWT helper utilities (shared by router guard and App.vue)
 */

// Decode JWT payload (base64url) without external deps
export function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Is the JWT expired? (front-end pre-check only; real validation happens server-side)
export function isTokenExpired(token) {
  if (!token) return true
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return false
  return payload.exp * 1000 < Date.now()
}
