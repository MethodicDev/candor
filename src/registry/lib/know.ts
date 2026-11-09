/**
 * The data behind the agents' knowledge base and agent settings. Its rules: unknown never renders as definitive; no
 * figure without a basis; each source door has its own freshness. The model
 * layer's rule: only zero-data-retention endpoints, and only once an operator
 * has attested the vendor's contract.
 */
import type { AgentIdentity } from "@/registry/lib/chat"
import type { RunStatus } from "@/registry/lib/status"

/* ---------------------------------------------------------------- Know sources */

/** The ways knowledge gets in. */
/** How knowledge came in: read from the environment's configuration or data, shared as a file or link, answered by a person, or a vendor's release notes. */
export type KnowDoor = "config" | "data" | "file" | "link" | "answer" | "release-notes"

export type KnowSource = {
  id: string
  door: KnowDoor
  label: string
  /** Who added it, for files, links and answers. */
  addedBy?: string | undefined
  addedAt?: string | undefined
  /** When it was last read; null if never. */
  readAt: string | null
  /** How often it should be re-read, in hours, when it has a schedule. */
  everyHours?: number | undefined
  status: RunStatus
  /** "214 objects", "38 pages" — only when counted. */
  extent?: string | undefined
  /** Required when status is "failed". */
  error?: string | undefined
}

export type Confidence = "high" | "medium" | "low" | "unknown"

export type RaciRole = "R" | "A" | "C" | "I"

export type RaciAssignment = { role: RaciRole; who: string }

/* ---------------------------------------------------------------- retrieval */

export type RetrievedPassage = {
  id: string
  sourceId: string
  title: string
  excerpt: string
  /** Retrieval score 0–1; null when the retriever didn't score it (e.g. a pinned source). */
  score: number | null
  /** Whether the answer actually cites it. */
  cited: boolean
  /** Why it ranked where it did, when the retriever says. */
  why?: string | undefined
  readAt: string | null
}

/** A sentence in an answer and the passages it rests on. */
export type Claim = { id: string; text: string; evidence: string[] }

/* ---------------------------------------------------------------- models */

/** The four vendors Candor lists first, in this order. Any other vendor ("Meta", "Mistral", "Local") is listed after them, by the name you give. */
export type ModelVendor = "Anthropic" | "Google" | "OpenAI" | "xAI" | (string & {})

export type ModelOption = {
  id: string
  vendor: ModelVendor
  name: string
  /** One line on what it's good for. */
  note?: string | undefined
  /** Relative cost, 1 (cheapest) to 4. */
  cost: 1 | 2 | 3 | 4
  /** The vendor's zero-retention contract has been attested by an operator. */
  zdr: "attested" | "not-attested"
}

export type ReasoningEffort = "low" | "medium" | "high" | "max"

export type ModelSettingsValue = {
  model: string
  reasoning: ReasoningEffort
  /** Most tool-calling steps per run before it stops and asks. */
  stepLimit: number
  /** Used when the primary is unavailable; must also be attested. */
  fallback?: string | undefined
}

/* ---------------------------------------------------------------- tools */

export type ToolPermission = "always" | "ask" | "never"

export type ToolSetting = {
  id: string
  name: string
  description: string
  /** What the tool can do to the environment. */
  effect: "read" | "write" | "deploy" | "outside"
  permission: ToolPermission
  /** Permissions this tool can't take, with why. */
  locked?: Partial<Record<ToolPermission, string | undefined>> | undefined
}

/* ---------------------------------------------------------------- agents */

export type AgentConfig = {
  agent: AgentIdentity
  enabled: boolean
  status: RunStatus
  model: string
  /** Runs per day for the last 14 days, oldest first. */
  runs: { ok: number; failed: number }[]
  lastFailure?: string | undefined
}

export type Memory = {
  id: string
  text: string
  /** Who taught it: a person said so, or an agent inferred it. */
  from: { person: string } | { agent: AgentIdentity }
  createdAt: string
  scope: "account" | "environment"
  environmentId?: string | undefined
}

/** Whether agents use memory: on, paused (kept and not used for now), or off. */
export type MemoryModeValue = "on" | "paused" | "off"

export type Version = {
  id: string
  label: string
  state: "live" | "draft" | "past"
  at: string
  by: string
  note?: string | undefined
}

/* ---------------------------------------------------------------- context */

export type ContextSegment = {
  label: string
  tokens: number
  kind: "system" | "instructions" | "knowledge" | "thread" | "tools" | "files"
}
