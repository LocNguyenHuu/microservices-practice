import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProtectedRoute } from "@/routes/ProtectedRoute"
import { LoginPage } from "@/routes/LoginPage"
import { OverviewPage } from "@/routes/OverviewPage"
import { FlightsPage } from "@/routes/FlightsPage"
import { TurnaroundsPage } from "@/routes/TurnaroundsPage"
import { CrewPage } from "@/routes/CrewPage"
import { EventsPage } from "@/routes/EventsPage"
import { SettingsPage } from "@/routes/SettingsPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
    },
  },
})

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="flights" element={<FlightsPage />} />
        <Route path="turnarounds" element={<TurnaroundsPage />} />
        <Route
          path="crew"
          element={
            <ProtectedRoute allowedRoles={["admin", "ops_manager", "crew_supervisor", "viewer"]}>
              <CrewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="events"
          element={
            <ProtectedRoute allowedRoles={["admin", "ops_manager", "crew_supervisor", "viewer"]}>
              <EventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
