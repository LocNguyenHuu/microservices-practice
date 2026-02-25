export interface User {
  id: string
  username: string
  email: string | null
  role: Role
  is_active: boolean
  created_at: string
}

export type Role =
  | "admin"
  | "ops_manager"
  | "crew_supervisor"
  | "ground_crew"
  | "viewer"

export interface LoginResponse {
  token: string
  user: User
}
