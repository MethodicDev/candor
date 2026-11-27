"use client"

import * as React from "react"
import { Composer } from "@/components/candor/composer"
import { Message } from "@/components/candor/message"
import { PermissionPrompt } from "@/components/candor/permission-prompt"
import { PromptSuggestions } from "@/components/candor/prompt-suggestions"
import { Thread } from "@/components/candor/thread"
import type { MessageData, ToolCallData } from "@/lib/candor/chat"
import { toolTitle } from "@/app/_lib/tool-title"

/** What either adapter hook returns (useCandorChat or useClaudeAgent): this view works with both. */
export type ChatState = {
  messages: MessageData[]
  composer: React.ComponentProps<typeof Composer>
  /** Each approval names its tool call: `toolCallId` from useCandorChat, `toolUseId` from useClaudeAgent. */
  approvals: { id: string; tool: string; input?: unknown; title?: string; toolCallId?: string; toolUseId?: string }[]
  respond: (id: string, approved: boolean, reason?: string) => unknown
  error?: string
}

const suggestions = [
  { id: "s1", text: "What's on my to-do list?" },
  { id: "s2", text: "Add “Try a Candor block” to my list." },
  { id: "s3", text: "What can you do here?" },
]

/**
 * The chat, from Candor's free items: Thread, Message (with its reasoning and
 * tool calls), Composer, PromptSuggestions and PermissionPrompt. A tool call that
 * needs a person's OK shows its prompt in the reply, under the call, until they answer.
 */
export function ChatView({ chat }: { chat: ChatState }) {
  const { messages, composer, approvals, respond, error } = chat
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

  // An approval sits in the reply, under the tool call it is about (Message's `waiting`), and scrolls with the
  // conversation; one whose call isn't in the thread waits above the composer.
  const ask = (a: (typeof approvals)[number]) => (
    <PermissionPrompt
      key={a.id}
      request={{ id: a.id, tool: a.tool, input: a.input, title: `The agent wants to: ${toolTitle(a.tool, a.input) ?? a.title ?? a.tool}.` }}
      onAllow={() => answer(a.id, true)}
      onDeny={() => answer(a.id, false, "Not now")}
      busy={answering.has(a.id)}
      headingLevel={2}
    />
  )
  const inThread = new Set(messages.flatMap((m) => m.blocks.flatMap((b) => (b.kind === "tools" ? b.calls.filter((c) => c.status === "waiting").map((c) => c.id) : []))))
  const waiting = (call: ToolCallData) => {
    const a = approvals.find((ap) => (ap.toolCallId ?? ap.toolUseId) === call.id)
    return a ? ask(a) : null
  }
  const docked = approvals.filter((a) => {
    const id = a.toolCallId ?? a.toolUseId
    return id === undefined || !inThread.has(id)
  })

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
          {docked.map(ask)}
          {alertText && (
            <p role="alert" className="text-sm text-destructive-text">
              {alertText}
            </p>
          )}
          <Composer {...composer} placeholder="Ask about your to-do list" />
        </div>
      }
    >
      {messages.length ? messages.map((m) => <Message key={m.id} message={m} waiting={waiting} />) : null}
    </Thread>
  )
}
