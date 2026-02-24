// In Docker, nginx proxies all API calls. In dev, Vite proxy handles it.
export const API_BASE = ""

export const STATUS_COLORS: Record<string, string> = {
  // Flight statuses
  scheduled: "bg-status-blue text-white",
  arrived: "bg-status-green text-white",
  boarding: "bg-status-amber text-black",
  departed: "bg-status-gray text-white",
  cancelled: "bg-status-red text-white",
  diverted: "bg-status-red text-white",

  // Turnaround statuses
  pending: "bg-status-gray text-white",
  in_progress: "bg-status-blue text-white",
  completed: "bg-status-green text-white",
  delayed: "bg-status-amber text-black",

  // Task statuses
  blocked: "bg-status-red text-white",
  skipped: "bg-status-gray text-white",

  // Alert severities
  info: "bg-status-blue text-white",
  warning: "bg-status-amber text-black",
  critical: "bg-status-red text-white",

  // Equipment statuses
  available: "bg-status-green text-white",
  in_use: "bg-status-blue text-white",
  maintenance: "bg-status-amber text-black",
  out_of_service: "bg-status-red text-white",

  // Generic
  active: "bg-status-green text-white",
  open: "bg-status-red text-white",
  acknowledged: "bg-status-amber text-black",
  resolved: "bg-status-green text-white",
  auto_resolved: "bg-status-green text-white",
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "bg-status-gray text-white"
}

export const CERT_COLORS: Record<string, string> = {
  fueling: "bg-orange-600",
  cargo: "bg-amber-700",
  pushback: "bg-indigo-600",
  marshalling: "bg-purple-600",
  catering: "bg-pink-600",
  cleaning: "bg-teal-600",
  boarding: "bg-sky-600",
}
