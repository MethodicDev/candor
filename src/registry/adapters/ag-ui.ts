import { EventType, type ContentPart, type Event, type Interrupt, type Message as AgUiMessage, type TokenUsage } from "@ag-ui/core"
import type { AgentIdentity, EntityRef, Message, MessageBlock, ReasoningEntry, ToolCall } from "@/registry/lib/chat"
import { markdownBlocks, plainBlocks } from "@/registry/lib/safe-markdown"

/*
 * AG-UI events → Candor messages.
 *
 * AG-UI (the Agent–User Interaction protocol) is what LangGraph, Mastra,
 * CrewAI, Google ADK, Pydantic AI and others stream to a browser. This folds
 * that event list into what Candor renders: one agent reply per user message,
 * however many runs, model calls and tool calls the agent made to write it.
 * A run that stops to ask a person (an interrupt) becomes an approval; the
 * answer starts the next run with `resume`, and its events join the same reply.
 *
 * As everywhere in Candor: model text is read as safe markdown, never HTML;
 * reasoning is believed, not verified; tool durations are left empty because
 * the protocol doesn't report them; token counts are only what the runs
 * reported, and AG-UI reports no cost. Subagent traffic stays out of the main
 * thread: the tool call that started a subagent reports for it.
 */

/** Events of Candor's own, mixed into the AG-UI stream by useAgUi. */
export type CandorAgUiEvent =
  /** What the user sent. Added in the browser, with the same id as the AG-UI user message. */
  | { type: "candor_user"; id: string; text: string; references?: EntityRef[] }
  /** A person answered an interrupt; the next run resumes with it. */
  | { type: "candor_answer"; interruptId: string; approved: boolean; reason?: string }
  /** The run failed outside the protocol's own events (the request, the stream). */
  | { type: "candor_error"; message: string }

export type AgUiEvent = Event | CandorAgUiEvent

/** An interrupt waiting on a person. */
export type AgUiApproval = {
  /** The interrupt's id; answer it with `respond(id, …)`. */
  id: string
  /** The agent's machine-readable reason, e.g. "tool_approval". */
  reason: string
  /** The agent's own sentence for the request, when it sent one. */
  message?: string
  /** A sentence to show: the agent's message, or a plain one naming the tool. */
  title: string
  /** Set when the interrupt asks to run a tool call. */
  toolCallId?: string
  /** The tool's name, when the tool call is in the thread. */
  tool?: string
  /** The tool call's arguments, when they arrived and parse. */
  input?: unknown
  /** When the agent stops waiting (ISO 8601). */
  expiresAt?: string
  /** The shape the agent expects an answer in, when it says. */
  responseSchema?: Record<string, unknown>
}

/** Tokens the runs reported, summed. A count no run reported stays unknown. AG-UI reports no cost. */
export type AgUiUsage = { inputTokens?: number; outputTokens?: number }

export type FromAgUiOptions = {
  /** Who the agent is. Candor always names the agent. */
  agent: AgentIdentity
  /** A run is open now: the last reply is still streaming, and no interrupt can be answered yet. */
  running?: boolean
  /** A plain-words title for a tool call: "Read notes.md". `input` is undefined until the arguments arrive. */
  toolTitle?: (tool: string, input: unknown) => string | undefined
  /** The time to judge interrupt expiry by. Defaults to now. */
  now?: Date
}

export type AgUiState = {
  messages: Message[]
  /** Interrupts waiting on a person, oldest first. Empty while a run is open; expired ones are left out. */
  approvals: AgUiApproval[]
  /** The thread the runs belong to. Send it back to continue the conversation. */
  threadId?: string
  usage?: AgUiUsage
  /** Something the person should know that isn't part of a reply, such as an expired request. */
  notice?: string
}

type Part = { kind: "text"; id: string } | { kind: "tool"; id: string } | { kind: "card"; card: string; props: unknown; summary: string }

type Call = { id: string; tool: string; args: string; status: ToolCall["status"]; output?: string; error?: string; interruptId?: string }

type Reply = {
  id: string
  parts: Part[]
  texts: Map<string, string>
  /** Reasoning by message id, in arrival order. */
  reasoning: Map<string, string>
  tools: Map<string, Call>
  /** How the latest run on this reply ended; absent while it runs or if it never said. */
  outcome?: "success" | "interrupt" | "cancelled"
  model?: string
  failure?: string
  aborted?: boolean
}

type Turn = { user?: Message; reply?: Reply }

/**
 * Turns AG-UI events into Candor messages, waiting approvals and usage.
 * Pure (given `now`), so it can run on every render; useAgUi calls it for you.
 */
export function fromAgUiEvents(events: AgUiEvent[], options: FromAgUiOptions): AgUiState {
  const now = options.now ?? new Date()
  let turns: Turn[] = []
  let threadId: string | undefined
  let usage: AgUiUsage | undefined
  /** Interrupts from the latest run that ended on one, until the next run starts. */
  let open: Interrupt[] = []
  const answers = new Map<string, { approved: boolean; reason?: string }>()
  // Subagent traffic, by what it opened. Continuations may omit the tag, so ownership is remembered.
  const subMessages = new Set<string>()
  const subTools = new Set<string>()
  const subParents = new Map<string, string>()
  /** Text messages from roles Candor doesn't show as the agent's (an echoed user, system or developer message). */
  const skipped = new Set<string>()

  const current = (id: string): Reply => {
    let turn = turns.at(-1)
    if (!turn) turns.push((turn = {}))
    return (turn.reply ??= emptyReply(id))
  }
  const findCall = (id: string) => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const call = turns[i]!.reply?.tools.get(id)
      if (call) return call
    }
    return undefined
  }
  const addUsage = (entries: TokenUsage[] | undefined, r?: Reply) => {
    for (const u of entries ?? []) {
      usage ??= {}
      if (u.inputTokens !== undefined) usage.inputTokens = (usage.inputTokens ?? 0) + u.inputTokens
      if (u.outputTokens !== undefined) usage.outputTokens = (usage.outputTokens ?? 0) + u.outputTokens
      if (r && u.model) r.model ??= u.model
    }
  }

  for (const e of events) {
    if (e.type === EventType.SUBAGENT_ERROR) {
      // A subagent that failed is reported where it started: on its parent tool call.
      const parent = subParents.get(e.subagentRunId)
      const call = parent ? findCall(parent) : undefined
      if (call && call.status === "running") {
        call.status = "failed"
        call.error = `A subagent failed: ${(firstLine(e.message) ?? "it didn’t say why").replace(/[.!]$/, "")}.`
      }
      continue
    }
    if (isSubagent(e, subMessages, subTools, subParents)) continue
    switch (e.type) {
      case "candor_user":
        turns.push({ user: { id: e.id, author: { role: "user" }, status: "complete", blocks: plainBlocks(e.text) } })
        break
      case "candor_answer": {
        answers.set(e.interruptId, { approved: e.approved, reason: e.reason })
        const interrupt = open.find((i) => i.id === e.interruptId)
        const call = interrupt?.toolCallId ? findCall(interrupt.toolCallId) : undefined
        if (call && call.status === "waiting") {
          call.status = e.approved ? "running" : "cancelled"
          if (!e.approved) call.error = e.reason ? `Denied: ${e.reason}` : "Denied."
        }
        break
      }
      case "candor_error":
        // The first failure is the one that explains what happened.
        current(`error-${turns.length}`).failure ??= e.message
        break
      case EventType.RUN_STARTED: {
        threadId = e.threadId
        open = []
        const r = current(e.runId)
        r.outcome = undefined
        r.aborted = false
        break
      }
      case EventType.RUN_FINISHED: {
        threadId = e.threadId
        const r = current(e.runId)
        const outcome = e.outcome?.type ?? "success"
        r.outcome = outcome
        addUsage(e.usage, r)
        if (e.outcome?.type === "interrupt") {
          open = e.outcome.interrupts
          for (const i of open) {
            const call = i.toolCallId ? findCall(i.toolCallId) : undefined
            if (call && (call.status === "running" || call.status === "waiting")) {
              call.status = "waiting"
              call.interruptId = i.id
            }
          }
        }
        break
      }
      case EventType.RUN_ERROR: {
        const r = current(`error-${turns.length}`)
        addUsage(e.usage, r)
        // @ag-ui/client reports a stopped request as a RUN_ERROR with code "abort": that's the person stopping it, not a failure.
        if (e.code === "abort") r.aborted = true
        else r.failure ??= runError(e.message)
        break
      }
      case EventType.TEXT_MESSAGE_START:
        if (e.role && e.role !== "assistant") skipped.add(e.messageId)
        else addText(current(e.messageId), e.messageId, "")
        break
      case EventType.TEXT_MESSAGE_CONTENT:
        if (!skipped.has(e.messageId)) addText(current(e.messageId), e.messageId, e.delta)
        break
      case EventType.TEXT_MESSAGE_CHUNK: {
        if ((e.role && e.role !== "assistant") || (e.messageId && skipped.has(e.messageId))) {
          if (e.messageId) skipped.add(e.messageId)
          break
        }
        const r = current(e.messageId ?? `text-${turns.length}`)
        // A chunk without an id continues the last text message.
        const id = e.messageId ?? [...r.texts.keys()].at(-1) ?? `${r.id}-text`
        addText(r, id, e.delta ?? "")
        break
      }
      case EventType.TOOL_CALL_START:
        addTool(current(e.parentMessageId ?? e.toolCallId), e.toolCallId, e.toolCallName)
        break
      case EventType.TOOL_CALL_ARGS: {
        const call = findCall(e.toolCallId)
        if (call) call.args += e.delta
        break
      }
      case EventType.TOOL_CALL_CHUNK: {
        if (!e.toolCallId) break
        const call = findCall(e.toolCallId) ?? addTool(current(e.parentMessageId ?? e.toolCallId), e.toolCallId, e.toolCallName ?? "tool")
        call.args += e.delta ?? ""
        break
      }
      case EventType.TOOL_CALL_RESULT: {
        const call = findCall(e.toolCallId)
        // A denied or expired call stays as the person left it, whatever the agent reports afterwards.
        if (!call || call.status === "cancelled") break
        call.output = resultText(e.content) || undefined
        call.status = "succeeded"
        break
      }
      case EventType.REASONING_MESSAGE_START:
        current(e.messageId).reasoning.set(e.messageId, "")
        break
      case EventType.REASONING_MESSAGE_CONTENT: {
        const r = current(e.messageId)
        r.reasoning.set(e.messageId, (r.reasoning.get(e.messageId) ?? "") + e.delta)
        break
      }
      case EventType.REASONING_MESSAGE_CHUNK: {
        const r = current(e.messageId ?? `reasoning-${turns.length}`)
        const id = e.messageId ?? [...r.reasoning.keys()].at(-1) ?? `${r.id}-reasoning`
        r.reasoning.set(id, (r.reasoning.get(id) ?? "") + (e.delta ?? ""))
        break
      }
      case EventType.MESSAGES_SNAPSHOT:
        turns = applySnapshot(turns, e.messages)
        break
      case EventType.CUSTOM: {
        if (e.name !== "candor_card") break
        const card = cardValue(e.value)
        if (card) current(`card-${turns.length}`).parts.push({ kind: "card", ...card })
        break
      }
      // Steps, state, activity, raw events and encrypted reasoning are the app's or the agent's own business; nothing to show.
      default:
        break
    }
  }

  const lastReply = turns.findLastIndex((t) => t.reply)
  const isOpen = (i: Interrupt) => !answers.has(i.id) && !expired(i, now)
  const messages: Message[] = []
  turns.forEach((t, i) => {
    if (t.user) messages.push(t.user)
    if (t.reply) messages.push(render(t.reply, { ...options, now, last: i === lastReply, open: open.filter(isOpen) }))
  })

  const waiting = options.running ? [] : open.filter(isOpen)
  const lapsed = options.running ? [] : open.filter((i) => !answers.has(i.id) && expired(i, now))
  return {
    messages,
    approvals: waiting.map((i) => approval(i, findCall, options)),
    threadId,
    usage,
    notice: lapsed.length
      ? `${lapsed.length === 1 ? "A request" : `${lapsed.length} requests`} for your answer expired before anyone answered. Send a message to carry on; the agent will be told ${lapsed.length === 1 ? "it was" : "they were"} cancelled.`
      : undefined,
  }
}

/* ---------------------------------------------------------------- building a reply */

const emptyReply = (id: string): Reply => ({ id, parts: [], texts: new Map(), reasoning: new Map(), tools: new Map() })

function addText(r: Reply, id: string, delta: string) {
  if (!r.texts.has(id)) r.parts.push({ kind: "text", id })
  r.texts.set(id, (r.texts.get(id) ?? "") + delta)
}

function addTool(r: Reply, id: string, tool: string): Call {
  const existing = r.tools.get(id)
  if (existing) return existing
  const call: Call = { id, tool, args: "", status: "running" }
  r.tools.set(id, call)
  r.parts.push({ kind: "tool", id })
  return call
}

/** True for anything a subagent sent, tagged or continuing something a subagent opened. */
function isSubagent(e: AgUiEvent, messages: Set<string>, tools: Set<string>, parents: Map<string, string>): boolean {
  if (e.type === EventType.SUBAGENT_STARTED) {
    if (e.parentToolCallId) parents.set(e.subagentRunId, e.parentToolCallId)
    return true
  }
  if (e.type === EventType.SUBAGENT_FINISHED) return true
  const tagged = "subagentRunId" in e && !!e.subagentRunId
  const messageId = "messageId" in e ? e.messageId : undefined
  const toolCallId = "toolCallId" in e ? e.toolCallId : undefined
  const parent = "parentMessageId" in e ? e.parentMessageId : undefined
  if (tagged || (messageId && messages.has(messageId)) || (toolCallId && tools.has(toolCallId)) || (parent && messages.has(parent))) {
    if (messageId && e.type !== EventType.TOOL_CALL_RESULT) messages.add(messageId)
    if (toolCallId) tools.add(toolCallId)
    return true
  }
  return false
}

/**
 * A snapshot is the agent's own record of the thread, so it replaces what the
 * stream built: its user messages start turns, everything after each one is
 * that turn's reply. What only Candor knew about a reply (its cards, how its
 * run ended, a denial) is kept when the snapshot still has the same user message.
 */
function applySnapshot(previous: Turn[], snapshot: AgUiMessage[]): Turn[] {
  const byUser = new Map(previous.filter((t) => t.user).map((t) => [t.user!.id, t.reply]))
  const turns: Turn[] = previous[0] && !previous[0].user ? [{ reply: previous[0].reply }] : []
  const seen = new Set<string>()

  for (const m of snapshot) {
    if (m.subagentRunId) continue
    if (m.role === "user") {
      turns.push({ user: { id: m.id, author: { role: "user" }, status: "complete", blocks: plainBlocks(resultText(m.content)) }, reply: byUser.get(m.id) })
      continue
    }
    if (m.role !== "assistant" && m.role !== "tool" && m.role !== "reasoning") continue
    let t = turns.at(-1)
    if (!t) turns.push((t = {}))
    // A reply the stream never saw is history the agent already finished.
    const r = (t.reply ??= { ...emptyReply(m.id), outcome: "success" })
    if (m.role === "assistant") {
      if (m.content !== undefined) {
        if (!r.texts.has(m.id)) r.parts.push({ kind: "text", id: m.id })
        r.texts.set(m.id, m.content)
        seen.add(m.id)
      }
      for (const tc of m.toolCalls ?? []) {
        const call = addTool(r, tc.id, tc.function.name)
        call.tool = tc.function.name
        call.args = tc.function.arguments
        seen.add(tc.id)
      }
    } else if (m.role === "tool") {
      const call = r.tools.get(m.toolCallId)
      if (!call || call.status === "cancelled") continue
      const output = resultText(m.content)
      call.output = output || undefined
      call.status = m.error ? "failed" : "succeeded"
      call.error = m.error ? (firstLine(m.error) ?? "The tool failed and didn’t say why.") : undefined
    } else {
      r.reasoning.set(m.id, m.content)
      seen.add(m.id)
    }
  }

  // Drop what the snapshot no longer has; cards are Candor's own and stay.
  for (const { reply: r } of turns) {
    if (!r) continue
    r.parts = r.parts.filter((p) => p.kind === "card" || seen.has(p.id))
    for (const id of r.texts.keys()) if (!seen.has(id)) r.texts.delete(id)
    for (const id of r.reasoning.keys()) if (!seen.has(id)) r.reasoning.delete(id)
    for (const id of r.tools.keys()) if (!seen.has(id)) r.tools.delete(id)
  }
  return turns
}

/* ---------------------------------------------------------------- rendering */

function render(r: Reply, o: FromAgUiOptions & { now: Date; last: boolean; open: Interrupt[] }): Message {
  const live = o.last && !!o.running
  // A run that ended can't finish the tool calls it left running.
  const ended = !live
  const blocks: MessageBlock[] = []
  let calls: ToolCall[] = []
  const flush = () => {
    if (calls.length) blocks.push({ kind: "tools", calls })
    calls = []
  }
  for (const p of r.parts) {
    if (p.kind === "tool") {
      calls.push(toolCall(r.tools.get(p.id)!, o, ended))
      continue
    }
    flush()
    if (p.kind === "card") blocks.push({ kind: "card", card: p.card, props: p.props, summary: p.summary })
    else {
      const text = r.texts.get(p.id) ?? ""
      if (text.trim()) blocks.push(...markdownBlocks(text))
    }
  }
  flush()
  if (r.failure) blocks.push({ kind: "degraded", reason: r.failure })

  const reasoning = [...r.reasoning]
    .filter(([, text]) => text.trim())
    .map(([id, text], i, all) => reasoningEntry(`${r.id}-${id}`, text, live && i === all.length - 1))

  const finished = r.outcome === "success" || r.outcome === "interrupt"
  return {
    id: r.id,
    author: { role: "agent", agent: o.agent },
    status: live ? "streaming" : r.failure ? "failed" : finished && !r.aborted ? "complete" : "interrupted",
    blocks,
    reasoning: reasoning.length ? reasoning : undefined,
    attribution: r.model && finished ? { model: r.model } : undefined,
  }
}

function toolCall(c: Call, o: FromAgUiOptions & { now: Date; open: Interrupt[] }, ended: boolean): ToolCall {
  const input = parseArgs(c.args)
  const call: ToolCall = {
    id: c.id,
    tool: c.tool,
    title: o.toolTitle?.(c.tool, input) ?? c.tool,
    status: c.status,
    input: c.args ? (input === undefined ? c.args : json(input)) : undefined,
    output: c.output,
    outputLanguage: c.output === undefined ? undefined : "text",
    error: c.error,
  }
  if (c.status === "waiting") {
    const asking = o.open.some((i) => i.id === c.interruptId)
    if (!asking) return { ...call, status: "cancelled", error: "Nobody answered before the request closed." }
    return call
  }
  if (ended && c.status === "running") return { ...call, status: "cancelled", error: "The run ended before this tool returned a result." }
  return call
}

function approval(i: Interrupt, findCall: (id: string) => Call | undefined, o: FromAgUiOptions): AgUiApproval {
  const call = i.toolCallId ? findCall(i.toolCallId) : undefined
  const input = call ? parseArgs(call.args) : undefined
  const named = call ? (o.toolTitle?.(call.tool, input) ?? call.tool) : undefined
  return {
    id: i.id,
    reason: i.reason,
    message: i.message,
    title: i.message ?? (named ? `The agent wants to use ${named}.` : "The agent is waiting for your answer."),
    toolCallId: i.toolCallId,
    tool: call?.tool,
    input,
    expiresAt: i.expiresAt,
    responseSchema: i.responseSchema,
  }
}

/* ---------------------------------------------------------------- helpers */

const expired = (i: Interrupt, now: Date) => i.expiresAt !== undefined && new Date(i.expiresAt).getTime() <= now.getTime()

function runError(message: string) {
  const line = firstLine(message)
  return line ? `The agent stopped because of an error: ${line}` : "The agent stopped because of an error."
}

function cardValue(v: unknown): { card: string; props: unknown; summary: string } | undefined {
  if (!v || typeof v !== "object") return undefined
  const { card, props, summary } = v as { card?: unknown; props?: unknown; summary?: unknown }
  return typeof card === "string" && typeof summary === "string" ? { card, props, summary } : undefined
}

function resultText(content: string | ContentPart[] | undefined): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n")
}

function parseArgs(args: string): unknown {
  if (!args.trim()) return undefined
  try {
    return JSON.parse(args) as unknown
  } catch {
    // Still streaming, or not JSON: show it as it came.
    return undefined
  }
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
