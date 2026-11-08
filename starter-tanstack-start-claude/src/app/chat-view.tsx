import type { AgentIdentity } from "@/lib/chat"
import { Composer } from "@/components/composer"
import { Message } from "@/components/message"
import { PermissionPrompt } from "@/components/permission-prompt"
import { PromptSuggestions } from "@/components/prompt-suggestions"
import { Thread } from "@/components/thread"
import { useClaudeAgent } from "@/components/use-claude-agent"
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
              request={{ ...a, title: toolTitle(a.tool, a.input) ?? a.title }}
              mode={a.mode}
              onAllow={() => void respond(a.id, true)}
              onDeny={() => void respond(a.id, false, "Not now")}
            />
          ))}
          {error && (
            <p role="alert" className="text-sm text-destructive-text">
              {error}
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
