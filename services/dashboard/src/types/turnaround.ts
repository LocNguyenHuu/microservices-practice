export interface Turnaround {
  _id: string
  flightId: string
  flightNumber: string
  aircraftType: string
  aircraftReg?: string
  gateId?: string
  status: TurnaroundStatus
  tasks: Task[]
  startedAt?: string
  completedAt?: string
  progressPercent: number
  createdAt: string
  updatedAt: string
}

export interface Task {
  _id: string
  name: string
  status: TaskStatus
  estimatedDurationMinutes: number
  requiredCertification?: string
  order: number
  assignedCrewId?: string
  startedAt?: string
  completedAt?: string
  notes?: string
}

export type TurnaroundStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "delayed"
  | "cancelled"

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "skipped"
