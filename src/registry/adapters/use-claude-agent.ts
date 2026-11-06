import * as React from "react"
import type { ComposerState } from "@/registry/chat/composer"
import type { EntityRef } from "@/registry/lib/chat"
import { fromClaudeAgentEvents, type AgentEvent, type ClaudeApprovalAnswer, type ClaudePermissionMode, type FromClaudeAgentOptions } from "@/registry/adapters/claude-agent-sdk"

export type UseClaudeAgentOptions = Omit<FromClaudeAgentOptions, "running"> & {
  /** Your route that runs the agent with streamClaudeAgent. It receives `{ prompt, promptId, references, sessionId, ...body }`. */
  api: string
  /**
   * Your route that records an answer (answerClaudeApproval). It receives `{ id, approved, reason, updatedInput,
   * answers, alwaysAllow }` and returns `{ ok }`. Not needed with `onRespond`.
   */
  approveApi?: string
  /**
   * Answer through your own route instead, e.g. one that signals the workflow running the agent. Resolve true once
   * the answer is recorded, false if it wasn't (the request had ended).
   */
  onRespond?: (approvalId: string, answer: ClaudeApprovalAnswer) => Promise<boolean>
  /** Events you kept from earlier (onEvent, a run store): the conversation is folded from them, as it was. */
  initialEvents?: AgentEvent[]
  /**
   * Where to re-attach to a run after a reload: `(runId, from) => \`/api/agent/${runId}?from=${from}\``, a route that
   * returns attachClaudeAgentRun. With `runId`, the hook re-attaches when it mounts.
   */
  attachUrl?: (runId: string, from: number) => string
  /** A run to re-attach to when the hook mounts, e.g. the one you saved from `runId` before the reload. */
  runId?: string
  /** Your route that calls stopClaudeAgentRun with `{ runId }`. Needed to stop a run that keeps going without the browser (`detach`). */
  stopApi?: string
  /** Your route that calls setClaudeAgentPermissionMode with `{ runId, mode }`. Enables `setPermissionMode`. */
  modeApi?: string
  /** Extra fields for every request, e.g. which project the agent works on. */
  body?: Record<string, unknown>
  headers?: Record<string, string>
  /** Replaces the global fetch, e.g. to add auth or to play a script in tests and demos. */
  fetch?: typeof fetch
}

/**
 * Wires a Claude Agent SDK server route to Candor: messages for <Thread>/<Message>,
 * props for <Composer>, and the tool calls waiting on a person. The same shape as
 * useCandorChat, so screens work with either.
 *
 *   const { messages, composer, approvals, respond } = useClaudeAgent({ api: "/api/agent", approveApi: "/api/agent/approve", agent })
 *   <Thread footer={<Composer {...composer} />}>{messages.map((m) => <Message key={m.id} message={m} />)}</Thread>
 *
 * Each message continues the same agent session (the SDK's `resume`). Mentions are
 * sent as structured `references`, not pasted into the text.
 */
export function useClaudeAgent(options: UseClaudeAgentOptions) {
  const { api, approveApi, onRespond, body, headers, agent, toolTitle, sourcesFrom, fetch: fetcher, attachUrl, stopApi, modeApi } = options
  const [events, setEvents] = React.useState<AgentEvent[]>(() => options.initialEvents ?? [])
  const [runId, setRunId] = React.useState<string | undefined>(options.runId)
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [value, setValue] = React.useState("")
  const [references, setReferences] = React.useState<EntityRef[]>([])
  const run = React.useRef<AbortController | null>(null)

  const state = React.useMemo(() => fromClaudeAgentEvents(events, { agent, toolTitle, sourcesFrom, running }), [events, agent, toolTitle, sourcesFrom, running])
  const session = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    session.current = state.sessionId
  }, [state.sessionId])

  // Stop the agent if the component goes away mid-run.
  React.useEffect(() => () => run.current?.abort(), [])

  /** Reads one response's events into state, a frame at a time. */
  const stream = React.useCallback(
    async (open: (signal: AbortSignal) => Promise<Response>, before?: AgentEvent, replace = false) => {
      if (run.current) return
      const controller = new AbortController()
      run.current = controller
      setError(undefined)
      setRunning(true)
      if (before) setEvents((e) => [...e, before])
      // Streamed text arrives a few characters at a time; apply it once per frame.
      const pending = { events: [] as AgentEvent[], frame: 0, first: replace }
      const flush = () => {
        pending.frame = 0
        const batch = pending.events.splice(0)
        if (!batch.length) return
        const first = pending.first ? batch[0] : undefined
        pending.first = false
        setEvents((e) => {
          // Re-attaching to a run whose events are already here (from initialEvents): the stored run replaces them,
          // found by the person's message that starts it, rather than being added a second time.
          const at = first?.type === "candor_user" ? e.findIndex((x) => x.type === "candor_user" && x.id === first.id) : -1
          return [...(at >= 0 ? e.slice(0, at) : e), ...batch]
        })
      }
      try {
        const res = await open(controller.signal)
        if (!res.ok || !res.body) throw new Error(`The agent request failed (${res.status}).`)
        const id = res.headers.get("x-candor-run-id")
        if (id) setRunId(id)
        for await (const event of readEvents(res.body)) {
          pending.events.push(event)
          pending.frame ||= requestAnimationFrame(flush)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : "The agent request failed."
          pending.events.push({ type: "candor_error", message })
          setError(message)
        }
      } finally {
        cancelAnimationFrame(pending.frame)
        flush()
        run.current = null
        setRunning(false)
      }
    },
    []
  )

  const send = React.useCallback(
    (text: string, refs: EntityRef[]) => {
      const promptId = crypto.randomUUID()
      return stream(
        (signal) =>
          (fetcher ?? fetch)(api, {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: JSON.stringify({ ...body, prompt: text, promptId, references: refs, sessionId: session.current }),
            signal,
          }),
        { type: "candor_user", id: promptId, text, references: refs.length ? refs : undefined }
      )
    },
    [api, body, headers, fetcher, stream]
  )

  /**
   * Re-attach to a run after a reload: its events from `from` on (default 0, the whole run), then live until it
   * ends. Needs `attachUrl`. From 0, when the run store recorded the person's message (the server's `prompt`, with
   * this hook's `promptId`), the run's events replace any copy of them already in `initialEvents`.
   */
  const attach = React.useCallback(
    (id: string, from = 0) => {
      if (!attachUrl) return Promise.resolve()
      setRunId(id)
      return stream((signal) => (fetcher ?? fetch)(attachUrl(id, from), { headers, signal }), undefined, from === 0)
    },
    [attachUrl, fetcher, headers, stream]
  )

  // Re-attach to the run named in options once, when the hook mounts.
  const attachOnMount = React.useRef(options.runId)
  React.useEffect(() => {
    const id = attachOnMount.current
    attachOnMount.current = undefined
    if (id) void attach(id)
  }, [attach])

  const post = React.useCallback(
    async (url: string, payload: unknown) => {
      const res = await (fetcher ?? fetch)(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) })
      return res.ok && !!((await res.json()) as { ok?: boolean }).ok
    },
    [fetcher, headers]
  )

  /**
   * Answer a waiting request. `more` carries an edited input (`updatedInput`), answers to the agent's questions
   * (`answers`) and the "always allow" rules the person picked (`alwaysAllow`, indexes into its `suggestions`).
   */
  const respond = React.useCallback(
    async (approvalId: string, approved: boolean, reason?: string, more?: Omit<ClaudeApprovalAnswer, "approved" | "reason">) => {
      const answer: ClaudeApprovalAnswer = { approved, ...(reason !== undefined && { reason }), ...more }
      try {
        const ok = onRespond ? await onRespond(approvalId, answer) : approveApi ? await post(approveApi, { id: approvalId, ...answer }) : false
        if (!ok) setError("Your answer didn’t reach the agent. The request may have ended; try sending the message again.")
        return ok
      } catch {
        setError("Your answer didn’t reach the agent. Check your connection and try again.")
        return false
      }
    },
    [approveApi, onRespond, post]
  )

  const stop = React.useCallback(() => {
    // A detached run carries on without this browser, so it's stopped on the server too.
    if (stopApi && runId) void post(stopApi, { runId }).catch(() => {})
    run.current?.abort()
  }, [stopApi, runId, post])

  /** Change the run's permission mode. Resolves false when there's no run, no `modeApi`, or the server refused. */
  const setPermissionMode = React.useCallback(
    async (mode: ClaudePermissionMode) => {
      if (!modeApi || !runId || !running) return false
      try {
        const ok = await post(modeApi, { runId, mode })
        if (!ok) setError("The permission mode didn’t change.")
        return ok
      } catch {
        setError("The permission mode didn’t change. Check your connection and try again.")
        return false
      }
    },
    [modeApi, runId, running, post]
  )

  const composerState: ComposerState = running ? (state.messages.at(-1)?.author.role === "agent" ? "streaming" : "sending") : "ready"

  return {
    messages: state.messages,
    approvals: state.approvals,
    respond,
    /** What the SDK measured for the session: cost (its estimate), tokens and turns. */
    usage: state.usage,
    /** A passing problem the agent is handling itself, such as a retried API call. */
    notice: state.notice,
    /** The request failed; say so, and let the person send again. */
    error,
    sessionId: state.sessionId,
    /** Every event so far, to keep for replay (`initialEvents`). */
    events,
    /** The current or last run's id (from `x-candor-run-id`): save it to re-attach after a reload. */
    runId,
    attach,
    /** The permission mode last reported by the SDK or set through `setPermissionMode`. */
    permissionMode: state.permissionMode,
    setPermissionMode,
    /** Forget the conversation and start a new session. */
    reset: () => {
      run.current?.abort()
      setEvents([])
      setRunId(undefined)
      setError(undefined)
    },
    composer: {
      value,
      onChange: setValue,
      state: composerState,
      references,
      onReferencesChange: setReferences,
      onStop: stop,
      onSubmit: (text: string, refs: EntityRef[]) => {
        if (!text.trim() || running) return
        void send(text, refs)
        setValue("")
        setReferences([])
      },
    },
  }
}

/** Newline-delimited JSON events from the server; a malformed line is skipped. */
async function* readEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<AgentEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split("\n")
    buffer = done ? "" : (lines.pop() ?? "")
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        yield JSON.parse(line) as AgentEvent
      } catch {
        /* a partial or corrupt line; the next one carries on */
      }
    }
    if (done) return
  }
}
