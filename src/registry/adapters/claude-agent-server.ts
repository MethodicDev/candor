import type { CanUseTool, PermissionMode, PermissionResult, Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import {
  claudePermissionResult,
  claudeQuestions,
  type AgentEvent,
  type ClaudeApproval,
  type ClaudeApprovalAnswer,
  type ClaudePermissionMode,
} from "@/registry/adapters/claude-agent-sdk"
import type { EntityRef } from "@/registry/lib/chat"

/*
 * The server half of the Claude Agent SDK adapter. Server-only: it runs the
 * agent, which needs Node and your credentials. Never import it in the browser.
 *
 * streamClaudeAgent() runs a query() and streams its messages to useClaudeAgent
 * as newline-delimited JSON. When the SDK asks permission for a tool call, the
 * request goes to the browser and the tool waits until a person answers.
 *
 * Waiting requests are kept in an ApprovalStore. The default keeps them in this
 * process's memory, so the answer must reach the process that runs the agent:
 * fine for one Node server or container. Pass your own store (a table, a queue)
 * so any instance can take the answer, or answer from your own route, such as a
 * signal to a workflow. A ClaudeRunStore keeps a run's events, so a browser can
 * re-attach to a run after a reload (attachClaudeAgentRun) and a finished run
 * can be replayed.
 *
 * The agent itself still runs in the process that started it: a store makes the
 * answer and the record durable, not the run. Where runs must outlive a process,
 * run the agent in your workflow engine and use claudeCanUseTool there.
 */

/* ---------------------------------------------------------------- approval store */

/** A permission request as a store keeps it. */
export type StoredApproval = {
  id: string
  /** The run it belongs to, when the run has an id. */
  runId?: string
  /** Who may answer it; checked by answerClaudeApproval. */
  owner?: string
  request: ClaudeApproval
  createdAt: string
  /** Set once answered. Recorded, not necessarily used: a run that stopped at the same moment still denies the tool. */
  answer?: ClaudeApprovalAnswer & { at: string }
  /** Set when nobody can answer any more (the run ended or stopped), with why. */
  closed?: { at: string; reason: string }
}

/**
 * Where waiting permission requests live. Answering and closing each happen once: whichever comes first wins, so a
 * late answer to a run that already ended returns false instead of being lost. A store backed by a database does
 * both as one conditional update (`… where answered_at is null and closed_at is null`).
 */
export interface ApprovalStore {
  /** Record a request that waits on a person. */
  put(approval: StoredApproval): Promise<void>
  get(id: string): Promise<StoredApproval | undefined>
  /** Record the answer. False when there's no such request, or it was already answered or closed. */
  answer(id: string, answer: ClaudeApprovalAnswer): Promise<boolean>
  /** Mark that it can't be answered any more. False when it was answered first. */
  close(id: string, reason: string): Promise<boolean>
  /**
   * Resolves with the answer once there is one, or undefined once it's closed or `signal` aborts. When `signal`
   * aborts first, close the request in the same step ("The run was stopped."), so an answer arriving just after is
   * refused instead of recorded for a tool that never ran. A store with no way to push can poll with waitByPolling.
   */
  wait(id: string, signal: AbortSignal): Promise<ClaudeApprovalAnswer | undefined>
  /** Requests still waiting, oldest first, for one run or all: what to show again after a reload. */
  pending(runId?: string): Promise<StoredApproval[]>
}

/**
 * The default ApprovalStore: this process's memory. Answered and closed requests are forgotten after `keepMs`
 * (10 minutes), so it doesn't grow without bound.
 */
export function memoryApprovalStore({ keepMs = 10 * 60_000 }: { keepMs?: number } = {}): ApprovalStore {
  const items = new Map<string, StoredApproval>()
  const waiters = new Map<string, Set<() => void>>()
  const wake = (id: string) => {
    for (const w of waiters.get(id) ?? []) w()
    waiters.delete(id)
  }
  const forget = (id: string) => setTimeout(() => items.delete(id), keepMs).unref?.()
  const now = () => new Date().toISOString()
  const answer = (id: string, a: ClaudeApprovalAnswer) => {
    const item = items.get(id)
    if (!item || item.answer || item.closed) return false
    item.answer = { ...structuredClone(a), at: now() }
    wake(id)
    forget(id)
    return true
  }
  const store: ApprovalStore = {
    async put(approval) {
      items.set(approval.id, structuredClone(approval))
    },
    async get(id) {
      const a = items.get(id)
      return a && structuredClone(a)
    },
    async answer(id, a) {
      return answer(id, a)
    },
    async close(id, reason) {
      const a = items.get(id)
      if (!a || a.answer || a.closed) return false
      a.closed = { at: now(), reason }
      wake(id)
      forget(id)
      return true
    },
    wait(id, signal) {
      return new Promise((resolve) => {
        const settle = () => {
          signal.removeEventListener("abort", onAbort)
          waiters.get(id)?.delete(settle)
          const a = items.get(id)
          resolve(a?.answer ? stripAt(a.answer) : undefined)
        }
        // Stopped before an answer: closed in the same step, so a late answer is refused rather than recorded.
        const onAbort = () => {
          const a = items.get(id)
          if (a && !a.answer && !a.closed) {
            a.closed = { at: now(), reason: "The run was stopped." }
            forget(id)
          }
          settle()
        }
        const a = items.get(id)
        if (!a || a.answer || a.closed) return settle()
        if (signal.aborted) return onAbort()
        let set = waiters.get(id)
        if (!set) waiters.set(id, (set = new Set()))
        set.add(settle)
        signal.addEventListener("abort", onAbort, { once: true })
      })
    },
    async pending(runId) {
      return [...items.values()].filter((a) => !a.answer && !a.closed && (runId === undefined || a.runId === runId)).map((a) => structuredClone(a))
    },
  }
  synchronous.set(store, { get: (id) => items.get(id), answer })
  return store
}

/** The memory store's own synchronous calls, so the 1.4 answer function can stay synchronous. */
const synchronous = new WeakMap<ApprovalStore, { get(id: string): StoredApproval | undefined; answer(id: string, a: ClaudeApprovalAnswer): boolean }>()

const stripAt = (stored: ClaudeApprovalAnswer & { at: string }): ClaudeApprovalAnswer => {
  const answer: ClaudeApprovalAnswer & { at?: string } = { ...stored }
  delete answer.at
  return answer
}

/** A `wait` for stores that can't push: reads the request every `intervalMs` (1s) until it's answered or closed. */
export async function waitByPolling(get: (id: string) => Promise<StoredApproval | undefined>, id: string, signal: AbortSignal, intervalMs = 1000): Promise<ClaudeApprovalAnswer | undefined> {
  while (!signal.aborted) {
    const a = await get(id)
    if (!a || a.closed) return undefined
    if (a.answer) return stripAt(a.answer)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, intervalMs)
      function done() {
        clearTimeout(timer)
        signal.removeEventListener("abort", done)
        resolve()
      }
      signal.addEventListener("abort", done, { once: true })
    })
  }
  return undefined
}

/** The store streamClaudeAgent and answerClaudeAgentApproval use when you don't pass one. */
const defaultApprovals = memoryApprovalStore()

export type ClaudeCanUseToolOptions = {
  /** Where requests wait. Defaults to this process's memory. */
  approvals?: ApprovalStore
  /** Sends each request, and its closing, to whoever shows it (the browser, your event log). */
  emit: (event: AgentEvent) => void
  /** Who may answer. */
  owner?: string
  /** The run's id, kept with each request. */
  runId?: string
  /** The run's permission mode now, recorded on each request. */
  mode?: () => ClaudePermissionMode | undefined
  /** Called with each request's id as it starts waiting and once it's settled, e.g. to close the rest when the run ends. */
  track?: { add(id: string): void; delete(id: string): void }
  /**
   * Which tools' input a person may edit before allowing it (`updatedInput`). Every tool by default, as in 1.5.0;
   * an answer that edits a tool this refuses is rejected by answerClaudeApproval, whatever the browser sends.
   */
  editable?: (tool: string, input: unknown) => boolean
  /** Close a request nobody answered after this long, as expired: the tool is denied, never allowed. No limit by default. */
  approvalTimeoutMs?: number
}

/**
 * A canUseTool that keeps each request in an ApprovalStore and waits for its answer from wherever it's given: your
 * route, a queue, a workflow signal (`approvals.answer(id, { approved: true })`). Use it on its own when your agent
 * runs somewhere other than streamClaudeAgent. When the SDK stops waiting, the request is closed, so a late answer
 * is refused rather than lost.
 */
export function claudeCanUseTool({ approvals = defaultApprovals, emit, owner, runId, mode, track, editable, approvalTimeoutMs }: ClaudeCanUseToolOptions): CanUseTool {
  return async (tool, input, request) => {
    const id = crypto.randomUUID()
    const questions = tool === "AskUserQuestion" ? claudeQuestions(input) : undefined
    const approval: ClaudeApproval = {
      id,
      toolUseId: request.toolUseID,
      tool,
      input,
      title: request.title,
      description: request.description,
      reason: request.decisionReason,
      blockedPath: request.blockedPath,
      defaultToNo: request.defaultToNo,
      displayName: request.displayName,
      // A question has no rule to remember; and a request that mustn't offer one gets none.
      suggestions: questions || request.suppressAlwaysAllowRule ? undefined : request.suggestions,
      noAlwaysAllow: request.suppressAlwaysAllowRule || undefined,
      mode: mode?.(),
      questions,
      agentId: request.agentID,
      mcpServer: request.mcpServer,
      // A question's answers aren't an edit; otherwise the server's policy decides, and the browser can't widen it.
      editable: questions ? false : editable ? editable(tool, input) : true,
    }
    await approvals.put({ id, runId, owner, request: approval, createdAt: new Date().toISOString() })
    track?.add(id)
    emit({ type: "candor_approval", ...approval })
    const timer = approvalTimeoutMs ? setTimeout(() => void approvals.close(id, EXPIRED), approvalTimeoutMs) : undefined
    const answer = await approvals.wait(id, request.signal)
    clearTimeout(timer)
    track?.delete(id)
    if (!answer || request.signal.aborted) {
      const stored = await approvals.get(id)
      const reason = request.signal.aborted
        ? stored?.answer
          ? "The run stopped before the answer could be used."
          : "The run was stopped."
        : (stored?.closed?.reason ?? "The run ended.")
      await approvals.close(id, reason)
      emit({ type: "candor_approval_closed", id, approved: false, reason, expired: reason === EXPIRED || undefined })
      return { behavior: "deny", message: reason, interrupt: request.signal.aborted } satisfies PermissionResult
    }
    const edited = answer.approved && answer.updatedInput !== undefined
    emit({
      type: "candor_approval_closed",
      id,
      approved: answer.approved,
      reason: answer.reason,
      edited: edited || undefined,
      // What actually ran, so the tool card and a replay show it rather than what the agent proposed.
      input: edited ? answer.updatedInput : undefined,
      kept: answer.alwaysAllow?.length || undefined,
    })
    return claudePermissionResult(approval, answer)
  }
}

const EXPIRED = "Nobody answered in time."

/* ---------------------------------------------------------------- run store */

/**
 * A run's events, kept so a browser can re-attach after a reload and a finished run can be replayed. `read` returns
 * the events from index `from` on, and whether the run has ended.
 */
export interface ClaudeRunStore {
  /**
   * Begin a run, with who started it. streamClaudeAgent calls it first. An append, end or subscribe for a run that
   * was never started (or was already forgotten) must do nothing rather than create it, so a forgotten run can't
   * come back without its owner.
   */
  start?(runId: string, owner?: string): Promise<void>
  append(runId: string, event: AgentEvent): Promise<void>
  end(runId: string): Promise<void>
  read(runId: string, from: number): Promise<{ events: AgentEvent[]; ended: boolean } | undefined>
  /** Called when the run has new events or ends. Optional: without it, attaching polls `read`. */
  subscribe?(runId: string, listener: () => void): () => void
  /** Who started the run, when it was started with an owner; attachClaudeAgentRun checks it. */
  ownerOf?(runId: string): Promise<string | undefined>
  /** Record the run's owner. Kept from 1.5.0; prefer `start`. */
  setOwner?(runId: string, owner: string): Promise<void>
}

/**
 * The default ClaudeRunStore: this process's memory. It keeps at most `maxRuns` finished runs (100), forgetting the
 * oldest finished one first; a run still going is never forgotten. Each run keeps at most `maxEvents` events
 * (5,000): past that, partial-text events are no longer kept (the finished message still is), so a re-attached
 * browser sees text arrive a message at a time instead of as it streams.
 */
export function memoryRunStore({ maxRuns = 100, maxEvents = 5000 }: { maxRuns?: number; maxEvents?: number } = {}): ClaudeRunStore {
  const runs = new Map<string, { events: AgentEvent[]; ended: boolean; owner?: string; listeners: Set<() => void> }>()
  const notify = (id: string) => runs.get(id)?.listeners.forEach((l) => l())
  const forgetFinished = () => {
    // Oldest first: Map keeps insertion order. Runs still going are skipped, so their owner is never lost.
    for (const [id, r] of runs) {
      if (runs.size <= maxRuns) return
      if (r.ended) runs.delete(id)
    }
  }
  const start = (id: string, owner?: string) => {
    const r = runs.get(id)
    if (r) {
      if (owner !== undefined && r.owner === undefined) r.owner = owner
      return
    }
    runs.set(id, { events: [], ended: false, owner, listeners: new Set() })
    forgetFinished()
  }
  return {
    async start(id, owner) {
      start(id, owner)
    },
    async append(id, event) {
      const r = runs.get(id)
      if (!r || r.ended) return
      if (r.events.length >= maxEvents && event.type === "stream_event") return
      r.events.push(event)
      notify(id)
    },
    async end(id) {
      const r = runs.get(id)
      if (!r) return
      r.ended = true
      notify(id)
      forgetFinished()
    },
    async read(id, from) {
      const r = runs.get(id)
      return r && { events: r.events.slice(Math.max(0, from)), ended: r.ended }
    },
    subscribe(id, listener) {
      const r = runs.get(id)
      if (!r) return () => {}
      r.listeners.add(listener)
      return () => r.listeners.delete(listener)
    },
    async ownerOf(id) {
      return runs.get(id)?.owner
    },
    async setOwner(id, owner) {
      start(id, owner)
    },
  }
}

/* ---------------------------------------------------------------- streaming a run */

/** Runs started by this process, so stop and the mode switch can reach them. */
const live = new Map<string, { owner?: string; abort: AbortController; query?: Query; emit: (e: AgentEvent) => void; modes?: ModePolicy }>()

/** Which permission modes a run may be switched to: a list, or a test. */
export type ModePolicy = readonly PermissionMode[] | ((mode: PermissionMode) => boolean)
const permits = (policy: ModePolicy | undefined, mode: PermissionMode) => (!policy ? true : typeof policy === "function" ? policy(mode) : policy.includes(mode))

export type RunClaudeAgent = (tools: {
  /** Pass to query()'s `canUseTool`, so permission requests reach the person. */
  canUseTool: CanUseTool
  /** Pass to query()'s `abortController`, so stopping in the browser stops the agent. */
  abortController: AbortController
  /**
   * Send a typed card to the browser, e.g. from a tool handler: `emit({ type: "candor_card", card: "diff", props, summary })`.
   * It renders through the app's card registry, in the reply where it was sent.
   */
  emit: (event: AgentEvent) => void
  /** This run's id: the same one the response's `x-candor-run-id` header carries. */
  runId: string
}) => Query

export type StreamClaudeAgentOptions = {
  /** The incoming request's signal (`request.signal`): the agent stops when the browser goes away, unless `detach`. */
  signal?: AbortSignal
  /** Who may answer this run's permission requests, e.g. the signed-in user's id. Checked when they're answered. */
  owner?: string
  /** The sentence shown when the run fails. Defaults to a generic one, so server errors don't leak to the browser. */
  describeError?: (error: unknown) => string
  /**
   * Called with every SDK message just before it's sent to the browser, e.g. to record usage and cost from
   * `assistant` and `result` messages. To stop the run from here, abort the run's abortController: the message
   * in hand is still sent, and nothing after it.
   */
  onMessage?: (message: SDKMessage) => void | Promise<void>
  /** Called with every event the browser gets, in order, e.g. to keep the whole conversation for replay. */
  onEvent?: (event: AgentEvent) => void | Promise<void>
  /** Where permission requests wait. Defaults to this process's memory. */
  approvals?: ApprovalStore
  /** Keeps the run's events so a browser can re-attach (attachClaudeAgentRun). Without it, a reload loses the run. */
  runs?: ClaudeRunStore
  /** The run's id; a new one by default. Sent back in the `x-candor-run-id` header. */
  runId?: string
  /**
   * Keep running when the browser goes away (a reload, a closed tab), so it can re-attach. Stop it with
   * stopClaudeAgentRun. Needs a process that outlives the response: not a serverless function that's frozen when
   * the response ends.
   */
  detach?: boolean
  /**
   * What the person sent, recorded as the run's first event in `runs`, so a re-attached browser shows it. Pass the
   * `promptId` useClaudeAgent sends as `id`: a browser that re-attaches with `initialEvents` then replaces the run's
   * events instead of adding them again.
   */
  prompt?: { id: string; text: string; references?: EntityRef[] }
  /** Which tools' input a person may edit before allowing it. Every tool by default. See claudeCanUseTool. */
  editable?: ClaudeCanUseToolOptions["editable"]
  /** Close a permission request nobody answered after this long, as expired (denied). No limit by default; set one with `detach`. */
  approvalTimeoutMs?: number
  /** The permission modes setClaudeAgentPermissionMode may switch this run to. Any mode by default. */
  modes?: ModePolicy
}

/**
 * Run an agent and stream it to useClaudeAgent.
 *
 *   // app/api/agent/route.ts
 *   export async function POST(request: Request) {
 *     const { prompt, sessionId } = await request.json()
 *     return streamClaudeAgent(
 *       ({ canUseTool, abortController }) =>
 *         query({ prompt, options: { canUseTool, abortController, resume: sessionId, includePartialMessages: true } }),
 *       { signal: request.signal, owner: userId, onMessage: (m) => m.type === "result" && recordCost(m.total_cost_usd) }
 *     )
 *   }
 */
export function streamClaudeAgent(
  run: RunClaudeAgent,
  { signal, owner, describeError, onMessage, onEvent, approvals = defaultApprovals, runs, runId = crypto.randomUUID(), detach = false, prompt, editable, approvalTimeoutMs, modes }: StreamClaudeAgentOptions = {}
): Response {
  const encoder = new TextEncoder()
  const abortController = new AbortController()
  const mine = new Set<string>()
  let mode: ClaudePermissionMode | undefined
  let send: (event: AgentEvent) => void = () => {}
  // Keeps the record in the order the browser saw it, even when the stores are slow.
  let recorded = Promise.resolve()
  const record = (event: AgentEvent) => {
    recorded = recorded.then(async () => {
      await runs?.append(runId, event)
      await onEvent?.(event)
    }).catch((error) => console.error("Recording a Claude agent event failed:", error))
  }

  const emit = (event: AgentEvent) => {
    if (event.type === "candor_mode") mode = event.mode
    else if (event.type === "system" && (event.subtype === "init" || event.subtype === "status") && event.permissionMode) mode = event.permissionMode
    record(event)
    send(event)
  }

  const canUseTool = claudeCanUseTool({ approvals, emit, owner, runId, mode: () => mode, track: mine, editable, approvalTimeoutMs })

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true
      send = (event) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          // The browser went away mid-run and the run carries on (detach): later events go only to the run store.
          open = false
        }
      }
      const stop = () => abortController.abort()
      if (!detach) signal?.addEventListener("abort", stop, { once: true })
      if (runs?.start) await runs.start(runId, owner)
      else if (owner !== undefined) await runs?.setOwner?.(runId, owner)
      if (prompt) record({ type: "candor_user", ...prompt })
      const entry = { owner, abort: abortController, emit, query: undefined as Query | undefined, modes }
      live.set(runId, entry)
      try {
        const query = run({ canUseTool, abortController, emit, runId })
        entry.query = query
        for await (const message of query) {
          // Awaited, so bookkeeping such as recording spend finishes before the next message is handled.
          await onMessage?.(message)
          emit(message)
          // Stopped (the browser went away, or onMessage or a tool aborted the run): nothing more is sent.
          if (abortController.signal.aborted) break
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Claude agent run failed:", error)
          emit({ type: "candor_error", message: describeError?.(error) ?? "The agent stopped because of an error on the server." })
        }
      } finally {
        live.delete(runId)
        // Nobody can answer once the run is over.
        await Promise.all([...mine].map((id) => approvals.close(id, "The run ended.")))
        await recorded
        await runs?.end(runId)
        open = false
        signal?.removeEventListener("abort", stop)
        try {
          controller.close()
        } catch {
          /* already closed by the browser going away */
        }
      }
    },
    cancel() {
      // The browser stopped reading. With detach, the run goes on and the browser can re-attach.
      if (!detach) abortController.abort()
    },
  })

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no", "x-candor-run-id": runId },
  })
}

/**
 * Stream a run's events again, from index `from`, then live until it ends: for a browser re-attaching after a
 * reload. 404 when the store doesn't know the run, 403 when `owner` isn't who started it.
 *
 *   // app/api/agent/[runId]/route.ts
 *   export async function GET(request: Request, { params }) {
 *     const from = Number(new URL(request.url).searchParams.get("from") ?? 0)
 *     return attachClaudeAgentRun(runs, (await params).runId, { from, owner: userId, signal: request.signal })
 *   }
 */
export async function attachClaudeAgentRun(
  runs: ClaudeRunStore,
  runId: string,
  { from = 0, owner, signal, pollMs = 500 }: { from?: number; owner?: string; signal?: AbortSignal; pollMs?: number } = {}
): Promise<Response> {
  const first = await runs.read(runId, 0)
  if (!first) return Response.json({ error: "No such run." }, { status: 404 })
  const startedBy = await runs.ownerOf?.(runId)
  if (startedBy !== undefined && startedBy !== owner) return Response.json({ error: "Not your run." }, { status: 403 })
  const encoder = new TextEncoder()
  let next = Number.isSafeInteger(from) && from > 0 ? from : 0
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wake: () => void = () => {}
      // Set by every notification, so one that lands while a read is under way isn't lost to the wait after it.
      let dirty = false
      const unsubscribe = runs.subscribe?.(runId, () => {
        dirty = true
        wake()
      })
      try {
        while (!signal?.aborted) {
          dirty = false
          const page = await runs.read(runId, next)
          if (!page) break
          for (const event of page.events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
          next += page.events.length
          if (page.ended) break
          if (dirty) continue
          await new Promise<void>((resolve) => {
            const timer = setTimeout(done, unsubscribe ? 30_000 : pollMs)
            function done() {
              clearTimeout(timer)
              signal?.removeEventListener("abort", done)
              resolve()
            }
            wake = done
            signal?.addEventListener("abort", done, { once: true })
          })
        }
      } catch {
        /* the browser went away */
      } finally {
        unsubscribe?.()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
  })
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no", "x-candor-run-id": runId } })
}

/** Stop a run this process is running. False when it isn't running here, or `owner` didn't start it. */
export function stopClaudeAgentRun(runId: string, owner?: string): boolean {
  const run = live.get(runId)
  if (!run || (run.owner !== undefined && run.owner !== owner)) return false
  run.abort.abort()
  return true
}

/**
 * Change a running agent's permission mode (the SDK's `setPermissionMode`), and tell the browser. Only for a query
 * in streaming input mode, as the SDK requires. False when the run isn't here, `owner` didn't start it, the mode
 * isn't allowed, or the SDK refused. The route is where policy is enforced: a mode PermissionMode shows as locked
 * must be left out of `allowed` (or the run's `modes`) too, since anyone can post to the route directly.
 */
export async function setClaudeAgentPermissionMode(runId: string, mode: PermissionMode, owner?: string, { allowed }: { allowed?: ModePolicy } = {}): Promise<boolean> {
  const run = live.get(runId)
  if (!run?.query || (run.owner !== undefined && run.owner !== owner)) return false
  if (!permits(run.modes, mode) || !permits(allowed, mode)) return false
  try {
    await run.query.setPermissionMode(mode)
  } catch {
    return false
  }
  run.emit({ type: "candor_mode", mode })
  return true
}

/* ---------------------------------------------------------------- answering */

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype

/**
 * Check an answer from the browser against the request it answers, and record it. False when there's no such
 * request, it's already settled, `owner` isn't the run's owner, or the answer doesn't fit the request (an edited
 * input that isn't an object, answers to a request that isn't a question, a suggestion that wasn't offered).
 *
 *   // app/api/agent/approve/route.ts
 *   export async function POST(request: Request) {
 *     const { id, ...answer } = await request.json()
 *     return Response.json({ ok: await answerClaudeApproval(approvals, id, answer, { owner: userId }) })
 *   }
 */
export async function answerClaudeApproval(approvals: ApprovalStore, id: string, answer: ClaudeApprovalAnswer, { owner }: { owner?: string } = {}): Promise<boolean> {
  const clean = checkAnswer(await approvals.get(id), answer, owner)
  return clean ? approvals.answer(id, clean) : false
}

/** The answer as it will be recorded, or null when it doesn't fit the request or the viewer may not give it. */
function checkAnswer(stored: StoredApproval | undefined, answer: ClaudeApprovalAnswer, owner: string | undefined): ClaudeApprovalAnswer | null {
  if (!stored || stored.answer || stored.closed) return null
  if (stored.owner !== undefined && stored.owner !== owner) return null
  if (typeof answer?.approved !== "boolean") return null
  const r = stored.request
  if (answer.updatedInput !== undefined && (!isPlainObject(answer.updatedInput) || r.questions || r.editable === false)) return null
  if (answer.answers !== undefined && (!r.questions || !Array.isArray(answer.answers))) return null
  if (answer.alwaysAllow !== undefined) {
    const offered = r.noAlwaysAllow ? 0 : (r.suggestions?.length ?? 0)
    if (!Array.isArray(answer.alwaysAllow) || answer.alwaysAllow.some((i) => !Number.isInteger(i) || i < 0 || i >= offered)) return null
  }
  if (answer.reason != null && typeof answer.reason !== "string") return null
  return {
    approved: answer.approved,
    ...(answer.reason && { reason: answer.reason.slice(0, 2000) }),
    ...(answer.approved && answer.updatedInput && { updatedInput: answer.updatedInput }),
    ...(answer.approved && answer.answers && { answers: answer.answers }),
    ...(answer.approved && answer.alwaysAllow?.length && { alwaysAllow: answer.alwaysAllow }),
  }
}

/**
 * Answer a waiting permission request in the default, in-memory store. Kept from 1.4; answerClaudeApproval takes a
 * store and the full answer (an edited input, answers to questions, "always allow"). Returns false when there's no
 * such request, or `owner` doesn't match the run's owner.
 */
export function answerClaudeAgentApproval(id: string, approved: boolean, reason?: string, owner?: string): boolean {
  const memory = synchronous.get(defaultApprovals)!
  const clean = checkAnswer(memory.get(id), { approved, reason }, owner)
  return clean ? memory.answer(id, clean) : false
}
