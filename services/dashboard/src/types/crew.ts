export interface CrewMember {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  team_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  certifications?: Certification[]
}

export interface Certification {
  id: string
  crew_member_id: string
  cert_type: CertType
  issued_date: string
  expiry_date: string
  status: "active" | "expired" | "suspended"
}

export type CertType =
  | "fueling"
  | "cargo"
  | "pushback"
  | "marshalling"
  | "catering"
  | "cleaning"
  | "boarding"

export interface TaskAssignment {
  id: string
  crew_member_id: string
  turnaround_id: string
  task_id: string
  task_type: string
  assigned_at: string
  status: "assigned" | "active" | "completed" | "reassigned"
}
