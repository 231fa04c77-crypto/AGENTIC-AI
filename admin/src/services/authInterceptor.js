import axios from 'axios'
import { ACCESS_KEYS, clearAuthTokens } from './authApi'

const backendUrl = import.meta.env.VITE_BACKEND_URL

axios.defaults.withCredentials = true
axios.defaults.headers.common['X-Auth-Storage'] = 'cookie'
axios.defaults.headers.common['X-Client-Platform'] = 'web'

const ROLE_HEADERS = {
  admin: 'atoken',
  doctor: 'dtoken',
  dean: 'deantoken',
  receptionist: 'rectoken',
}

let refreshPromise = null

function detectRole(config) {
  const headers = config.headers || {}
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  )
  if (normalized.atoken) return 'admin'
  if (normalized.dtoken) return 'doctor'
  if (normalized.deantoken || normalized['dean-token']) return 'dean'
  if (normalized.rectoken || normalized['reception-token']) return 'receptionist'
  return null
}

function isAuthEndpoint(url = '') {
  return (
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout') ||
    url.includes('/login')
  )
}

async function refreshForRole(role) {
  const { data } = await axios.post(
    `${backendUrl}/api/auth/refresh`,
    { role },
    { withCredentials: true }
  )

  if (!data?.token) throw new Error('Refresh failed')

  sessionStorage.setItem(ACCESS_KEYS[role], data.token)

  window.dispatchEvent(
    new CustomEvent('auth:tokenRefreshed', { detail: { role, token: data.token } })
  )

  return data.token
}

export function setupAuthInterceptor() {
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config
      if (!config || config._authRetry) return Promise.reject(error)
      if (error.response?.status !== 401) return Promise.reject(error)
      if (isAuthEndpoint(config.url)) return Promise.reject(error)

      const role = detectRole(config)
      if (!role) return Promise.reject(error)

      try {
        if (!refreshPromise) {
          refreshPromise = refreshForRole(role).finally(() => {
            refreshPromise = null
          })
        }
        const newToken = await refreshPromise
        config._authRetry = true
        config.headers = config.headers || {}
        config.headers[ROLE_HEADERS[role]] = newToken
        config.withCredentials = true
        return axios(config)
      } catch (refreshError) {
        clearAuthTokens(role)
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: { role } }))
        if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
          window.location.href = '/'
        }
        return Promise.reject(refreshError)
      }
    }
  )
}
