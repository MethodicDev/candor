import * as React from "react"
import type { ComposerState } from "@/components/composer"
import type { EntityRef } from "@/lib/chat"
import { fromClaudeAgentEvents, type AgentEvent, type FromClaudeAgentOptions } from "@/components/claude-agent-sdk"

export type UseClaudeAgentOptions = Omit<FromClaudeAgentOptions, "running"> & {
  /** Your route that runs the agent with streamClaudeAgent. It receives `{ prompt, references, sessionId, ...body }`. */
  api: string
  /** Your route that calls answerClaudeAgentApproval. It receives `{ id, approved, reason }`. */
  approveApi: string
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
  const { api, approveApi, body, headers, agent, toolTitle, fetch: fetcher } = options
  const [events, setEvents] = React.useState<AgentEvent[]>([])
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [value, setValue] = React.useState("")
  const [references, setReferences] = React.useState<EntityRef[]>([])
  const run = React.useRef<AbortController | null>(null)

  const state = React.useMemo(() => fromClaudeAgentEvents(events, { agent, toolTitle, running }), [events, agent, toolTitle, running])
  const session = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    session.current = state.sessionId
  }, [state.sessionId])

  // Stop the agent if the component goes away mid-run.
  React.useEffect(() => () => run.current?.abort(), [])

  const send = React.useCallback(
    async (text: string, refs: EntityRef[]) => {
      if (run.current) return
      const controller = new AbortController()
      run.current = controller
      setError(undefined)
      setRunning(true)
      setEvents((e) => [...e, { type: "candor_user", id: crypto.randomUUID(), text, references: refs.length ? refs : undefined }])
      // Streamed text arrives a few characters at a time; apply it once per frame.
      const pending = { events: [] as AgentEvent[], frame: 0 }
      const flush = () => {
        pending.frame = 0
        const batch = pending.events.splice(0)
        if (batch.length) setEvents((e) => [...e, ...batch])
      }
      try {
        const res = await (fetcher ?? fetch)(api, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ ...body, prompt: text, references: refs, sessionId: session.current }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error(`The agent request failed (${res.status}).`)
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
    [api, body, headers, fetcher]
  )

  const respond = React.useCallback(
    async (approvalId: string, approved: boolean, reason?: string) => {
      try {
        const res = await (fetcher ?? fetch)(approveApi, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ id: approvalId, approved, reason }) })
        const ok = res.ok && ((await res.json()) as { ok?: boolean }).ok
        if (!ok) setError("Your answer didn’t reach the agent. The request may have ended; try sending the message again.")
      } catch {
        setError("Your answer didn’t reach the agent. Check your connection and try again.")
      }
    },
    [approveApi, headers, fetcher]
  )

  const stop = React.useCallback(() => run.current?.abort(), [])

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
    /** Forget the conversation and start a new session. */
    reset: () => {
      run.current?.abort()
      setEvents([])
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
