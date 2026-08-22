import axios from 'axios'

const backendUrl = import.meta.env.VITE_BACKEND_URL

// Refresh tokens live in HttpOnly cookies — never in sessionStorage.
export const ACCESS_KEYS = {
  admin: 'aToken',
  doctor: 'dToken',
  dean: 'deanToken',
  receptionist: 'recToken',
}

/** Legacy keys — cleared on logout for users who logged in before cookie auth. */
const LEGACY_REFRESH_KEYS = {
  admin: 'aRefreshToken',
  doctor: 'dRefreshToken',
  dean: 'deanRefreshToken',
  receptionist: 'recRefreshToken',
}

export function saveAuthTokens(role, accessToken) {
  if (accessToken) sessionStorage.setItem(ACCESS_KEYS[role], accessToken)
}

export function clearAuthTokens(role) {
  sessionStorage.removeItem(ACCESS_KEYS[role])
  sessionStorage.removeItem(LEGACY_REFRESH_KEYS[role])
  if (role === 'dean') sessionStorage.removeItem('deanInfo')
  if (role === 'receptionist') sessionStorage.removeItem('recInfo')
}

export async function logoutWithApi(role) {
  try {
    await axios.post(
      `${backendUrl}/api/auth/logout`,
      { role },
      { withCredentials: true }
    )
  } catch (_) {
    /* revoke best-effort */
  }
  clearAuthTokens(role)
}
