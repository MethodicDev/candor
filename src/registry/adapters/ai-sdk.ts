import type { UIMessage } from "ai"
import type { AgentIdentity, MessageData, MessageBlock, MessageSource, MessageStatus, ReasoningEntry, ToolCallData, ToolSource } from "@/registry/foundation/chat"
import type { RunStatus } from "@/registry/foundation/status"
import { inline, markdownBlocks, plainBlocks } from "@/registry/foundation/safe-markdown"

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
 * never estimates. How long the model thought (`thoughtFor`) is left empty too:
 * the SDK's reasoning parts carry no timestamps, only text and a state. Of
 * Candor's adapters, only AG-UI's sets it, from its REASONING_START and
 * REASONING_END timestamps. `data-*` parts become cards for the app's card registry.
 *
 * Durable runs (AI SDK 7's WorkflowAgent) stream the same UI messages: a tool
 * that needs approval waits as `approval-requested` for as long as the workflow
 * does, an approval made automatically is marked as one, and a reload re-attaches
 * through the app's transport (WorkflowChatTransport), not through this adapter.
 */

export type FromAiSdkOptions = {
  /** Who the assistant is. Candor always names the agent. */
  agent: AgentIdentity
  /** The chat's status from useChat, so the last reply can show as streaming or failed. */
  chatStatus?: "submitted" | "streaming" | "ready" | "error" | undefined
  /** When a message was sent, if your metadata says. Without it, no time is shown. */
  createdAt?: ((message: UIMessage) => string | undefined) | undefined
  /** A plain-words title for a tool call: "Searched the docs for “region”". */
  toolTitle?: ((tool: string, input: unknown) => string | undefined) | undefined
  /** The text version of a data part, used when its card can't be shown. */
  summarize?: ((name: string, data: unknown) => string) | undefined
  /**
   * The sources a tool's result supports, added to the reply's sources after the SDK's own source parts:
   * `(tool, input, output) => [{ kind: "document", label: "Refund policy v2" }]`. Read only from the tool's output.
   */
  sourcesFrom?: ((tool: string, input: unknown, output: unknown) => ToolSource[] | undefined) | undefined
}

/** Convert a whole useChat message list. */
export function fromAiSdkMessages(messages: UIMessage[], options: FromAiSdkOptions): MessageData[] {
  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant")
  return messages.map((m, i) => fromAiSdkMessage(m, { ...options, last: i === lastAssistant }))
}

/** Convert one message. `last` marks the reply the chat status applies to. */
export function fromAiSdkMessage(message: UIMessage, options: FromAiSdkOptions & { last?: boolean | undefined }): MessageData {
  const blocks: MessageBlock[] = []
  const reasoning: ReasoningEntry[] = []
  const sources: MessageSource[] = []
  const toolSources: Omit<ToolSource, "key">[] = []
  const toolSourceKeys = new Set<string>()
  let tools: ToolCallData[] | null = null
  const flushTools = () => {
    if (tools?.length) blocks.push({ kind: "tools", calls: tools })
    tools = null
  }

  for (const part of message.parts) {
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      tools ??= []
      const call = toolCall(part as ToolPart, options)
      tools.push(call)
      const p = part as ToolPart
      if (call.status === "succeeded" && options.sourcesFrom) {
        for (const { key, ...found } of options.sourcesFrom(call.tool, p.input, p.output) ?? []) {
          const k = key ?? `${found.kind}:${found.label}`
          if (toolSourceKeys.has(k)) continue
          toolSourceKeys.add(k)
          toolSources.push(found)
        }
      }
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
  for (const [i, found] of toolSources.entries()) sources.push({ ...found, id: `${message.id}-tool-s${i + 1}`, marker: sources.length + 1 })

  const author: MessageData["author"] = message.role === "assistant" ? { role: "agent", agent: options.agent } : message.role === "user" ? { role: "user" } : { role: "system" }

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

function statusOf({ last, chatStatus }: { last?: boolean | undefined; chatStatus?: FromAiSdkOptions["chatStatus"] | undefined }): MessageStatus {
  if (!last) return "complete"
  if (chatStatus === "submitted" || chatStatus === "streaming") return "streaming"
  if (chatStatus === "error") return "failed"
  return "complete"
}

/* ---------------------------------------------------------------- tools */

type ToolPart = {
  type: string
  toolName?: string | undefined
  toolCallId: string
  title?: string | undefined
  state: "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error" | "output-denied"
  input?: unknown
  output?: unknown
  errorText?: string | undefined
  preliminary?: boolean | undefined
  approval?: { approved?: boolean | undefined; reason?: string | undefined; requestReason?: string | undefined; isAutomatic?: boolean | undefined } | undefined
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

function toolCall(p: ToolPart, options: FromAiSdkOptions): ToolCallData {
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
    // Only a decided approval says who decided; one still waiting is the person's to make.
    approval: p.approval?.approved === true ? { by: p.approval.isAutomatic ? "automatic" : "person", note: p.approval.reason || undefined } : undefined,
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
