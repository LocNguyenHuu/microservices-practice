export interface EventLog {
  id: string
  event_type: string
  source_service: string
  payload: Record<string, unknown>
  received_at: string
}

export interface Alert {
  id: string
  alert_type: AlertType
  severity: AlertSeverity
  flight_id: string | null
  turnaround_id: string | null
  title: string
  description: string | null
  status: AlertStatus
  created_at: string
  resolved_at: string | null
}

export type AlertType =
  | "turnaround_delayed"
  | "task_stuck"
  | "crew_shortage"
  | "gate_conflict"

export type AlertSeverity = "info" | "warning" | "critical"

export type AlertStatus = "open" | "acknowledged" | "resolved" | "auto_resolved"
