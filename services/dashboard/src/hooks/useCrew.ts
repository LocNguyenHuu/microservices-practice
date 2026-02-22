import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { CrewMember, TaskAssignment } from "@/types/crew"

export function useCrew(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["crew", limit, offset],
    queryFn: () => api.get<CrewMember[]>(`/api/crew?limit=${limit}&offset=${offset}`),
    refetchInterval: 30_000,
  })
}

export function useAssignments() {
  return useQuery({
    queryKey: ["assignments"],
    queryFn: () => api.get<TaskAssignment[]>("/api/assignments"),
    refetchInterval: 15_000,
  })
}
