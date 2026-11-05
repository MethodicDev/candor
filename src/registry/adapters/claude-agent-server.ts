import type { CanUseTool, PermissionResult, Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import type { AgentEvent } from "@/registry/adapters/claude-agent-sdk"

/*
 * The server half of the Claude Agent SDK adapter. Server-only: it runs the
 * agent, which needs Node and your credentials. Never import it in the browser.
 *
 * streamClaudeAgent() runs a query() and streams its messages to useClaudeAgent
 * as newline-delimited JSON. When the SDK asks permission for a tool call, the
 * request goes to the browser and the tool waits until a person answers through
 * answerClaudeAgentApproval() (from a second route), or the run ends.
 *
 * Waiting requests live in this server process's memory, so the answer must
 * reach the same process that runs the agent: fine for one Node server or
 * container, not for serverless functions spread over many instances.
 */

type Waiting = { owner?: string; answer: (approved: boolean, reason?: string) => void }
const waiting = new Map<string, Waiting>()

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
}) => Query

export type StreamClaudeAgentOptions = {
  /** The incoming request's signal (`request.signal`): the agent stops when the browser goes away. */
  signal?: AbortSignal
  /** Who may answer this run's permission requests, e.g. the signed-in user's id. Checked by answerClaudeAgentApproval. */
  owner?: string
  /** The sentence shown when the run fails. Defaults to a generic one, so server errors don't leak to the browser. */
  describeError?: (error: unknown) => string
  /**
   * Called with every SDK message just before it's sent to the browser, e.g. to record usage and cost from
   * `assistant` and `result` messages. To stop the run from here, abort the run's abortController: the message
   * in hand is still sent, and nothing after it.
   */
  onMessage?: (message: SDKMessage) => void | Promise<void>
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
export function streamClaudeAgent(run: RunClaudeAgent, { signal, owner, describeError, onMessage }: StreamClaudeAgentOptions = {}): Response {
  const encoder = new TextEncoder()
  const abortController = new AbortController()
  const mine = new Set<string>()
  let send: (event: AgentEvent) => void = () => {}

  const canUseTool: CanUseTool = (tool, input, request) =>
    new Promise<PermissionResult>((resolve) => {
      const id = crypto.randomUUID()
      const answer = (approved: boolean, reason?: string, interrupt?: boolean) => {
        if (!waiting.delete(id)) return
        mine.delete(id)
        send({ type: "candor_approval_closed", id, approved, reason })
        resolve(
          approved
            ? { behavior: "allow", updatedInput: input }
            : { behavior: "deny", message: reason ? `The user declined: ${reason}` : "The user declined this action.", interrupt }
        )
      }
      waiting.set(id, { owner, answer })
      mine.add(id)
      request.signal.addEventListener("abort", () => answer(false, "The run was stopped.", true), { once: true })
      send({
        type: "candor_approval",
        id,
        toolUseId: request.toolUseID,
        tool,
        input,
        title: request.title,
        description: request.description,
        reason: request.decisionReason,
        blockedPath: request.blockedPath,
        defaultToNo: request.defaultToNo,
      })
    })

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true
      send = (event) => {
        if (open) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      const stop = () => abortController.abort()
      signal?.addEventListener("abort", stop, { once: true })
      try {
        for await (const message of run({ canUseTool, abortController, emit: (event) => send(event) })) {
          // Awaited, so bookkeeping such as recording spend finishes before the next message is handled.
          await onMessage?.(message)
          send(message)
          // Stopped (the browser went away, or onMessage or a tool aborted the run): nothing more is sent.
          if (abortController.signal.aborted) break
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Claude agent run failed:", error)
          send({ type: "candor_error", message: describeError?.(error) ?? "The agent stopped because of an error on the server." })
        }
      } finally {
        // Nobody can answer once the run is over.
        for (const id of [...mine]) waiting.get(id)?.answer(false, "The run ended.")
        open = false
        signal?.removeEventListener("abort", stop)
        controller.close()
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } })
}

/**
 * Answer a waiting permission request. Returns false when there's no such
 * request (already answered, the run ended, or it ran in another process) or
 * `owner` doesn't match the run's owner.
 *
 *   // app/api/agent/approve/route.ts
 *   export async function POST(request: Request) {
 *     const { id, approved, reason } = await request.json()
 *     return Response.json({ ok: answerClaudeAgentApproval(id, approved, reason, userId) })
 *   }
 */
export function answerClaudeAgentApproval(id: string, approved: boolean, reason?: string, owner?: string): boolean {
  const request = waiting.get(id)
  if (!request || (request.owner !== undefined && request.owner !== owner)) return false
  request.answer(approved, reason)
  return true
}
