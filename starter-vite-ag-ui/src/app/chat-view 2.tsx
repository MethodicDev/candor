import * as React from "react"
import { Composer } from "@/components/composer"
import { Message } from "@/components/message"
import { PermissionPrompt } from "@/components/permission-prompt"
import { PromptSuggestions } from "@/components/prompt-suggestions"
import { Thread } from "@/components/thread"
import type { AgentIdentity } from "@/lib/chat"
import { useAgUi } from "@/components/use-ag-ui"
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
              onAllow={() => void respond(a.id, true)}
              onDeny={() => void respond(a.id, false, "Not now")}
            />
          ))}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
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
