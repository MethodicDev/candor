import { EventType, type RunAgentInput } from "@ag-ui/core"

/*
 * A scripted AG-UI agent that runs in the browser, so the starter works with no backend and no model key.
 *
 * It answers the POST that @ag-ui/client's HttpAgent sends, the way an AG-UI server does: one run per request, its
 * events as server-sent events. Ask it about your list and it reads the list on its own; ask it to add something and
 * the run ends on an interrupt, and waits until you answer. Allow or Deny starts the next run, carrying your answer in
 * `resume`. Nothing here is a model: the replies are fixed text. Set VITE_AGENT_URL to talk to a real agent.
 */

type Event = Record<string, unknown> & { type: EventType }
/** An event to send, or a pause in milliseconds. */
type Step = Event | number

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const tasks = [
  { id: "t1", title: "Read the Candor docs", done: false },
  { id: "t2", title: "Install a Candor component", done: true },
]

/** What the person asked to add: the text in quotes, or what follows "add". */
function taskTitle(prompt: string): string {
  const quoted = /[“"']([^“”"']{2,120})[”"']/.exec(prompt)?.[1]
  if (quoted) return quoted.trim()
  return prompt.replace(/^.*?\badd\b/i, "").replace(/\b(to|on|in) (my|the) (to-?do )?(list|tasks?)\b.*$/i, "").replace(/[.?!]+$/, "").trim() || "Try a Candor block"
}

/** A `fetch` that plays the script. Pass it to useAgUi as `fetch`; make one per conversation. */
export function createScriptedAgent(): typeof fetch {
  let ids = 0
  const id = (prefix: string) => `${prefix}-${++ids}`
  // The task being added, kept between the run that asks and the run that resumes.
  let pending: { toolCallId: string; title: string } | undefined

  const text = (value: string): Step[] => {
    const messageId = id("msg")
    const out: Step[] = [{ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" }]
    for (const delta of value.match(/.{1,6}/gs) ?? []) out.push({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta }, 18)
    out.push({ type: EventType.TEXT_MESSAGE_END, messageId })
    return out
  }

  const reasoning = (value: string): Step[] => {
    const messageId = id("think")
    const out: Step[] = [{ type: EventType.REASONING_START, messageId }, { type: EventType.REASONING_MESSAGE_START, messageId, role: "reasoning" }]
    for (const delta of value.match(/.{1,8}/gs) ?? []) out.push({ type: EventType.REASONING_MESSAGE_CONTENT, messageId, delta }, 12)
    out.push({ type: EventType.REASONING_MESSAGE_END, messageId }, { type: EventType.REASONING_END, messageId })
    return out
  }

  const tool = (toolCallId: string, toolCallName: string, args: unknown, result?: string): Step[] => {
    const out: Step[] = [
      { type: EventType.TOOL_CALL_START, toolCallId, toolCallName },
      { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(args) },
      { type: EventType.TOOL_CALL_END, toolCallId },
    ]
    if (result !== undefined) out.push(400, { type: EventType.TOOL_CALL_RESULT, messageId: id("tool"), toolCallId, content: result })
    return out
  }

  const list = () => tasks.map((t) => `${t.done ? "[x]" : "[ ]"} ${t.title}`).join("\n")

  /** The run's events, and how it ends: on success, or on an interrupt that waits for a person. */
  const script = (input: RunAgentInput): { steps: Step[]; outcome: Record<string, unknown> } => {
    const answer = input.resume?.[0]
    if (answer && pending) {
      const { toolCallId, title } = pending
      pending = undefined
      if (answer.status === "resolved") {
        tasks.push({ id: id("task"), title, done: false })
        return {
          steps: [900, { type: EventType.TOOL_CALL_RESULT, messageId: id("tool"), toolCallId, content: `Added “${title}”.` }, ...text(`Done. “${title}” is on your list, which now has ${tasks.length} tasks.`)],
          outcome: { type: "success" },
        }
      }
      return { steps: text(`Understood, I didn't add “${title}”. Your list is unchanged.`), outcome: { type: "success" } }
    }
    // A new message after an unanswered request: the hook already told the agent that request was cancelled.
    pending = undefined

    const last = input.messages.findLast((m) => m.role === "user")
    const prompt = typeof last?.content === "string" ? last.content : ""
    if (/\badd\b/i.test(prompt)) {
      const title = taskTitle(prompt)
      const toolCallId = id("call")
      pending = { toolCallId, title }
      return {
        steps: [
          ...reasoning("Adding a task changes the list, so I should ask before I do it."),
          ...text("I'll add that for you. You'll need to say yes first."),
          ...tool(toolCallId, "add_task", { title }),
        ],
        outcome: {
          type: "interrupt",
          interrupts: [{ id: id("interrupt"), reason: "tool_approval", message: `The agent wants to add “${title}” to your to-do list`, toolCallId, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() }],
        },
      }
    }
    if (/\b(list|task|to-?do|read)\b/i.test(prompt)) {
      return {
        steps: [
          ...reasoning("Reading the list doesn't change anything, so I can just do it."),
          ...tool(id("call"), "list_tasks", {}, list()),
          ...text(`You have ${tasks.length} tasks, ${tasks.filter((t) => t.done).length} done:\n\n${tasks.map((t) => `- ${t.done ? "~~" : ""}${t.title}${t.done ? "~~" : ""}`).join("\n")}`),
        ],
        outcome: { type: "success" },
      }
    }
    return {
      steps: text(
        "I'm a scripted agent that runs in your browser, not a model. Ask “What's on my to-do list?” and I'll read it, or ask me to add a task and I'll wait for your OK first. To talk to a real agent, set `VITE_AGENT_URL` (see the README)."
      ),
      outcome: { type: "success" },
    }
  }

  return async (_url, init) => {
    const input = JSON.parse(String(init?.body ?? "{}")) as RunAgentInput
    const signal = init?.signal
    const { steps, outcome } = script(input)
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        // A real fetch fails the body when its request is aborted; this one does the same.
        signal?.addEventListener("abort", () => controller.error(new DOMException("The run was stopped.", "AbortError")))
        const emit = (e: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
        emit({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId })
        for (const step of steps) {
          if (signal?.aborted) return
          if (typeof step === "number") await wait(step)
          else emit(step)
        }
        if (signal?.aborted) return
        emit({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId, outcome })
        controller.close()
      },
    })
    return new Response(stream, { headers: { "content-type": "text/event-stream" } })
  }
}
