import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { User, Role, LoginResponse } from "@/types/auth"
import { api } from "@/lib/api"
import { getStoredToken, setStoredToken, clearStoredToken, isTokenExpired } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  role: Role | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const loadUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token || isTokenExpired(token)) {
      clearStoredToken()
      return
    }
    try {
      const userData = await api.get<User>("/auth/me")
      setUser(userData)
    } catch {
      clearStoredToken()
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<LoginResponse>("/auth/login", { username, password })
    setStoredToken(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    clearStoredToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
