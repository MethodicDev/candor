import * as React from "react"
import type { AgentIdentity } from "@/lib/candor/chat"
import { Composer } from "@/components/candor/composer"
import { Message } from "@/components/candor/message"
import { PermissionPrompt } from "@/components/candor/permission-prompt"
import { PromptSuggestions } from "@/components/candor/prompt-suggestions"
import { Thread } from "@/components/candor/thread"
import { useClaudeAgent } from "@/components/candor/use-claude-agent"
import { toolTitle } from "./tool-title"

const agent: AgentIdentity = { id: "claude-agent", name: "Claude agent", role: "assistant" }

const suggestions = [
  { id: "s1", text: "What's on my to-do list?" },
  { id: "s2", text: "Add “Try a Candor block” to my list." },
  { id: "s3", text: "What can you do here?" },
]

/**
 * The chat, from Candor's free items: Thread, Message (with its reasoning and tool calls), Composer, PromptSuggestions
 * and PermissionPrompt. useClaudeAgent talks to the routes in src/routes/api/agent: one runs the agent, the other
 * takes your answer to its permission requests. A tool call that needs a person's OK shows above the composer until
 * they answer.
 */
export function ChatView() {
  const { messages, composer, approvals, respond, error } = useClaudeAgent({ api: "/api/agent", approveApi: "/api/agent/approve", agent, toolTitle })
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
          <PromptSuggestions suggestions={suggestions} onChoose={(s) => composer.onValueChange(s.text)} />
        </div>
      }
      footer={
        <div className="flex flex-col gap-2">
          {approvals.map((a) => (
            <PermissionPrompt
              key={a.id}
              request={{ ...a, title: toolTitle(a.tool, a.input) ?? a.title }}
              mode={a.mode}
              onAllow={() => answer(a.id, true)}
              onDeny={() => answer(a.id, false, "Not now")}
              busy={answering.has(a.id)}
              headingLevel={2}
            />
          ))}
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
