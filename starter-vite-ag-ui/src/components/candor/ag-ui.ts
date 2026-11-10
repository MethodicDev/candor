import { EventType, type ContentPart, type Event, type Interrupt, type JsonPatch, type Message as AgUiMessage, type TokenUsage } from "@ag-ui/core"
import type { AgentIdentity, EntityRef, Message, MessageBlock, ReasoningEntry, ToolCall } from "@/lib/candor/chat"
import type { RunStatus } from "@/lib/candor/status"
import { markdownBlocks, plainBlocks } from "@/lib/candor/safe-markdown"
import { formatElapsed } from "@/lib/candor/format-elapsed"

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
 * reported, and AG-UI reports no cost.
 *
 * How long the agent thought (a reply's `thoughtFor`) is measured from the
 * stream's own timestamps: each REASONING_START to its REASONING_END (or, from
 * an agent that sends no spans, each REASONING_MESSAGE_START to its
 * REASONING_MESSAGE_END), summed over the reply. AG-UI's `timestamp` is
 * optional and, in every SDK that sets it, milliseconds since the epoch. A
 * reply with any span missing a timestamp, still open, or ending before it
 * started gets no `thoughtFor`: Candor shows no time rather than a guess.
 * (Of the other adapters, neither the AI SDK's UI messages nor the Claude
 * Agent SDK's events carry a reasoning start time, so they never set it.) Subagent traffic stays out of the main
 * thread: the tool call that started a subagent reports for it.
 *
 * Agent state (STATE_SNAPSHOT, STATE_DELTA) and activities (ACTIVITY_SNAPSHOT,
 * ACTIVITY_DELTA) are kept as the agent sent them, as data. A patch that
 * doesn't apply changes nothing: the last good value stays, marked out of
 * date with the reason, until the next snapshot.
 */

/** Events of Candor's own, mixed into the AG-UI stream by useAgUi. */
export type CandorAgUiEvent =
  /** What the user sent. Added in the browser, with the same id as the AG-UI user message. */
  | { type: "candor_user"; id: string; text: string; references?: EntityRef[] | undefined }
  /** A person answered an interrupt; the next run resumes with it. */
  | { type: "candor_answer"; interruptId: string; approved: boolean; reason?: string | undefined }
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
  message?: string | undefined
  /** A sentence to show: the agent's message, or a plain one naming the tool. */
  title: string
  /** Set when the interrupt asks to run a tool call. */
  toolCallId?: string | undefined
  /** The tool's name, when the tool call is in the thread. */
  tool?: string | undefined
  /** The tool call's arguments, when they arrived and parse. */
  input?: unknown
  /** When the agent stops waiting (ISO 8601). */
  expiresAt?: string | undefined
  /** The shape the agent expects an answer in, when it says. */
  responseSchema?: Record<string, unknown> | undefined
}

/** Tokens the runs reported, summed. A count no run reported stays unknown. AG-UI reports no cost. */
export type AgUiUsage = { inputTokens?: number | undefined; outputTokens?: number | undefined }

export type FromAgUiOptions = {
  /** Who the agent is. Candor always names the agent. */
  agent: AgentIdentity
  /** A run is open now: the last reply is still streaming, and no interrupt can be answered yet. */
  running?: boolean | undefined
  /** A plain-words title for a tool call: "Read notes.md". `input` is undefined until the arguments arrive. */
  toolTitle?: ((tool: string, input: unknown) => string | undefined) | undefined
  /** The time to judge interrupt expiry by. Defaults to now. */
  now?: Date | undefined
  /** The state the first run started with; the first STATE_DELTA patches it. Defaults to `{}`, as AG-UI clients send. */
  initialState?: unknown
  /** Other agents the app knows, by id. An activity naming an agent id not here (or `agent`) isn't mapped to an agent entry. */
  agents?: AgentIdentity[] | undefined
  /**
   * How a measured thinking time reads, given milliseconds: "4.2s". useAgUi passes one that formats in the
   * LocaleProvider's locale; without it, English by the same rule: tenths under ten seconds, rounded down.
   */
  formatDuration?: ((ms: number) => string) | undefined
}

/**
 * A plan step read from an activity whose content has `steps: [{ title, status }]`.
 * The same shape as PlanStep, so it can go straight to a plan view.
 */
export type AgUiPlanStep = {
  id: string
  title: string
  status: RunStatus
  /** The step's own summary, when it sent one as text. */
  summary?: string | undefined
  /** Why it failed: the agent's words, or a plain sentence saying it didn't say. Set only when status is "failed". */
  failure?: string | undefined
}

/**
 * What an agent is doing, read from an activity whose content has `status`
 * (and optionally `doing`, `since`, `agentId`). The same shape as AgentActivityEntry.
 */
export type AgUiAgentActivityEntry = {
  /** The app's own identity for the agent, never one taken from the content. */
  agent: AgentIdentity
  doing?: string | undefined
  status: RunStatus
  since?: string | undefined
}

/** An activity the agent reported: structured progress that isn't part of a reply. */
export type AgUiActivity = {
  /** The activity message's id. */
  id: string
  /** The agent's own kind for it, e.g. "plan" or "search". An open string. */
  type: string
  /** Its content as the agent sent it, after any patches. Data, never markup. */
  content: Record<string, unknown>
  /** Set when an update to it couldn't be applied: the content is the last good one, and may be behind. */
  outOfDate?: string | undefined
  /** Its `steps` as plan steps, when every step has a title and a status Candor knows. */
  plan?: AgUiPlanStep[] | undefined
  /** Its `status`/`doing` as an agent entry, when the status is one Candor knows and the agent is one the app named. */
  agentActivity?: AgUiAgentActivityEntry | undefined
}

export type AgUiState = {
  messages: Message[]
  /** Interrupts waiting on a person, oldest first. Empty while a run is open; expired ones are left out. */
  approvals: AgUiApproval[]
  /** The thread the runs belong to. Send it back to continue the conversation. */
  threadId?: string | undefined
  usage?: AgUiUsage | undefined
  /** Something the person should know that isn't part of a reply, such as an expired request. */
  notice?: string | undefined
  /** The agent's shared state from STATE_SNAPSHOT and STATE_DELTA; undefined until the agent sends one. */
  state?: unknown
  /** Set when a state update couldn't be applied: `state` is the last good value and may be behind. Cleared by the next snapshot. */
  stateOutOfDate?: string | undefined
  /** The activities the agent reported, in the order they first arrived. */
  activities: AgUiActivity[]
}

type Part = { kind: "text"; id: string } | { kind: "tool"; id: string } | { kind: "card"; card: string; props: unknown; summary: string }

type Call = { id: string; tool: string; args: string; status: ToolCall["status"]; output?: string | undefined; error?: string | undefined; interruptId?: string | undefined }

type Reply = {
  id: string
  parts: Part[]
  texts: Map<string, string>
  /** Reasoning by message id, in arrival order. */
  reasoning: Map<string, string>
  tools: Map<string, Call>
  /** How the latest run on this reply ended; absent while it runs or if it never said. */
  outcome?: "success" | "interrupt" | "cancelled" | undefined
  model?: string | undefined
  failure?: string | undefined
  aborted?: boolean | undefined
  /** Thinking time, from the stream's timestamps. */
  thought: Thought
}

/**
 * Reasoning spans: open ones by id with their start (undefined when it had no timestamp), the milliseconds of the
 * closed ones, and whether any span couldn't be measured. `byMessage` marks spans opened by a reasoning message
 * because no REASONING_START came.
 */
type Thought = { open: Map<string, { start: number | undefined; byMessage: boolean }>; ms: number; spans: number; unmeasured: boolean }

type Turn = { user?: Message | undefined; reply?: Reply | undefined }

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
  const answers = new Map<string, { approved: boolean; reason?: string | undefined }>()
  // Subagent traffic, by what it opened. Continuations may omit the tag, so ownership is remembered.
  const subMessages = new Set<string>()
  const subTools = new Set<string>()
  const subParents = new Map<string, string>()
  /** Text messages from roles Candor doesn't show as the agent's (an echoed user, system or developer message). */
  const skipped = new Set<string>()
  let state: unknown
  let stateKnown = false
  let stateOutOfDate: string | undefined
  const activities = new Map<string, { type: string; content: Record<string, unknown>; outOfDate?: string | undefined }>()

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
      case EventType.REASONING_START:
        current(e.messageId).thought.open.set(e.messageId, { start: e.timestamp, byMessage: false })
        break
      case EventType.REASONING_END:
        endSpan(current(e.messageId).thought, e.messageId, e.timestamp, false)
        break
      case EventType.REASONING_MESSAGE_START: {
        const r = current(e.messageId)
        r.reasoning.set(e.messageId, "")
        // Inside a span, the span is what's timed; a message outside one is timed on its own.
        if (![...r.thought.open.values()].some((s) => !s.byMessage)) r.thought.open.set(e.messageId, { start: e.timestamp, byMessage: true })
        break
      }
      case EventType.REASONING_MESSAGE_END: {
        const r = current(e.messageId)
        if (r.thought.open.get(e.messageId)?.byMessage) endSpan(r.thought, e.messageId, e.timestamp, true)
        break
      }
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
        // Activities are part of the agent's record too; a snapshot's version of one replaces ours.
        for (const m of e.messages) {
          if (m.role === "activity" && !m.subagentRunId && isRecord(m.content)) activities.set(m.id, { type: m.activityType, content: m.content })
        }
        break
      case EventType.STATE_SNAPSHOT:
        state = e.snapshot
        stateKnown = true
        stateOutOfDate = undefined
        break
      case EventType.STATE_DELTA: {
        // After a patch that failed, later ones would patch the wrong base; wait for a snapshot.
        if (stateOutOfDate) break
        const patched = applyJsonPatch(stateKnown ? state : (options.initialState ?? {}), e.delta)
        if (patched.ok) {
          state = patched.value
          stateKnown = true
        } else stateOutOfDate = `An update to the agent’s state couldn’t be applied (${patched.reason}), so it may be out of date.`
        break
      }
      case EventType.ACTIVITY_SNAPSHOT: {
        const existing = activities.get(e.messageId)
        // `replace: false` asks to keep what's there; it isn't a merge.
        if (existing && e.replace === false) break
        if (isRecord(e.content)) activities.set(e.messageId, { type: e.activityType, content: e.content })
        break
      }
      case EventType.ACTIVITY_DELTA: {
        const existing = activities.get(e.messageId)
        if (!existing) {
          activities.set(e.messageId, { type: e.activityType, content: {}, outOfDate: "An update arrived for an activity the agent never described." })
          break
        }
        if (existing.outOfDate) break
        const patched = applyJsonPatch(existing.content, e.patch)
        if (patched.ok && isRecord(patched.value)) activities.set(e.messageId, { ...existing, content: patched.value })
        else {
          const reason = patched.ok ? "the content stopped being an object" : patched.reason
          activities.set(e.messageId, { ...existing, outOfDate: `An update to this activity couldn’t be applied (${reason}), so it may be out of date.` })
        }
        break
      }
      case EventType.CUSTOM: {
        if (e.name !== "candor_card") break
        const card = cardValue(e.value)
        if (card) current(`card-${turns.length}`).parts.push({ kind: "card", ...card })
        break
      }
      // Steps, raw events and encrypted reasoning are the app's or the agent's own business; nothing to show.
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
    state,
    stateOutOfDate,
    activities: [...activities].map(([id, a]) => activity(id, a, options)),
  }
}

/* ---------------------------------------------------------------- building a reply */

const emptyReply = (id: string): Reply => ({ id, parts: [], texts: new Map(), reasoning: new Map(), tools: new Map(), thought: { open: new Map(), ms: 0, spans: 0, unmeasured: false } })

/** Closes a reasoning span. One without both timestamps, or ending before it started, leaves the reply unmeasured. */
function endSpan(t: Thought, id: string, end: number | undefined, byMessage: boolean) {
  const span = t.open.get(id)
  t.open.delete(id)
  t.spans++
  if (!span || span.byMessage !== byMessage || span.start === undefined || end === undefined || !Number.isFinite(span.start) || !Number.isFinite(end) || end < span.start) {
    t.unmeasured = true
    return
  }
  t.ms += end - span.start
}

/** The reply's thinking time, only when every span in it was measured and none is still open. */
function thoughtFor(t: Thought, format: (ms: number) => string): string | undefined {
  if (!t.spans || t.unmeasured || t.open.size) return undefined
  return format(t.ms)
}

/** A measured time in English ("4.2s", "2m 5s"), the default when the app passes no `formatDuration`. */
const english = { tag: "en-US", number: (n: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat("en-US", options).format(n) }
const elapsedInEnglish = (ms: number) => formatElapsed(ms, english)

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
    thoughtFor: thoughtFor(r.thought, o.formatDuration ?? elapsedInEnglish),
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

/* ---------------------------------------------------------------- activities */

function activity(id: string, a: { type: string; content: Record<string, unknown>; outOfDate?: string | undefined }, o: FromAgUiOptions): AgUiActivity {
  const out: AgUiActivity = { id, type: a.type, content: a.content }
  if (a.outOfDate) out.outOfDate = a.outOfDate
  const plan = planSteps(id, a.content)
  if (plan) out.plan = plan
  const entry = agentEntry(a.content, o)
  if (entry) out.agentActivity = entry
  return out
}

/** Status words agents commonly send, as Candor's. Anything else is unknown and isn't mapped. */
const statusWords: Record<string, RunStatus> = {
  idle: "idle",
  queued: "queued",
  running: "running",
  waiting: "waiting",
  blocked: "blocked",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  skipped: "skipped",
  pending: "idle",
  in_progress: "running",
  "in-progress": "running",
  completed: "succeeded",
  complete: "succeeded",
  done: "succeeded",
  error: "failed",
  canceled: "cancelled",
}

const runStatus = (v: unknown): RunStatus | undefined =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(statusWords, v.trim().toLowerCase()) ? statusWords[v.trim().toLowerCase()] : undefined

const textOf = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined)

/** Plan steps, only when every step has a title and a known status: a plan with a step dropped would mislead. */
function planSteps(id: string, content: Record<string, unknown>): AgUiPlanStep[] | undefined {
  const steps = content.steps
  if (!Array.isArray(steps) || !steps.length) return undefined
  const out: AgUiPlanStep[] = []
  for (const [i, s] of steps.entries()) {
    if (!isRecord(s)) return undefined
    const title = textOf(s.title)
    const status = runStatus(s.status)
    if (!title || !status) return undefined
    const step: AgUiPlanStep = { id: textOf(s.id) ?? `${id}-${i}`, title, status }
    const summary = textOf(s.summary)
    if (summary) step.summary = summary
    if (status === "failed") step.failure = textOf(s.failure) ?? textOf(s.error) ?? "The agent didn’t say why this step failed."
    out.push(step)
  }
  return out
}

/** An agent entry, only for a known status and an agent the app named. */
function agentEntry(content: Record<string, unknown>, o: FromAgUiOptions): AgUiAgentActivityEntry | undefined {
  if (Array.isArray(content.steps)) return undefined
  const status = runStatus(content.status)
  if (!status) return undefined
  let agent: AgentIdentity | undefined = o.agent
  if (content.agentId !== undefined) {
    agent = typeof content.agentId === "string" ? [o.agent, ...(o.agents ?? [])].find((a) => a.id === content.agentId) : undefined
    if (!agent) return undefined
  }
  const entry: AgUiAgentActivityEntry = { agent, status }
  const doing = textOf(content.doing)
  if (doing) entry.doing = doing
  const since = textOf(content.since)
  if (since && !Number.isNaN(Date.parse(since))) entry.since = since
  return entry
}

/* ---------------------------------------------------------------- JSON Patch */

/** What applying a JSON Patch gave: the new document, or why it didn't apply (and then nothing changed). */
export type JsonPatchResult = { ok: true; value: unknown } | { ok: false; reason: string }

type Container = Record<string, unknown> | unknown[]

class PatchError extends Error {}

/**
 * Applies an RFC 6902 JSON Patch to a JSON document, all or nothing. Pure: the
 * document passed in is never changed, and the result shares nothing with the
 * patch's values. A patch that fails (a path that doesn't resolve, a failed
 * `test`, a malformed operation) returns `ok: false` with a plain reason.
 */
export function applyJsonPatch(document: unknown, patch: JsonPatch | unknown): JsonPatchResult {
  if (!Array.isArray(patch)) return { ok: false, reason: "the patch isn’t a list of operations" }
  let doc: unknown
  try {
    doc = clone(document)
    for (const [i, op] of patch.entries()) doc = applyOp(doc, op, i)
  } catch (err) {
    if (err instanceof PatchError) return { ok: false, reason: err.message }
    // A document or value nested too deep to copy: refused like any other patch that can't apply.
    if (err instanceof RangeError) return { ok: false, reason: "the document is nested too deeply to patch" }
    throw err
  }
  return { ok: true, value: doc }
}

function applyOp(doc: unknown, op: unknown, i: number): unknown {
  const fail = (why: string): never => {
    throw new PatchError(`operation ${i + 1}: ${why}`)
  }
  if (!isRecord(op) || typeof op.op !== "string" || typeof op.path !== "string") return fail("not an operation")
  const path = pointer(op.path, fail)
  const needsValue = op.op === "add" || op.op === "replace" || op.op === "test"
  if (needsValue && !("value" in op)) return fail(`${op.op} has no value`)
  switch (op.op) {
    case "add":
      return add(doc, path, clone(op.value), fail)
    case "remove":
      return remove(doc, path, fail).doc
    case "replace":
      return replace(doc, path, clone(op.value), fail)
    case "test":
      if (!equal(get(doc, path, fail), op.value)) fail(`test failed at "${op.path}"`)
      return doc
    case "move":
    case "copy": {
      if (typeof op.from !== "string") return fail(`${op.op} has no from`)
      const from = pointer(op.from, fail)
      if (op.op === "move") {
        if (op.from === op.path) {
          get(doc, from, fail)
          return doc
        }
        if (op.path.startsWith(`${op.from}/`)) fail("can’t move a value into itself")
        const taken = remove(doc, from, fail)
        return add(taken.doc, path, taken.value, fail)
      }
      return add(doc, path, clone(get(doc, from, fail)), fail)
    }
    default:
      return fail(`unknown op "${op.op}"`)
  }
}

/** RFC 6901: "" is the whole document; otherwise slash-separated tokens with ~1 for "/" and ~0 for "~". */
function pointer(p: string, fail: (why: string) => never): string[] {
  if (p === "") return []
  if (!p.startsWith("/")) fail(`"${p}" isn’t a JSON Pointer`)
  return p
    .slice(1)
    .split("/")
    .map((t) => {
      if (/~[^01]|~$/.test(t)) fail(`"${p}" has a bad escape`)
      return t.replace(/~1/g, "/").replace(/~0/g, "~")
    })
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** Sets an own property even for keys like "__proto__", so a patch can't reach a prototype. */
const put = (o: Record<string, unknown>, k: string, v: unknown) => Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true })

function arrayIndex(a: unknown[], token: string, adding: boolean, fail: (why: string) => never): number {
  if (adding && token === "-") return a.length
  if (!/^(0|[1-9]\d*)$/.test(token)) fail(`"${token}" isn’t an array index`)
  const n = Number(token)
  if (n > a.length || (!adding && n === a.length)) fail(`index ${n} is past the end of the list`)
  return n
}

/** The container holding the last token, and that token. */
function parentOf(doc: unknown, path: string[], fail: (why: string) => never): { container: Container; key: string } {
  const container = get(doc, path.slice(0, -1), fail)
  if (!isRecord(container) && !Array.isArray(container)) fail(`"/${path.slice(0, -1).join("/")}" isn’t an object or a list`)
  return { container: container as Container, key: path.at(-1)! }
}

function get(doc: unknown, path: string[], fail: (why: string) => never): unknown {
  let at = doc
  for (const token of path) {
    if (Array.isArray(at)) at = at[arrayIndex(at, token, false, fail)]
    else if (isRecord(at) && own(at, token)) at = at[token]
    else fail(`nothing at "/${path.join("/")}"`)
  }
  return at
}

function add(doc: unknown, path: string[], value: unknown, fail: (why: string) => never): unknown {
  if (!path.length) return value
  const { container, key } = parentOf(doc, path, fail)
  if (Array.isArray(container)) container.splice(arrayIndex(container, key, true, fail), 0, value)
  else put(container, key, value)
  return doc
}

function replace(doc: unknown, path: string[], value: unknown, fail: (why: string) => never): unknown {
  if (!path.length) return value
  get(doc, path, fail)
  const { container, key } = parentOf(doc, path, fail)
  if (Array.isArray(container)) container[arrayIndex(container, key, false, fail)] = value
  else put(container, key, value)
  return doc
}

function remove(doc: unknown, path: string[], fail: (why: string) => never): { doc: unknown; value: unknown } {
  if (!path.length) return fail("can’t remove the whole document")
  const { container, key } = parentOf(doc, path, fail)
  if (Array.isArray(container)) return { doc, value: container.splice(arrayIndex(container, key, false, fail), 1)[0] }
  if (!own(container, key)) fail(`nothing at "/${path.join("/")}"`)
  const value = container[key]
  delete container[key]
  return { doc, value }
}

function clone(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clone)
  if (isRecord(v)) {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v)) put(out, k, clone(v[k]))
    return out
  }
  return v
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i]))
  if (!isRecord(a) || !isRecord(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => own(b, k) && equal(a[k], b[k]))
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

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
