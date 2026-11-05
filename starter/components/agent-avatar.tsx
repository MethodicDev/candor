"use client"

import * as React from "react"
import { Bot, ClipboardList, CodeXml, Compass, FlaskConical, PenTool, ScanSearch, SearchCheck, Workflow, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentIdentity } from "@/lib/chat"

export type AgentRoleInfo = { Icon: LucideIcon; noun: string; hue: string }

// Each role keeps one glyph and one chart hue everywhere it appears, so a
// person learns "the green flask is the tester" once.
export const baseAgentRoles: Record<string, AgentRoleInfo> = {
  assistant: { Icon: Bot, noun: "Assistant", hue: "var(--chart-1)" },
  orchestrator: { Icon: Workflow, noun: "Orchestrator", hue: "var(--chart-1)" },
  planner: { Icon: Compass, noun: "Planner", hue: "var(--chart-3)" },
  researcher: { Icon: ScanSearch, noun: "Researcher", hue: "var(--chart-2)" },
  analyst: { Icon: ClipboardList, noun: "Analyst", hue: "var(--chart-2)" },
  designer: { Icon: PenTool, noun: "Designer", hue: "var(--chart-5)" },
  coder: { Icon: CodeXml, noun: "Coder", hue: "var(--chart-1)" },
  reviewer: { Icon: SearchCheck, noun: "Reviewer", hue: "var(--chart-3)" },
  tester: { Icon: FlaskConical, noun: "Tester", hue: "var(--chart-4)" },
}

const unknownRole: AgentRoleInfo = { Icon: Bot, noun: "Assistant", hue: "var(--chart-1)" }

const RolesContext = React.createContext<Record<string, AgentRoleInfo>>(baseAgentRoles)

/** The app's agent roles; nested providers add to (and can override) the ones above. */
function AgentRolesProvider({
  roles,
  children,
}: {
  /** Role ids mapped to an icon, a noun and a hue. */
  roles: Record<string, AgentRoleInfo>
  children: React.ReactNode
}) {
  const parent = React.useContext(RolesContext)
  const value = React.useMemo(() => ({ ...parent, ...roles }), [parent, roles])
  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>
}

/** Look up a role's glyph, noun and hue; unknown roles read as "Assistant". */
function useAgentRoles() {
  const roles = React.useContext(RolesContext)
  return React.useCallback((role: string) => roles[role] ?? unknownRole, [roles])
}

/** An agent's mark: its role glyph on a tile tinted with the role's hue. */
function AgentAvatar({
  agent,
  size = "md",
  className,
}: {
  /** Who the agent is: id, display name and role. */
  agent: AgentIdentity
  /** md for message headers, sm for lists and chips. */
  size?: "sm" | "md"
  className?: string
}) {
  const { Icon, hue } = useAgentRoles()(agent.role)
  return (
    <span
      data-slot="agent-avatar"
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        size === "md" ? "size-7 [&_svg]:size-3.5" : "size-5 rounded-sm [&_svg]:size-3",
        className
      )}
      style={{ color: hue, background: `color-mix(in oklab, ${hue} 14%, var(--card))`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hue} 22%, transparent)` }}
    >
      <Icon strokeWidth={2.25} />
    </span>
  )
}

/** Avatar plus name, with the role spelled out for screen readers. */
function AgentBadge({
  agent,
  size = "md",
  className,
}: {
  /** Who the agent is: id, display name and role. */
  agent: AgentIdentity
  /** md for message headers, sm for lists and chips. */
  size?: "sm" | "md"
  className?: string
}) {
  const { noun } = useAgentRoles()(agent.role)
  return (
    <span data-slot="agent-badge" className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <AgentAvatar agent={agent} size={size} />
      <span className={cn("truncate font-medium", size === "sm" ? "text-xs" : "text-sm")}>{agent.name}</span>
      <span className="sr-only">, {noun} agent</span>
    </span>
  )
}

export { AgentAvatar, AgentBadge, AgentRolesProvider, useAgentRoles }
