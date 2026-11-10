import * as React from "react"
import { Composer } from "@/components/candor/composer"
import { Message } from "@/components/candor/message"
import { PermissionPrompt } from "@/components/candor/permission-prompt"
import { PromptSuggestions } from "@/components/candor/prompt-suggestions"
import { Thread } from "@/components/candor/thread"
import type { AgentIdentity } from "@/lib/candor/chat"
import { useAgUi } from "@/components/candor/use-ag-ui"
import { toolTitle } from "./tool-title"

const suggestions = [
  { id: "s1", text: "What's on my to-do list?" },
  { id: "s2", text: "Add “Try a Candor block” to my list." },
  { id: "s3", text: "What can you do here?" },
]

/**
 * The chat, from Candor's free items: Thread, Message (with its reasoning and tool calls), Composer, PromptSuggestions
 * and PermissionPrompt. useAgUi turns the agent's AG-UI events into them. A tool call that needs a person's OK shows
 * above the composer until they answer; the run resumes with the answer.
 */
export function ChatView({ url, agent, fetch }: { url: string; agent: AgentIdentity; fetch?: typeof globalThis.fetch | undefined }) {
  const { messages, composer, approvals, respond, notice, error } = useAgUi({ url, agent, fetch, toolTitle })
  // The approvals whose answer is being sent: their buttons wait, so Allow can't be pressed twice in that time. An
  // answer that fails to send leaves its prompt answerable again and says so. (Pro's useAnsweringApprovals does this.)
  const [answering, setAnswering] = React.useState<ReadonlySet<string>>(() => new Set())
  const [unsent, setUnsent] = React.useState(false)
  // Read synchronously, so a second press before the next render is still ignored.
  const sending = React.useRef(new Set<string>())
  const answer = (id: string, approved: boolean, reason?: string) => {
    if (sending.current.has(id)) return
    sending.current.add(id)
    setUnsent(false)
    setAnswering((ids) => new Set(ids).add(id))
    void Promise.resolve()
      .then(() => respond(id, approved, reason))
      .catch(() => setUnsent(true))
      .finally(() => {
        sending.current.delete(id)
        setAnswering((ids) => new Set([...ids].filter((other) => other !== id)))
      })
  }
  const alertText = error ?? (unsent ? "Your answer wasn’t sent, so the request is still waiting. Answer it again." : undefined)

  return (
    <Thread
      className="min-h-0 flex-1"
      empty={
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Ask the agent about your to-do list. It reads the list on its own and asks you before it adds anything.
          </p>
          <PromptSuggestions suggestions={suggestions} onChoose={(s) => composer.onChange(s.text)} />
        </div>
      }
      footer={
        <div className="flex flex-col gap-2">
          {approvals.map((a) => (
            <PermissionPrompt
              key={a.id}
              request={{ id: a.id, tool: a.tool ?? "tool", input: a.input ?? {}, title: a.tool ? (toolTitle(a.tool, a.input) ?? a.title) : a.title }}
              onAllow={() => answer(a.id, true)}
              onDeny={() => answer(a.id, false, "Not now")}
              busy={answering.has(a.id)}
              headingLevel={2}
            />
          ))}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          {alertText && (
            <p role="alert" className="text-sm text-destructive-text">
              {alertText}
            </p>
          )}
          <Composer {...composer} placeholder="Ask about your to-do list" />
        </div>
      }
    >
      {messages.length ? messages.map((m) => <Message key={m.id} message={m} />) : null}
    </Thread>
  )
}
