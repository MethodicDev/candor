import type { RunStatus } from "@/registry/lib/status"

/**
 * The data a Candor thread renders. Plain, serialisable shapes: your
 * service produces them from its own model drivers, and an adapter can produce
 * them from any SDK. They follow the Candor design system's ChatMessage contract:
 *
 * - A message is a list of typed blocks, never markdown or HTML. Text from a
 *   model or from the user's system is always rendered as text.
 * - An agent message always carries the agent's full identity.
 * - A claim the agent has not verified is marked `provisional`, and reasoning
 *   says whether each step is verified, believed or assumed.
 */

/* ---------------------------------------------------------------- who */

/** What an agent does: "assistant", "coder", "reviewer"… The app registers each role's glyph and hue (AgentRolesProvider). */
export type AgentRole = string

export type AgentIdentity = {
  id: string
  /** The displayed name, e.g. "Architect agent". Never derived from model output. */
  name: string
  role: AgentRole
  specialty?: string | undefined
}

export type MessageAuthor =
  | { role: "user"; name?: string | undefined }
  | { role: "agent"; agent: AgentIdentity }
  /** A person on the app's own team (support staff, a reviewer), not the user: shown by name, with their team. */
  | { role: "person"; name: string; team?: string | undefined }
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
  /** The identifier, e.g. "orders.status" or "billing.invoice.due_date". */
  name: string
  /** A friendlier label when there is one, e.g. "Region". */
  label?: string | undefined
  /** Where it lives, when more than one place is in scope, e.g. "Shop staging". */
  location?: string | undefined
}

/* ---------------------------------------------------------------- inline content */

export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  /** A value read from the environment (a count, a setting). Shown with its source on hover. */
  | { kind: "measured"; text: string; source?: string | undefined }
  /** @deprecated Renamed `measured`; still rendered the same way until 2.0. */
  | { kind: "orgData"; text: string; source?: string | undefined }
  /** The agent asserts this but has not verified it. */
  | { kind: "provisional"; nodes: InlineNode[]; reason?: string | undefined }
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
  snippet?: string | undefined
  /** Where it came from in a human sense: "Docs · Sales process v3", "Query on orders". */
  origin?: string | undefined
  provisional?: boolean | undefined
}

/** A source a tool's result supports, without the id and [n] an adapter assigns. */
export type ToolSource = Omit<MessageSource, "id" | "marker"> & {
  /** Makes two results naming the same thing one source; defaults to `kind` and `label`. */
  key?: string | undefined
}

/* ---------------------------------------------------------------- reasoning */

type ReasoningBase = {
  id: string
  title: string
  body?: string | undefined
  streaming?: boolean | undefined
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
  input?: string | undefined
  output?: string | undefined
  outputLanguage?: PayloadLanguage | undefined
  /** e.g. "1.2s". Absent while running; never estimated. */
  duration?: string | undefined
  /** Required when status is "failed": what went wrong, in a sentence. */
  error?: string | undefined
  /**
   * Who let it run, when it needed a go-ahead: a person, or something automatic (a policy, a classifier, a rule).
   * `note` is why, in the source's words. Left out when it needed none or the source doesn't say.
   */
  approval?: {
    by: "person" | "automatic"
    note?: string | undefined
    /** The input as the agent proposed it, when a person edited it before it ran; `input` is then what ran. */
    originalInput?: string | undefined
  } | undefined
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
  | { kind: "list"; ordered?: boolean | undefined; items: InlineNode[][] }
  | { kind: "payload"; language: PayloadLanguage; text: string; title?: string | undefined }
  | { kind: "tools"; calls: ToolCall[] }
  /** Something the agent could not do, and what is missing because of it. */
  | { kind: "degraded"; reason: string; missing?: string | undefined }
  /**
   * A typed card (a result table, a plan, an approval) rendered by the app's
   * card registry. `summary` is the service's plain-text version, used for copy
   * and whenever the card can't be shown.
   */
  | { kind: "card"; card: string; props: unknown; summary: string }
  /** Files sent with the message, shown as tiles. New in 1.1: a `switch` over kinds needs a `default` branch. */
  | { kind: "attachments"; files: Attachment[] }

/* ---------------------------------------------------------------- message */

export type MessageStatus = "streaming" | "complete" | "interrupted" | "failed"

export type Message = {
  id: string
  author: MessageAuthor
  /** When it was sent. Absent when the source doesn't say; then no time is shown. */
  createdAt?: string | undefined
  status: MessageStatus
  blocks: MessageBlock[]
  reasoning?: ReasoningEntry[] | undefined
  /** How long the agent spent before answering, e.g. "6s". Only once known. */
  thoughtFor?: string | undefined
  /**
   * When the request for this reply went out, as the app measured it: an ISO time or milliseconds since the epoch.
   * While the reply streams and nothing of it has arrived, its working line counts up from here ("Thinking · 4.2s"),
   * and so does its reasoning's. Left out, no time is shown.
   */
  startedAt?: string | number | undefined
  sources?: MessageSource[] | undefined
  /** Shown under an agent's reply: model, cost. Only values the service measured. */
  attribution?: { model?: string | undefined; cost?: string | undefined } | undefined
}

/* ---------------------------------------------------------------- composer */

/** Where the next message's work lands. */
export type ComposerScope = { account?: string | undefined; environment: string; detail?: string | undefined; production: boolean }

export type MentionOption = {
  id: string
  /** The heading it sits under in the menu, e.g. "Files", "People". Groups appear in the order first used. */
  group: string
  entity?: EntityRef | undefined
  label: string
  description?: string | undefined
}

export type SlashCommand = {
  id: string
  name: string
  description: string
  /** e.g. "<object>" — shown after the name. */
  args?: string | undefined
}

export type Attachment = {
  id: string
  name: string
  /** In bytes. */
  size?: number | undefined
  /** e.g. "image/png", "application/pdf": picks the icon, and allows an image preview. */
  mediaType?: string | undefined
  /** A thumbnail your app serves (or a blob: URL), shown for images. Never a URL from model output. */
  previewUrl?: string | undefined
  /** 0–1 while uploading; absent when done. */
  progress?: number | undefined
  error?: string | undefined
}

export type PromptSuggestion = { id: string; text: string }
