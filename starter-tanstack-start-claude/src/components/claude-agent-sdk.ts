import type { PermissionResult, PermissionUpdate, SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import type { AgentIdentity, EntityRef, InlineNode, Message, MessageBlock, MessageSource, ReasoningEntry, ToolCall, ToolSource } from "@/lib/chat"
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
 * labelled as one. How long Claude thought (`thoughtFor`) is left empty: the
 * SDK stamps when a content block finished, never when thinking started, so
 * there is no span to measure. Of Candor's adapters, only AG-UI's sets it. Subagent traffic stays inside the tool call that started it.
 *
 * The fold is pure, so a stored run replays exactly: keep the events (the
 * server's `onEvent`, or a run store) and fold them again after a reload.
 */

/**
 * How the agent's tool calls are approved, as the SDK names it: "default" (ask for anything not allowed already),
 * "acceptEdits", "plan", "auto" (a classifier decides), "dontAsk" (deny what isn't allowed already) and
 * "bypassPermissions". Kept open: a newer SDK's mode passes through as its name.
 */
export type ClaudePermissionMode = "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions" | (string & {})

/** One of the agent's questions (the SDK's AskUserQuestion), shaped for ClarifyingQuestions. Options' ids are their labels. */
export type ClaudeQuestion = {
  /** The question's text, which is also how its answer is keyed back to the SDK. */
  id: string
  kind: "choice"
  prompt: string
  /** The SDK's short header ("Library", "Approach"). */
  tag?: string | undefined
  options: { id: string; label: string; detail?: string | undefined }[]
  multiple: boolean
  /** The SDK always lets the person answer in their own words. */
  other: true
}

/** A person's answer to one ClaudeQuestion: the chosen labels, their own words, or both. Same shape as ClarifyingAnswer. */
export type ClaudeQuestionAnswer = { questionId: string; choice?: string[] | undefined; text?: string | undefined }

/** How a person answered a permission request. */
export type ClaudeApprovalAnswer = {
  approved: boolean
  /** Why it was denied, sent to the agent. */
  reason?: string | undefined
  /** The tool's input as the person edited it before allowing it. The tool runs with exactly this. */
  updatedInput?: Record<string, unknown> | undefined
  /** Answers to the agent's questions, when the request is one (`questions`). */
  answers?: ClaudeQuestionAnswer[] | undefined
  /** Which of the request's `suggestions` the person chose to keep ("always allow"), by index. None unless they choose. */
  alwaysAllow?: number[] | undefined
}

/** Events of Candor's own, mixed into the SDK's stream. */
export type CandorAgentEvent =
  /** What the user sent. Added in the browser; the SDK doesn't echo a plain prompt back. */
  | { type: "candor_user"; id: string; text: string; references?: EntityRef[] | undefined }
  /** A tool call is waiting for a person to allow or deny it. */
  | {
      type: "candor_approval"
      id: string
      toolUseId: string
      tool: string
      input: unknown
      /** The SDK's own sentence for the request, e.g. "Claude wants to edit notes.md". */
      title?: string | undefined
      description?: string | undefined
      /** Why the SDK asked, when it says. */
      reason?: string | undefined
      blockedPath?: string | undefined
      /** Open on "Deny" and offer no one-key approve: the request grants more than it looks. */
      defaultToNo?: boolean | undefined
      /** A short name for the action: "Edit file". */
      displayName?: string | undefined
      /**
       * Rules the SDK suggests so this isn't asked again ("always allow"), as the SDK sends them. Offer them as a
       * choice the person makes; never keep one unless they pick it.
       */
      suggestions?: PermissionUpdate[] | undefined
      /** Offer no "always allow" for this request: its rule would grant more than this one action. */
      noAlwaysAllow?: boolean | undefined
      /** The permission mode the run was in when it asked. */
      mode?: ClaudePermissionMode | undefined
      /** The agent's questions, when the tool is AskUserQuestion: answer them instead of allowing a tool. */
      questions?: ClaudeQuestion[] | undefined
      /** Set when a subagent asked, with its id. */
      agentId?: string | undefined
      /** For an MCP tool: its server's name and where that server was configured, as the SDK reports them. */
      mcpServer?: { name: string; source: string } | undefined
      /** Whether the server lets a person edit this call's input before allowing it. False means no; left out means yes (1.5.0). */
      editable?: boolean | undefined
    }
  /** The request was answered, or the run ended before anyone did. */
  | {
      type: "candor_approval_closed"
      id: string
      approved: boolean
      reason?: string | undefined
      /** The person changed the input before allowing it. */
      edited?: boolean | undefined
      /** The input the tool ran with, when the person edited it. */
      input?: unknown
      /** Nobody answered in time (the server's `approvalTimeoutMs`). */
      expired?: boolean | undefined
      /** How many "always allow" rules the person kept. */
      kept?: number | undefined
    }
  /** The run's permission mode changed, by the app (`setPermissionMode`). The SDK's own mode reports also count. */
  | { type: "candor_mode"; mode: ClaudePermissionMode }
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
  running?: boolean | undefined
  /** A plain-words title for a tool call: "Read notes.md". */
  toolTitle?: ((tool: string, input: unknown) => string | undefined) | undefined
  /**
   * The sources a tool's result supports, for the reply's source list: `(tool, input, output) => [{ kind: "document",
   * label: "Pricing policy v3" }]`. Read only from what the tool returned, never from numbers in the agent's text.
   * Claude's own citations and web search results are read without it.
   */
  sourcesFrom?: ((tool: string, input: unknown, output: string) => ToolSource[] | undefined) | undefined
  /**
   * The words for lines the adapter adds to the thread itself, as system messages: when the SDK summarised earlier
   * messages to make room (`compacted`, given how it was started), and when the conversation was cleared (`cleared`).
   * Defaults are in English; pass your own for other languages.
   */
  eventText?: { compacted?: ((trigger: "manual" | "auto") => string) | undefined; cleared?: string | undefined } | undefined
}

/** A memory the SDK recalled for a reply: the file (or URL) it came from, and whose memory it is. */
export type ClaudeRecalledMemory = { path: string; scope: "personal" | "team" | "organization"; content?: string | undefined }

export type ClaudeAgentState = {
  messages: Message[]
  /** Tool calls waiting on a person, oldest first. Empty once the request has ended. */
  approvals: ClaudeApproval[]
  /** Send it back with the next message to continue the same session (the SDK's `resume`). */
  sessionId?: string | undefined
  usage?: ClaudeAgentUsage | undefined
  /** A passing problem the agent is handling itself, such as a retried API call. */
  notice?: string | undefined
  /** The permission mode last reported, by the SDK or the app. Absent until one is. */
  permissionMode?: ClaudePermissionMode | undefined
  /** Memories the SDK recalled for each reply, by the reply's message id, for a `MemoryUsed` line under it. Only replies that recalled any. */
  recalled?: Record<string, ClaudeRecalledMemory[]> | undefined
}

const compactedText = (trigger: "manual" | "auto") =>
  trigger === "auto"
    ? "Earlier messages were summarised to make room. The agent works from that summary now; the messages above are unchanged."
    : "Earlier messages were summarised, as asked. The agent works from that summary now; the messages above are unchanged."
const clearedText = "The conversation was cleared. The agent doesn’t see the messages above."

type Part = { kind: "text"; text: string; cites?: string[] | undefined } | { kind: "tool"; id: string } | { kind: "card"; card: string; props: unknown; summary: string }

type Reply = {
  id: string
  parts: Part[]
  reasoning: ReasoningEntry[]
  tools: Map<string, ToolCall>
  /** Text and thinking still streaming, by content block index. */
  live: Map<number, { kind: "text" | "thinking"; text: string }>
  result?: { ok: boolean; error?: string | undefined; cost?: number | undefined } | undefined
  failure?: string | undefined
  aborted?: boolean | undefined
  /** Sources by key, in the order first cited or returned. */
  sources: Map<string, MessageSource>
  /** Each tool call's input as the SDK sent it, for `sourcesFrom`. */
  inputs: Map<string, unknown>
  /** Memories recalled for this reply. */
  memories: ClaudeRecalledMemory[]
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
  let permissionMode: ClaudePermissionMode | undefined
  const recalled: Record<string, ClaudeRecalledMemory[]> = {}
  // Memories recalled before the reply they're for has started.
  let recalling: ClaudeRecalledMemory[] = []

  const current = (id: string): Reply => {
    if (!reply) {
      reply = { id, parts: [], reasoning: [], tools: new Map(), live: new Map(), sources: new Map(), inputs: new Map(), memories: recalling }
      recalling = []
    }
    return reply
  }
  // Lines that arrived while a reply was still going: shown after it, so one turn stays one reply.
  let afterReply: Message[] = []
  const close = (last: boolean) => {
    if (reply) {
      messages.push(render(reply, { ...options, model, last }))
      if (reply.memories.length) recalled[reply.id] = reply.memories
    }
    reply = null
    messages.push(...afterReply)
    afterReply = []
  }
  // A line the adapter adds between replies: the app's own words, drawn like any system message.
  const systemLine = (id: string, text: string) => {
    const line: Message = { id, author: { role: "system" }, status: "complete", blocks: plainBlocks(text) }
    if (reply) afterReply.push(line)
    else messages.push(line)
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
          if (e.expired) call.error = `Expired: ${e.reason ?? "nobody answered in time."}`
          else if (!e.approved) call.error = e.reason ? `Denied: ${e.reason}` : "Denied."
          // What ran is what the person allowed, so the card shows it, with what the agent proposed kept beside it.
          if (e.approved && e.input !== undefined) {
            call.approval = { by: "person", originalInput: call.input }
            call.input = json(e.input)
            reply!.inputs.set(call.id, e.input)
          } else if (e.approved) call.approval = { by: "person" }
        }
        break
      }
      case "candor_mode":
        permissionMode = e.mode
        break
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
          if (e.permissionMode) permissionMode = e.permissionMode
        } else if (e.subtype === "status") {
          if (e.permissionMode) permissionMode = e.permissionMode
        } else if (e.subtype === "permission_denied") {
          const call = reply?.tools.get(e.tool_use_id)
          if (call) {
            call.status = "cancelled"
            call.error = `Not allowed: ${e.message}`
          }
        } else if (e.subtype === "api_retry") {
          notice = `Claude’s API didn’t answer${e.error_status ? ` (${e.error_status})` : ""}; trying again, attempt ${e.attempt} of ${e.max_retries}.`
        } else if (e.subtype === "compact_boundary") {
          // Without this line the person can't tell the agent no longer has the earlier messages word for word.
          const trigger = e.compact_metadata.trigger
          systemLine(`compact-${e.uuid}`, options.eventText?.compacted?.(trigger) ?? compactedText(trigger))
        } else if (e.subtype === "memory_recall") {
          const found = e.memories.map((m) => ({ path: m.path, scope: m.scope, ...(m.content !== undefined && { content: m.content }) }))
          if (reply) reply.memories.push(...found)
          else recalling.push(...found)
        }
        break
      case "conversation_reset":
        systemLine(`reset-${e.uuid}`, options.eventText?.cleared ?? clearedText)
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
          else if (options.sourcesFrom) for (const found of options.sourcesFrom(call.tool, reply.inputs.get(call.id), output) ?? []) addSource(reply, found)
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
    permissionMode,
    recalled,
  }
}

type ContentBlock = Extract<SDKMessage, { type: "assistant" }>["message"]["content"][number]

/** Adds a source once (by key) and returns its id. Markers count up in the order sources first appear. */
function addSource(r: Reply, source: ToolSource): string {
  const { key: own, ...rest } = source
  const key = own ?? `${rest.kind}:${rest.label}`
  const known = r.sources.get(key)
  if (known) return known.id
  const id = `${r.id}-s${r.sources.size + 1}`
  r.sources.set(key, { ...rest, id, marker: r.sources.size + 1 })
  return id
}

type Citation = { type: string; cited_text?: string | undefined; url?: string | undefined; title?: string | null | undefined; document_title?: string | null | undefined; source?: string | undefined }

/** One of Claude's citations as a source: a web page by its address, a document or search result by its title. */
function citationSource(c: Citation): ToolSource | undefined {
  const snippet = c.cited_text?.trim() ? clip(c.cited_text.trim(), 280) : undefined
  if (c.url) return { key: `web:${c.url}`, kind: "web", label: c.title || c.url, origin: host(c.url), snippet }
  const title = c.document_title ?? c.title ?? c.source
  if (title) return { key: `document:${title}`, kind: "document", label: title, snippet }
  return undefined
}

function addBlock(r: Reply, block: ContentBlock, options: FromClaudeAgentOptions) {
  if (block.type === "text") {
    if (!block.text.trim()) return
    // Claude's citations point at what it read; the [n] comes from them, never from numbers in the text.
    const cites = (block.citations ?? []).flatMap((c) => {
      const source = citationSource(c as Citation)
      return source ? [addSource(r, source)] : []
    })
    r.parts.push({ kind: "text", text: block.text, cites: cites.length ? [...new Set(cites)] : undefined })
  } else if (block.type === "thinking") {
    // With the SDK's default display, thinking arrives empty; there's nothing to show then.
    if (block.thinking.trim()) r.reasoning.push(reasoningEntry(`${r.id}-r${r.reasoning.length}`, block.thinking, false))
  } else if (block.type === "tool_use" || block.type === "server_tool_use" || block.type === "mcp_tool_use") {
    const call: ToolCall = { id: block.id, tool: block.name, title: options.toolTitle?.(block.name, block.input) ?? block.name, status: "running", input: json(block.input) }
    r.tools.set(block.id, call)
    r.inputs.set(block.id, block.input)
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
      // Web search results are sources the reply can stand on, whether or not the text cites them.
      if (!failed && block.type === "web_search_tool_result" && Array.isArray(content)) {
        for (const item of content as { type?: string | undefined; url?: string | undefined; title?: string | undefined }[]) {
          if (item.type === "web_search_result" && item.url) addSource(r, { key: `web:${item.url}`, kind: "web", label: item.title || item.url, origin: host(item.url) })
        }
      }
    }
  }
}

function render(r: Reply, o: FromClaudeAgentOptions & { model?: string | undefined; last: boolean }): Message {
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
    else blocks.push(...withCitations(markdownBlocks(p.text), p.cites))
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
    sources: r.sources.size ? [...r.sources.values()] : undefined,
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
  return content.map((c: { type?: string | undefined; text?: string | undefined }) => (c.type === "text" ? (c.text ?? "") : c.type ? `[${c.type}]` : "")).join("\n")
}

const firstLine = (text: string) => text.trim().split("\n")[0] || undefined

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

const host = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/** Puts a text block's [n] markers at its end: after the last paragraph's, heading's or list item's words. */
function withCitations(blocks: MessageBlock[], cites: string[] | undefined): MessageBlock[] {
  if (!cites?.length) return blocks
  const marks: InlineNode[] = cites.map((sourceId) => ({ kind: "citation", sourceId }))
  const out = [...blocks]
  for (let i = out.length - 1; i >= 0; i--) {
    const b = out[i]!
    if (b.kind === "paragraph" || b.kind === "heading") {
      out[i] = { ...b, nodes: [...b.nodes, ...marks] }
      return out
    }
    if (b.kind === "list" && b.items.length) {
      out[i] = { ...b, items: [...b.items.slice(0, -1), [...b.items.at(-1)!, ...marks]] }
      return out
    }
  }
  // Only code or plain text: the markers get a line of their own.
  return [...out, { kind: "paragraph", nodes: marks }]
}

/* ---------------------------------------------------------------- permissions */

type AskUserQuestionInput = { questions?: { question?: string | undefined; header?: string | undefined; multiSelect?: boolean | undefined; options?: { label?: string | undefined; description?: string | undefined }[] | undefined }[] | undefined }

/**
 * The questions in an AskUserQuestion call, ready for ClarifyingQuestions; undefined when the input isn't one.
 * Option ids are their labels, which is what the SDK takes back.
 */
export function claudeQuestions(input: unknown): ClaudeQuestion[] | undefined {
  const qs = (input as AskUserQuestionInput | null)?.questions
  if (!Array.isArray(qs) || !qs.length) return undefined
  const out: ClaudeQuestion[] = []
  for (const q of qs) {
    if (typeof q?.question !== "string" || !Array.isArray(q.options)) return undefined
    out.push({
      id: q.question,
      kind: "choice",
      prompt: q.question,
      tag: typeof q.header === "string" && q.header ? q.header : undefined,
      options: q.options.filter((o) => typeof o?.label === "string").map((o) => ({ id: o.label!, label: o.label!, detail: o.description || undefined })),
      multiple: q.multiSelect === true,
      other: true,
    })
  }
  return out
}

type Answerable = Pick<ClaudeApproval, "input" | "suggestions" | "noAlwaysAllow" | "questions">

/**
 * What to hand back to the SDK for a person's answer: the `PermissionResult` canUseTool resolves with. Pure, so it
 * works wherever the answer lands (your own route, a queue, a workflow signal). Questions become AskUserQuestion's
 * `answers`, keyed by question text, several choices joined with ", " and the person's own words used as they are.
 * Only the suggestions the person picked are kept, and none when the request offers no "always allow".
 */
export function claudePermissionResult(request: Answerable, answer: ClaudeApprovalAnswer): PermissionResult {
  if (!answer.approved) {
    return { behavior: "deny", message: answer.reason ? `The user declined: ${answer.reason}` : "The user declined this action." }
  }
  const input = (request.input && typeof request.input === "object" ? request.input : {}) as Record<string, unknown>
  let updatedInput = answer.updatedInput ?? input
  if (request.questions) {
    const answers: Record<string, string> = {}
    for (const q of request.questions) {
      const a = answer.answers?.find((x) => x.questionId === q.id)
      const words = [...(a?.choice ?? []).filter((c) => q.options.some((o) => o.id === c)), ...(a?.text?.trim() ? [a.text.trim()] : [])]
      if (words.length) answers[q.id] = words.join(", ")
    }
    updatedInput = { ...input, answers }
  }
  const kept = request.noAlwaysAllow ? [] : [...new Set(answer.alwaysAllow ?? [])].flatMap((i) => (request.suggestions?.[i] ? [request.suggestions[i]] : []))
  return { behavior: "allow", updatedInput, ...(kept.length && { updatedPermissions: kept }) }
}

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

/** A "don't ask again" rule in plain parts, for PermissionPrompt's `suggestions`. */
export type ClaudeSuggestion = { action: "allow" | "deny" | "ask" | "remove" | "mode" | "directories" | "other"; what: string; scope?: string | undefined }

const scopes: Record<string, string> = { session: "session", localSettings: "local", projectSettings: "project", userSettings: "user", cliArg: "session" }

/**
 * The SDK's suggested permission updates as plain parts PermissionPrompt shows, in the same order, so the indexes a
 * person ticks are the ones `alwaysAllow` sends back.
 */
export function claudeSuggestions(updates: PermissionUpdate[] | undefined): ClaudeSuggestion[] {
  return (updates ?? []).map((u) => {
    const scope = scopes[u.destination] ?? u.destination
    if (u.type === "setMode") return { action: "mode", what: u.mode, scope }
    if (u.type === "addDirectories") return { action: "directories", what: u.directories.join(", "), scope }
    if (u.type === "removeDirectories") return { action: "other", what: u.directories.join(", "), scope }
    const what = u.rules.map((r) => (r.ruleContent ? `${r.toolName}(${r.ruleContent})` : r.toolName)).join(", ")
    if (u.type === "removeRules") return { action: "remove", what, scope }
    return { action: u.behavior, what, scope }
  })
}
