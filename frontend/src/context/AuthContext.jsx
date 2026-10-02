import { createContext, useContext, useEffect, useState } from 'react'
import api, { tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tokenStore.get()) return setLoading(false)
    api.get('/me')
      .then((res) => setUser(res.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/login', { email, password, device_name: 'admin-web' })
    tokenStore.set(res.data.token)
    setUser(res.data.user)
    return res.data.user
  }

  const logout = async () => {
    try { await api.post('/logout') } catch { /* token already invalid */ }
    tokenStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
