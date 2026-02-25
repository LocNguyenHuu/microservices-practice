import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getStoredToken } from "@/lib/auth"
import { useAuth } from "@/contexts/AuthContext"

interface SSEEvent {
  event_type: string
  source_service: string
  payload: Record<string, unknown>
  timestamp: string
}

interface SSEContextType {
  lastEvent: SSEEvent | null
  connected: boolean
}

const SSEContext = createContext<SSEContextType>({ lastEvent: null, connected: false })

export function SSEProvider({ children }: { children: ReactNode }) {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const token = getStoredToken()
    const url = `/api/events/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`
    const es = new EventSource(url)

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data)
        setLastEvent(event)

        // Invalidate relevant TanStack Query caches based on event type
        const prefix = event.event_type.split(".")[0]
        if (prefix === "flight") {
          queryClient.invalidateQueries({ queryKey: ["flights"] })
          queryClient.invalidateQueries({ queryKey: ["upcoming-arrivals"] })
        } else if (prefix === "turnaround") {
          queryClient.invalidateQueries({ queryKey: ["turnarounds"] })
        } else if (prefix === "crew") {
          queryClient.invalidateQueries({ queryKey: ["crew"] })
        } else if (prefix === "equipment") {
          queryClient.invalidateQueries({ queryKey: ["equipment"] })
        }
        queryClient.invalidateQueries({ queryKey: ["events"] })
        queryClient.invalidateQueries({ queryKey: ["alerts"] })
      } catch {
        // ignore non-JSON messages (e.g. keep-alive pings)
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Reconnect after 3 seconds
      setTimeout(connect, 3000)
    }

    eventSourceRef.current = es
  }, [queryClient])

  useEffect(() => {
    if (isAuthenticated) {
      connect()
    }
    return () => {
      eventSourceRef.current?.close()
    }
  }, [isAuthenticated, connect])

  return (
    <SSEContext.Provider value={{ lastEvent, connected }}>
      {children}
    </SSEContext.Provider>
  )
}

export function useSSE() {
  return useContext(SSEContext)
}
