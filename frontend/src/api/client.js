import axios from 'axios'

const TOKEN_KEY = 'rc_admin_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api',
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !location.pathname.startsWith('/login')) {
      tokenStore.clear()
      location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** Pull the first readable message out of a Laravel error response. */
export function errorMessage(error) {
  const data = error.response?.data
  if (data?.errors) return Object.values(data.errors)[0][0]
  return data?.message ?? 'Could not reach the server. Check that the API is running.'
}

/** Download a file from an authenticated endpoint (CSV / PDF reports). */
export async function downloadFile(url, params) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const disposition = res.headers['content-disposition'] ?? ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = match?.[1] ?? 'report'
  a.click()
  URL.revokeObjectURL(href)
}

export default api
