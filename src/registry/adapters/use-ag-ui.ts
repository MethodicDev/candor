import * as React from "react"
import { HttpAgent, isInterruptExpired, type Interrupt, type ResumeEntry, type RunAgentParameters } from "@ag-ui/client"
import type { ComposerState } from "@/registry/chat/composer"
import type { EntityRef } from "@/registry/lib/chat"
import { fromAgUiEvents, type AgUiEvent, type CandorAgUiEvent, type FromAgUiOptions } from "@/registry/adapters/ag-ui"
import { formatElapsed } from "@/registry/lib/format-elapsed"
import { useFormat } from "@/registry/blocks/locale"

export type UseAgUiOptions = Omit<FromAgUiOptions, "running" | "now"> & {
  /** Your AG-UI endpoint (LangGraph, Mastra, CrewAI, Google ADK, Pydantic AI…). It receives a RunAgentInput and streams events back. */
  url: string
  headers?: Record<string, string> | undefined
  /** Replaces the global fetch, e.g. to add auth or to play a script in tests and demos. */
  fetch?: typeof fetch | undefined
  /** Continue an existing thread instead of starting a new one. */
  threadId?: string | undefined
  /** Sent with every run as `forwardedProps`, next to the `references` the person mentioned. */
  forwardedProps?: Record<string, unknown> | undefined
  /** Tools and context for every run, as AG-UI defines them. Candor doesn't run frontend tools for you. */
  tools?: RunAgentParameters["tools"] | undefined
  context?: RunAgentParameters["context"] | undefined
}

/**
 * Wires an AG-UI agent to Candor: messages for <Thread>/<Message>, props for
 * <Composer>, and the interrupts waiting on a person. The same shape as
 * useClaudeAgent and useCandorChat, so screens work with any of them.
 *
 *   const { messages, composer, approvals, respond } = useAgUi({ url: "/api/agent", agent })
 *   <Thread footer={<Composer {...composer} />}>{messages.map((m) => <Message key={m.id} message={m} />)}</Thread>
 *
 * A run that ends on an interrupt shows it in `approvals`. `respond` records the
 * answer, and once every open interrupt has one, starts the next run with
 * `resume`: approved → `{ status: "resolved", payload: { approved: true } }`,
 * denied → `{ status: "cancelled", payload: { approved: false, reason } }`.
 * Mentions are sent as structured `forwardedProps.references`, not pasted into the text.
 * A reply's thinking time, when the agent's events carry timestamps, reads in LocaleProvider's locale.
 */
export function useAgUi(options: UseAgUiOptions) {
  const { url, headers, agent, agents, toolTitle, fetch: fetcher, threadId, forwardedProps, tools, context, initialState } = options
  const format = useFormat()
  const formatDuration = React.useMemo(() => options.formatDuration ?? ((ms: number) => formatElapsed(ms, format)), [options.formatDuration, format])
  const [events, setEvents] = React.useState<AgUiEvent[]>([])
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [value, setValue] = React.useState("")
  const [references, setReferences] = React.useState<EntityRef[]>([])
  // Interrupts expire on the clock, not on an event; `now` moves when one does.
  const [now, setNow] = React.useState(() => Date.now())
  const run = React.useRef<AbortController | null>(null)
  const client = React.useRef<HttpAgent | null>(null)
  const answers = React.useRef(new Map<string, { approved: boolean; reason?: string | undefined }>())

  const state = React.useMemo(
    () => fromAgUiEvents(events, { agent, agents, toolTitle, running, now: new Date(now), initialState, formatDuration }),
    [events, agent, agents, toolTitle, running, now, initialState, formatDuration]
  )

  const nextExpiry = state.approvals.reduce<number | undefined>((soonest, a) => {
    const at = a.expiresAt ? Date.parse(a.expiresAt) : NaN
    return Number.isNaN(at) ? soonest : Math.min(soonest ?? at, at)
  }, undefined)
  React.useEffect(() => {
    if (nextExpiry === undefined) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [nextExpiry])

  // Stop the agent if the component goes away mid-run.
  React.useEffect(() => () => run.current?.abort(), [])

  const getClient = React.useCallback(() => {
    if (!client.current) client.current = new HttpAgent({
        url,
        ...(headers && { headers }),
        ...(fetcher && { fetch: fetcher }),
        ...(threadId !== undefined && { threadId }),
        ...(initialState !== undefined && { initialState }),
      })
    const http = client.current
    // The latest options win, without losing the thread.
    http.url = url
    http.headers = { ...headers }
    if (fetcher) http.fetch = fetcher
    return http
  }, [url, headers, fetcher, threadId, initialState])

  const start = React.useCallback(
    async (http: HttpAgent, params: { resume?: ResumeEntry[] | undefined; references?: EntityRef[] | undefined }, before: CandorAgUiEvent[]) => {
      const controller = new AbortController()
      run.current = controller
      setError(undefined)
      setRunning(true)
      setEvents((e) => [...e, ...before])
      // Streamed text arrives a few characters at a time; apply it once per frame.
      const pending = { events: [] as AgUiEvent[], frame: 0 }
      const flush = () => {
        pending.frame = 0
        const batch = pending.events.splice(0)
        if (batch.length) setEvents((e) => [...e, ...batch])
      }
      try {
        await http.runAgent(
          {
            ...(params.resume && { resume: params.resume }),
            ...(tools && { tools }),
            ...(context && { context }),
            forwardedProps: { ...forwardedProps, references: params.references ?? [] },
            abortController: controller,
          },
          {
            onEvent: ({ event }) => {
              pending.events.push(event as AgUiEvent)
              pending.frame ||= requestAnimationFrame(flush)
            },
          }
        )
      } catch (err) {
        if (!controller.signal.aborted) {
          const status = (err as { status?: unknown }).status
          const message = typeof status === "number" ? `The agent request failed (${status}).` : "The agent request failed, or its stream broke off."
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
    [tools, context, forwardedProps]
  )

  const send = React.useCallback(
    (text: string, refs: EntityRef[]) => {
      if (run.current) return
      const http = getClient()
      // A new message moves on from any interrupt still open: the agent is told each was cancelled.
      const reason = "The person sent a new message instead."
      const resume = http.pendingInterrupts.map((i): ResumeEntry => ({ interruptId: i.id, status: "cancelled", payload: { approved: false, reason } }))
      const closed = http.pendingInterrupts.map((i): CandorAgUiEvent => ({ type: "candor_answer", interruptId: i.id, approved: false, reason }))
      answers.current.clear()
      const id = crypto.randomUUID()
      http.addMessage({ id, role: "user", content: text })
      void start(http, { resume: resume.length ? resume : undefined, references: refs }, [...closed, { type: "candor_user", id, text, references: refs.length ? refs : undefined }])
    },
    [getClient, start]
  )

  const respond = React.useCallback(
    async (interruptId: string, approved: boolean, reason?: string) => {
      const http = client.current
      if (run.current || !http) return
      const open = http.pendingInterrupts
      if (!open.some((i) => i.id === interruptId)) {
        setError("That request is no longer open.")
        return
      }
      answers.current.set(interruptId, { approved, reason })
      const answer: CandorAgUiEvent = { type: "candor_answer", interruptId, approved, reason }
      // The agent expects one answer for every open interrupt; wait for the rest.
      if (open.some((i) => !answers.current.has(i.id) && !isInterruptExpired(i))) {
        setEvents((e) => [...e, answer])
        return
      }
      const resume = open.map((i) => resumeEntry(i, answers.current.get(i.id)))
      answers.current.clear()
      await start(http, { resume }, [answer])
    },
    [start]
  )

  const stop = React.useCallback(() => run.current?.abort(), [])

  const composerState: ComposerState = running ? (state.messages.at(-1)?.author.role === "agent" ? "streaming" : "sending") : "ready"

  return {
    messages: state.messages,
    approvals: state.approvals,
    respond,
    /** Tokens the runs reported, summed. AG-UI reports no cost. */
    usage: state.usage,
    /** Something the person should know that isn't part of a reply, such as an expired request. */
    notice: state.notice,
    /** The request failed; say so, and let the person send again. */
    error,
    threadId: state.threadId,
    /** The agent's shared state (STATE_SNAPSHOT/STATE_DELTA); undefined until it sends one. */
    state: state.state,
    /** Set, with the reason, when a state update couldn't be applied and `state` may be behind. */
    stateOutOfDate: state.stateOutOfDate,
    /** The activities the agent reported, in order, with plan steps and agent entries where they map. */
    activities: state.activities,
    /** Forget the conversation and start a new thread. */
    reset: () => {
      run.current?.abort()
      client.current = null
      answers.current.clear()
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
        send(text, refs)
        setValue("")
        setReferences([])
      },
    },
  }
}

/** An expired interrupt can only be cancelled; the client refuses anything else. */
function resumeEntry(i: Interrupt, answer: { approved: boolean; reason?: string | undefined } | undefined): ResumeEntry {
  if (answer?.approved && !isInterruptExpired(i)) return { interruptId: i.id, status: "resolved", payload: { approved: true } }
  const reason = answer ? answer.reason : "Nobody answered before it expired."
  return { interruptId: i.id, status: "cancelled", payload: { approved: false, ...(reason ? { reason } : {}) } }
}
