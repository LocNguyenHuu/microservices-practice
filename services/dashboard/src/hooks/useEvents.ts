import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { EventLog, Alert } from "@/types/event"

export function useEvents(limit = 50) {
  return useQuery({
    queryKey: ["events", limit],
    queryFn: () => api.get<EventLog[]>(`/api/events?limit=${limit}`),
    refetchInterval: 10_000,
  })
}

export function useAlerts(status?: string, severity?: string) {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (severity) params.set("severity", severity)

  return useQuery({
    queryKey: ["alerts", status, severity],
    queryFn: () => api.get<Alert[]>(`/api/alerts?${params}`),
    refetchInterval: 10_000,
  })
}
