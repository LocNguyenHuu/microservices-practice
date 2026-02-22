import { API_BASE } from "./constants"

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem("skyturn_token")
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    const token = this.getToken()
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    return headers
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: this.headers(),
    })
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`PATCH ${path} failed: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }
}

export const api = new ApiClient()
