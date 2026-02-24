import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import {
  LayoutDashboard,
  Plane,
  RefreshCw,
  Users,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  GanttChart,
  Wrench,
} from "lucide-react"
import { useState } from "react"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview", roles: null },
  { to: "/flights", icon: Plane, label: "Flights", roles: null },
  { to: "/turnarounds", icon: RefreshCw, label: "Turnarounds", roles: null },
  { to: "/stand-plan", icon: GanttChart, label: "Stand Plan", roles: null },
  { to: "/equipment", icon: Wrench, label: "Equipment", roles: null },
  { to: "/crew", icon: Users, label: "Crew", roles: ["admin", "ops_manager", "crew_supervisor", "viewer"] as string[] },
  { to: "/events", icon: ScrollText, label: "Events", roles: ["admin", "ops_manager", "crew_supervisor", "viewer"] as string[] },
  { to: "/settings", icon: Settings, label: "Settings", roles: ["admin"] as string[] },
]

export function Sidebar() {
  const { role } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const filteredItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  )

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <span className="text-sm font-bold text-foreground tracking-wide">
            SkyTurn
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
              )
            }
          >
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
