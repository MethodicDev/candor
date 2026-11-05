import type { RunStatus } from "@/lib/status"

/* ---------------------------------------------------------------- who */

/** What an agent does: "assistant", "coder", "reviewer"… The app registers each role's glyph and hue (AgentRolesProvider). */
export type AgentRole = string

export type AgentIdentity = {
  id: string
  /** The displayed name, e.g. "Architect agent". Never derived from model output. */
  name: string
  role: AgentRole
  specialty?: string
}

export type MessageAuthor =
  | { role: "user"; name?: string }
  | { role: "agent"; agent: AgentIdentity }
  /** A person on the app's own team (support staff, a reviewer), not the user: shown by name, with their team. */
  | { role: "person"; name: string; team?: string }
  /** System lines are the app's own strings, never model text. */
  | { role: "system" }

/* ---------------------------------------------------------------- things in the user's system */

/**
 * What kind of thing an entity is: "record", "table", "workflow"… Any string;
 * the app registers each kind's icon and noun (see EntityKindsProvider), and
 * presets cover common systems (e.g. Salesforce).
 */
export type EntityKind = string

export type EntityRef = {
  kind: EntityKind
  /** The identifier, e.g. "Account.Region__c" or "orders.status". */
  name: string
  /** A friendlier label when there is one, e.g. "Region". */
  label?: string
  /** Where it lives, when more than one place is in scope, e.g. "Shop staging". */
  location?: string
}

/* ---------------------------------------------------------------- inline content */

export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  /** A value read from the environment (a count, a setting). Shown with its source on hover. */
  | { kind: "measured"; text: string; source?: string }
  /** @deprecated Renamed `measured`; still rendered the same way until 2.0. */
  | { kind: "orgData"; text: string; source?: string }
  /** The agent asserts this but has not verified it. */
  | { kind: "provisional"; nodes: InlineNode[]; reason?: string }
  | { kind: "citation"; sourceId: string }
  | { kind: "entity"; entity: EntityRef }
  /** An in-app route only; external links are never rendered from model output. */
  | { kind: "link"; text: string; to: string }

/* ---------------------------------------------------------------- evidence */

/** "document", "web", "query", "code", "data", "workflow", "knowledge", or the app's own; unknown kinds read as "Source". */
export type SourceKind = string

export type MessageSource = {
  id: string
  /** The [n] shown inline. Assigned by the service, so it is stable across renders. */
  marker: number
  kind: SourceKind
  label: string
  /** An inert excerpt shown in the popover. Text only. */
  snippet?: string
  /** Where it came from in a human sense: "Docs · Sales process v3", "Query on orders". */
  origin?: string
  provisional?: boolean
}

/* ---------------------------------------------------------------- reasoning */

type ReasoningBase = {
  id: string
  title: string
  body?: string
  streaming?: boolean
}

export type ReasoningEntry =
  | (ReasoningBase & { basis: "verified"; evidence: string })
  | (ReasoningBase & { basis: "believed" | "assumed"; assumption: string })

/* ---------------------------------------------------------------- tool calls */

export type ToolCall = {
  id: string
  /** The tool's name, for people who want it: "metadata.describe". */
  tool: string
  /** What it did, in plain words: "Read Account's fields". */
  title: string
  status: RunStatus
  /** Shown when expanded. Text only; long values scroll. */
  input?: string
  output?: string
  outputLanguage?: PayloadLanguage
  /** e.g. "1.2s". Absent while running; never estimated. */
  duration?: string
  /** Required when status is "failed": what went wrong, in a sentence. */
  error?: string
}

/* ---------------------------------------------------------------- blocks */

/** The block's language, e.g. "json", "sql", "python", "text". Shown as a label; never executed or highlighted as HTML. */
export type PayloadLanguage = string

export type MessageBlock =
  | { kind: "paragraph"; nodes: InlineNode[] }
  /**
   * Text exactly as someone typed it: line breaks and spacing kept, nothing parsed. For a person's own words, so
   * `*this*` stays `*this*` and a pasted list keeps its lines.
   */
  | { kind: "plain"; text: string }
  /** A heading inside a reply. Levels are relative to the message, 1 the largest; the page's own headings sit above. */
  | { kind: "heading"; level: 1 | 2 | 3; nodes: InlineNode[] }
  | { kind: "list"; ordered?: boolean; items: InlineNode[][] }
  | { kind: "payload"; language: PayloadLanguage; text: string; title?: string }
  | { kind: "tools"; calls: ToolCall[] }
  /** Something the agent could not do, and what is missing because of it. */
  | { kind: "degraded"; reason: string; missing?: string }
  /**
   * A typed card (a result table, a plan, an approval) rendered by the app's
   * card registry. `summary` is the service's plain-text version, used for copy
   * and whenever the card can't be shown.
   */
  | { kind: "card"; card: string; props: unknown; summary: string }

/* ---------------------------------------------------------------- message */

export type MessageStatus = "streaming" | "complete" | "interrupted" | "failed"

export type Message = {
  id: string
  author: MessageAuthor
  /** When it was sent. Absent when the source doesn't say; then no time is shown. */
  createdAt?: string
  status: MessageStatus
  blocks: MessageBlock[]
  reasoning?: ReasoningEntry[]
  /** How long the agent spent before answering, e.g. "6s". Only once known. */
  thoughtFor?: string
  sources?: MessageSource[]
  /** Shown under an agent's reply: model, cost. Only values the service measured. */
  attribution?: { model?: string; cost?: string }
}

/* ---------------------------------------------------------------- composer */

/** Where the next message's work lands. */
export type ComposerScope = { account?: string; environment: string; detail?: string; production: boolean }

export type MentionOption = {
  id: string
  /** The heading it sits under in the menu, e.g. "Files", "People". Groups appear in the order first used. */
  group: string
  entity?: EntityRef
  label: string
  description?: string
}

export type SlashCommand = {
  id: string
  name: string
  description: string
  /** e.g. "<object>" — shown after the name. */
  args?: string
}

export type Attachment = {
  id: string
  name: string
  size?: number
  /** 0–1 while uploading; absent when done. */
  progress?: number
  error?: string
}

export type PromptSuggestion = { id: string; text: string }
