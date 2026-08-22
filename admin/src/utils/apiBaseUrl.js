/** Shared FastAPI base URL for admin panel API/socket calls. */
export function getApiBaseUrl() {
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
}
