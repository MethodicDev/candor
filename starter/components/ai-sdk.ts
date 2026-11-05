import type { UIMessage } from "ai"
import type { AgentIdentity, Message, MessageBlock, MessageSource, MessageStatus, ReasoningEntry, ToolCall } from "@/lib/chat"
import type { RunStatus } from "@/lib/status"
import { inline, markdownBlocks, plainBlocks } from "@/lib/safe-markdown"

// Re-exported for apps that use them from here. (Imported first: shadcn rewrites import paths, not export-from paths.)
export { inline, markdownBlocks, plainBlocks }

/*
 * Vercel AI SDK (v7) UI messages → Candor messages.
 *
 * Candor never renders model output as HTML or markdown, so assistant text parts
 * are read as a small, safe subset of markdown (paragraphs, lists, fenced code,
 * `code`, **strong**, *em*) into typed blocks. Links become plain text with
 * the address in brackets: nothing from a model is ever a clickable link. A
 * user's text is kept exactly as typed.
 * Model reasoning is shown as believed, not verified, because nothing checked
 * it. Tool durations are left empty: the SDK doesn't measure them, and Candor
 * never estimates. `data-*` parts become cards for the app's card registry.
 */

export type FromAiSdkOptions = {
  /** Who the assistant is. Candor always names the agent. */
  agent: AgentIdentity
  /** The chat's status from useChat, so the last reply can show as streaming or failed. */
  chatStatus?: "submitted" | "streaming" | "ready" | "error"
  /** When a message was sent, if your metadata says. Without it, no time is shown. */
  createdAt?: (message: UIMessage) => string | undefined
  /** A plain-words title for a tool call: "Searched the docs for “region”". */
  toolTitle?: (tool: string, input: unknown) => string | undefined
  /** The text version of a data part, used when its card can't be shown. */
  summarize?: (name: string, data: unknown) => string
}

/** Convert a whole useChat message list. */
export function fromAiSdkMessages(messages: UIMessage[], options: FromAiSdkOptions): Message[] {
  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant")
  return messages.map((m, i) => fromAiSdkMessage(m, { ...options, last: i === lastAssistant }))
}

/** Convert one message. `last` marks the reply the chat status applies to. */
export function fromAiSdkMessage(message: UIMessage, options: FromAiSdkOptions & { last?: boolean }): Message {
  const blocks: MessageBlock[] = []
  const reasoning: ReasoningEntry[] = []
  const sources: MessageSource[] = []
  let tools: ToolCall[] | null = null
  const flushTools = () => {
    if (tools?.length) blocks.push({ kind: "tools", calls: tools })
    tools = null
  }

  for (const part of message.parts) {
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      tools ??= []
      tools.push(toolCall(part as ToolPart, options))
      continue
    }
    flushTools()
    switch (part.type) {
      case "text":
        // A person's own words are kept as typed; only the assistant's text is read as markdown.
        blocks.push(...(message.role === "user" ? plainBlocks(part.text) : markdownBlocks(part.text)))
        break
      case "reasoning":
        if (part.text.trim()) reasoning.push(reasoningEntry(part.id ?? `r${reasoning.length}`, part.text, part.state === "streaming"))
        break
      case "source-url":
        sources.push({ id: part.sourceId, marker: sources.length + 1, kind: "web", label: part.title ?? part.url, origin: host(part.url) })
        break
      case "source-document":
        sources.push({ id: part.sourceId, marker: sources.length + 1, kind: "document", label: part.title, origin: part.filename })
        break
      case "file":
        blocks.push({ kind: "paragraph", nodes: [{ kind: "text", text: "Attached " }, { kind: "code", text: part.filename ?? part.mediaType }] })
        break
      case "step-start":
      case "custom":
      case "reasoning-file":
        break
      default:
        if (part.type.startsWith("data-")) {
          const name = part.type.slice(5)
          const data = (part as { data: unknown }).data
          blocks.push({ kind: "card", card: name, props: data, summary: options.summarize?.(name, data) ?? `A “${name}” card.` })
        }
    }
  }
  flushTools()

  const author: Message["author"] = message.role === "assistant" ? { role: "agent", agent: options.agent } : message.role === "user" ? { role: "user" } : { role: "system" }

  return {
    id: message.id,
    author,
    createdAt: options.createdAt?.(message),
    status: statusOf(options),
    blocks,
    reasoning: reasoning.length ? reasoning : undefined,
    sources: sources.length ? sources : undefined,
  }
}

function statusOf({ last, chatStatus }: { last?: boolean; chatStatus?: FromAiSdkOptions["chatStatus"] }): MessageStatus {
  if (!last) return "complete"
  if (chatStatus === "submitted" || chatStatus === "streaming") return "streaming"
  if (chatStatus === "error") return "failed"
  return "complete"
}

/* ---------------------------------------------------------------- tools */

type ToolPart = {
  type: string
  toolName?: string
  toolCallId: string
  title?: string
  state: "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error" | "output-denied"
  input?: unknown
  output?: unknown
  errorText?: string
  preliminary?: boolean
  approval?: { approved?: boolean; reason?: string }
}

const toolStatus = (p: ToolPart): RunStatus => {
  switch (p.state) {
    case "input-streaming":
    case "input-available":
      return "running"
    case "approval-requested":
      return "waiting"
    case "approval-responded":
      return p.approval?.approved ? "running" : "cancelled"
    case "output-available":
      return p.preliminary ? "running" : "succeeded"
    case "output-error":
      return "failed"
    case "output-denied":
      return "cancelled"
  }
}

function toolCall(p: ToolPart, options: FromAiSdkOptions): ToolCall {
  const tool = p.toolName ?? p.type.replace(/^tool-/, "")
  const status = toolStatus(p)
  return {
    id: p.toolCallId,
    tool,
    title: options.toolTitle?.(tool, p.input) ?? p.title ?? tool,
    status,
    input: p.input === undefined ? undefined : json(p.input),
    output: p.output === undefined ? undefined : json(p.output),
    outputLanguage: p.output === undefined || typeof p.output === "string" ? "text" : "json",
    error: status === "failed" ? (p.errorText ?? "The tool failed and didn’t say why.") : status === "cancelled" && p.approval?.reason ? `Denied: ${p.approval.reason}` : undefined,
  }
}

const json = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2))

/* ---------------------------------------------------------------- reasoning */

function reasoningEntry(id: string, text: string, streaming: boolean): ReasoningEntry {
  const first = text.trim().split(/\n|(?<=[.!?])\s/)[0] ?? ""
  return {
    id,
    title: first.length > 90 ? `${first.slice(0, 87)}…` : first,
    body: text.trim(),
    streaming,
    basis: "believed",
    assumption: "The model’s own reasoning; nothing checked it.",
  }
}

const host = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}
