import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import type { AgentIdentity, EntityRef, Message, MessageBlock, ReasoningEntry, ToolCall } from "@/lib/chat"
import { markdownBlocks, plainBlocks } from "@/lib/safe-markdown"

/*
 * Claude Agent SDK events → Candor messages.
 *
 * The server runs `query()` and streams every SDK message to the browser,
 * plus a few events of Candor's own: what the user sent, and permission
 * requests waiting on a person (see claude-agent-server). This folds that
 * event list into what Candor renders: one agent reply per user message,
 * however many model calls and tool calls the agent made to write it.
 *
 * As everywhere in Candor: model text is read as safe markdown, never HTML;
 * reasoning is believed, not verified; tool durations are left empty because
 * the SDK doesn't report them exactly; cost is the SDK's own estimate,
 * labelled as one. Subagent traffic stays inside the tool call that started it.
 */

/** Events of Candor's own, mixed into the SDK's stream. */
export type CandorAgentEvent =
  /** What the user sent. Added in the browser; the SDK doesn't echo a plain prompt back. */
  | { type: "candor_user"; id: string; text: string; references?: EntityRef[] }
  /** A tool call is waiting for a person to allow or deny it. */
  | {
      type: "candor_approval"
      id: string
      toolUseId: string
      tool: string
      input: unknown
      /** The SDK's own sentence for the request, e.g. "Claude wants to edit notes.md". */
      title?: string
      description?: string
      /** Why the SDK asked, when it says. */
      reason?: string
      blockedPath?: string
      /** Open on "Deny" and offer no one-key approve: the request grants more than it looks. */
      defaultToNo?: boolean
    }
  /** The request was answered, or the run ended before anyone did. */
  | { type: "candor_approval_closed"; id: string; approved: boolean; reason?: string }
  /** A typed card for the app's card registry, sent by your server (a tool's result as a diff, a plan, a table). */
  | { type: "candor_card"; card: string; props: unknown; summary: string }
  /** The run failed outside the SDK's own messages (the request, the stream, the server). */
  | { type: "candor_error"; message: string }

export type AgentEvent = SDKMessage | CandorAgentEvent

export type ClaudeApproval = Omit<Extract<CandorAgentEvent, { type: "candor_approval" }>, "type">

/** What the SDK measured for the session so far. Cost is its estimate, not a bill. */
export type ClaudeAgentUsage = { costUsd: number; inputTokens: number; outputTokens: number; turns: number }

export type FromClaudeAgentOptions = {
  /** Who the agent is. Candor always names the agent. */
  agent: AgentIdentity
  /** A request is open now: the last reply is still streaming and its approvals can be answered. */
  running?: boolean
  /** A plain-words title for a tool call: "Read notes.md". */
  toolTitle?: (tool: string, input: unknown) => string | undefined
}

export type ClaudeAgentState = {
  messages: Message[]
  /** Tool calls waiting on a person, oldest first. Empty once the request has ended. */
  approvals: ClaudeApproval[]
  /** Send it back with the next message to continue the same session (the SDK's `resume`). */
  sessionId?: string
  usage?: ClaudeAgentUsage
  /** A passing problem the agent is handling itself, such as a retried API call. */
  notice?: string
}

type Part = { kind: "text"; text: string } | { kind: "tool"; id: string } | { kind: "card"; card: string; props: unknown; summary: string }

type Reply = {
  id: string
  parts: Part[]
  reasoning: ReasoningEntry[]
  tools: Map<string, ToolCall>
  /** Text and thinking still streaming, by content block index. */
  live: Map<number, { kind: "text" | "thinking"; text: string }>
  result?: { ok: boolean; error?: string; cost?: number }
  failure?: string
  aborted?: boolean
}

/**
 * Turns Claude Agent SDK events into Candor messages, waiting approvals and usage.
 * Pure, so it can run on every render; useClaudeAgent calls it for you.
 */
export function fromClaudeAgentEvents(events: AgentEvent[], options: FromClaudeAgentOptions): ClaudeAgentState {
  const messages: Message[] = []
  const approvals = new Map<string, ClaudeApproval>()
  // Assigned inside `current`, which TypeScript can't follow, so it's typed by assertion.
  let reply = null as Reply | null
  let sessionId: string | undefined
  let model: string | undefined
  let usage: ClaudeAgentUsage | undefined
  let lastCost = 0
  let notice: string | undefined

  const current = (id: string): Reply => (reply ??= { id, parts: [], reasoning: [], tools: new Map(), live: new Map() })
  const close = (last: boolean) => {
    if (reply) messages.push(render(reply, { ...options, model, last }))
    reply = null
  }

  for (const e of events) {
    // Subagents report through their parent's tool call; the main thread is what the person reads.
    if ("parent_tool_use_id" in e && e.parent_tool_use_id) continue
    switch (e.type) {
      case "candor_user":
        close(false)
        messages.push({ id: e.id, author: { role: "user" }, status: "complete", blocks: plainBlocks(e.text) })
        notice = undefined
        break
      case "candor_approval": {
        const { type: _, ...approval } = e
        approvals.set(e.id, approval)
        const call = reply?.tools.get(e.toolUseId)
        if (call) call.status = "waiting"
        break
      }
      case "candor_approval_closed": {
        const approval = approvals.get(e.id)
        approvals.delete(e.id)
        const call = approval && reply?.tools.get(approval.toolUseId)
        if (call && call.status === "waiting") {
          call.status = e.approved ? "running" : "cancelled"
          if (!e.approved) call.error = e.reason ? `Denied: ${e.reason}` : "Denied."
        }
        break
      }
      case "candor_card":
        current(`card-${messages.length}`).parts.push({ kind: "card", card: e.card, props: e.props, summary: e.summary })
        break
      case "candor_error":
        // The first failure is the one that explains what happened.
        current(`error-${messages.length}`).failure ??= e.message
        break
      case "system":
        if (e.subtype === "init") {
          sessionId = e.session_id
          model = e.model
        } else if (e.subtype === "permission_denied") {
          const call = reply?.tools.get(e.tool_use_id)
          if (call) {
            call.status = "cancelled"
            call.error = `Not allowed: ${e.message}`
          }
        } else if (e.subtype === "api_retry") {
          notice = `Claude’s API didn’t answer${e.error_status ? ` (${e.error_status})` : ""}; trying again, attempt ${e.attempt} of ${e.max_retries}.`
        }
        break
      case "stream_event": {
        const r = current(e.uuid)
        const ev = e.event
        if (ev.type === "content_block_start" && (ev.content_block.type === "text" || ev.content_block.type === "thinking")) {
          r.live.set(ev.index, { kind: ev.content_block.type, text: "" })
        } else if (ev.type === "content_block_delta") {
          const live = r.live.get(ev.index)
          if (live && ev.delta.type === "text_delta") live.text += ev.delta.text
          else if (live && ev.delta.type === "thinking_delta") live.text += ev.delta.thinking
        }
        break
      }
      case "assistant": {
        const r = current(e.message.id)
        // A complete message replaces whatever was streaming before it.
        r.live.clear()
        notice = undefined
        if (e.aborted) r.aborted = true
        // An API error arrives as a synthetic message whose text is meant for a terminal user ("run /login"); say it plainly instead.
        if (e.error) {
          r.failure ??= assistantError(e.error)
          break
        }
        for (const block of e.message.content) addBlock(r, block, options)
        break
      }
      case "user": {
        if (!reply || typeof e.message.content === "string") break
        for (const block of e.message.content) {
          if (block.type !== "tool_result") continue
          const call = reply.tools.get(block.tool_use_id)
          if (!call || call.status === "cancelled") continue
          const output = resultText(block.content)
          call.output = output || undefined
          call.outputLanguage = "text"
          call.status = block.is_error ? "failed" : "succeeded"
          if (block.is_error) call.error = firstLine(output) ?? "The tool failed and didn’t say why."
        }
        break
      }
      case "result": {
        sessionId = e.session_id
        // The SDK's totals are cumulative for the session, so a reply's cost is the change since the last result.
        const cost = e.total_cost_usd >= lastCost ? e.total_cost_usd - lastCost : e.total_cost_usd
        lastCost = e.total_cost_usd
        const tokens = Object.values(e.modelUsage ?? {})
        usage = {
          costUsd: e.total_cost_usd,
          inputTokens: tokens.reduce((n, m) => n + m.inputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens, 0),
          outputTokens: tokens.reduce((n, m) => n + m.outputTokens, 0),
          turns: e.num_turns,
        }
        const r = current(e.uuid)
        r.result = e.subtype === "success" && !e.is_error ? { ok: true, cost } : { ok: false, cost, error: resultError(e) }
        notice = undefined
        break
      }
    }
  }
  close(true)

  return {
    messages,
    approvals: options.running ? [...approvals.values()] : [],
    sessionId,
    usage,
    notice: options.running ? notice : undefined,
  }
}

type ContentBlock = Extract<SDKMessage, { type: "assistant" }>["message"]["content"][number]

function addBlock(r: Reply, block: ContentBlock, options: FromClaudeAgentOptions) {
  if (block.type === "text") {
    if (block.text.trim()) r.parts.push({ kind: "text", text: block.text })
  } else if (block.type === "thinking") {
    // With the SDK's default display, thinking arrives empty; there's nothing to show then.
    if (block.thinking.trim()) r.reasoning.push(reasoningEntry(`${r.id}-r${r.reasoning.length}`, block.thinking, false))
  } else if (block.type === "tool_use" || block.type === "server_tool_use" || block.type === "mcp_tool_use") {
    const call: ToolCall = { id: block.id, tool: block.name, title: options.toolTitle?.(block.name, block.input) ?? block.name, status: "running", input: json(block.input) }
    r.tools.set(block.id, call)
    r.parts.push({ kind: "tool", id: block.id })
  } else if ("tool_use_id" in block) {
    // A server tool's result (web search, code execution) arrives in the assistant's own message.
    const call = r.tools.get(block.tool_use_id)
    if (call) {
      const content = (block as { content?: unknown }).content
      const failed = !!content && typeof content === "object" && "error_code" in content
      call.status = failed ? "failed" : "succeeded"
      call.output = content === undefined ? undefined : json(content)
      call.outputLanguage = "json"
      if (failed) call.error = `The tool failed: ${String((content as { error_code: unknown }).error_code)}.`
    }
  }
}

function render(r: Reply, o: FromClaudeAgentOptions & { model?: string; last: boolean }): Message {
  const open = o.last && o.running
  const parts = [...r.parts]
  const reasoning = [...r.reasoning]
  if (open) {
    for (const [index, live] of [...r.live].sort(([a], [b]) => a - b)) {
      if (!live.text.trim()) continue
      if (live.kind === "text") parts.push({ kind: "text", text: live.text })
      else reasoning.push(reasoningEntry(`${r.id}-live${index}`, live.text, true))
    }
  }

  const ended = !open && !r.result?.ok
  const blocks: MessageBlock[] = []
  let calls: ToolCall[] = []
  const flush = () => {
    if (calls.length) blocks.push({ kind: "tools", calls })
    calls = []
  }
  for (const p of parts) {
    if (p.kind === "tool") {
      const call = r.tools.get(p.id)!
      // A run that stopped early can't finish its tool calls.
      calls.push(ended && (call.status === "running" || call.status === "waiting") ? { ...call, status: "cancelled", error: call.error ?? "Stopped before it finished." } : { ...call })
      continue
    }
    flush()
    if (p.kind === "card") blocks.push({ kind: "card", card: p.card, props: p.props, summary: p.summary })
    else blocks.push(...markdownBlocks(p.text))
  }
  flush()

  const error = r.failure ?? r.result?.error
  if (error) blocks.push({ kind: "degraded", reason: error })

  return {
    id: r.id,
    author: { role: "agent", agent: o.agent },
    status: open ? "streaming" : r.result?.ok ? "complete" : error ? "failed" : "interrupted",
    blocks,
    reasoning: reasoning.length ? reasoning : undefined,
    attribution: r.result ? { model: o.model, cost: r.result.cost ? `$${r.result.cost.toFixed(r.result.cost < 0.01 ? 4 : 2)} (estimated)` : undefined } : undefined,
  }
}

const assistantErrors: Record<string, string> = {
  authentication_failed: "Claude couldn’t sign in. Check the server’s API key or login.",
  billing_error: "Claude’s account has a billing problem.",
  rate_limit: "Claude is rate-limited right now. Try again shortly.",
  overloaded: "Claude is overloaded right now. Try again shortly.",
  max_output_tokens: "The reply hit its length limit and was cut off.",
  model_not_found: "The configured model isn’t available.",
}
const assistantError = (code: string) => assistantErrors[code] ?? `Claude’s API returned an error (${code}).`

function resultError(e: Extract<SDKMessage, { type: "result" }>) {
  if (e.subtype === "error_max_turns") return "The agent reached its turn limit before finishing."
  if (e.subtype === "error_max_budget_usd") return "The agent reached its spending limit before finishing."
  if (e.subtype === "success") return "The agent finished with an error."
  return e.errors[0] ?? "The agent stopped because of an error."
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.map((c: { type?: string; text?: string }) => (c.type === "text" ? (c.text ?? "") : c.type ? `[${c.type}]` : "")).join("\n")
}

const firstLine = (text: string) => text.trim().split("\n")[0] || undefined

const json = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2))

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
