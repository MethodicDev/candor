"use client"

import * as React from "react"
import { ShieldCheck } from "lucide-react"
import { Composer } from "@/components/composer"
import { Message } from "@/components/message"
import { PromptSuggestions } from "@/components/prompt-suggestions"
import { Thread } from "@/components/thread"
import { Button } from "@/components/ui/button"
import type { Message as MessageData } from "@/lib/chat"
import { toolTitle } from "@/app/_lib/tool-title"

/** What either adapter hook returns (useCandorChat or useClaudeAgent): this view works with both. */
export type ChatState = {
  messages: MessageData[]
  composer: React.ComponentProps<typeof Composer>
  approvals: { id: string; tool: string; input?: unknown; title?: string }[]
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
 * tool calls), Composer and PromptSuggestions. Tool calls that need a person's
 * OK show above the composer until they answer.
 */
export function ChatView({ chat }: { chat: ChatState }) {
  const { messages, composer, approvals, respond, error } = chat

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
            <div
              key={a.id}
              role="group"
              aria-label="Waiting for your go-ahead"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/50 bg-warning-weak/60 px-3 py-2 text-sm"
            >
              <ShieldCheck aria-hidden className="size-4 text-warning-text" />
              <span className="min-w-0 flex-1">{`The agent wants to: ${toolTitle(a.tool, a.input) ?? a.title ?? a.tool}.`}</span>
              <Button size="xs" variant="ghost" onClick={() => void respond(a.id, false, "Not now")}>
                Deny
              </Button>
              <Button size="xs" variant="outline" onClick={() => void respond(a.id, true)}>
                Allow
              </Button>
            </div>
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
