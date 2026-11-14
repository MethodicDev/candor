import * as React from "react"
import type { UIMessage } from "ai"
import type { UseChatHelpers } from "@ai-sdk/react"
import type { ComposerState } from "@/registry/chat/composer"
import type { EntityRef, MessageData } from "@/registry/foundation/chat"
import { fromAiSdkMessage, type FromAiSdkOptions } from "@/registry/adapters/ai-sdk"

export type PendingApproval = { id: string; toolCallId: string; tool: string; input: unknown; reason?: string | undefined }

/**
 * Wires a `useChat()` result to Candor: messages for <Thread>/<Message>, props
 * for <Composer>, and the tool calls waiting on a person. Configure useChat
 * however you like (transport, tools, onFinish); this only reads it.
 *
 * Mentions in the composer are sent as structured references in the request
 * body (`references`), not pasted into the text, so the server gets ids.
 *
 *   const chat = useChat({ transport })
 *   const { messages, composer, approvals, respond } = useCandorChat(chat, { agent })
 *   <Thread footer={<Composer {...composer} />}>{messages.map((m) => <Message key={m.id} message={m} />)}</Thread>
 */
export function useCandorChat(chat: UseChatHelpers<UIMessage>, options: Omit<FromAiSdkOptions, "chatStatus">) {
  const [value, setValue] = React.useState("")
  const [references, setReferences] = React.useState<EntityRef[]>([])
  const { agent, createdAt, toolTitle, summarize, sourcesFrom } = options

  const messages: MessageData[] = React.useMemo(
    () => convertMessages(chat.messages, { agent, createdAt, toolTitle, summarize, sourcesFrom, chatStatus: chat.status }),
    [chat.messages, chat.status, agent, createdAt, toolTitle, summarize, sourcesFrom]
  )

  const state: ComposerState = chat.status === "submitted" ? "sending" : chat.status === "streaming" ? "streaming" : "ready"

  const approvals: PendingApproval[] = React.useMemo(() => {
    const last = chat.messages.findLast((m) => m.role === "assistant")
    if (!last) return []
    return last.parts.flatMap((p) => {
      const t = p as { type: string; state?: string | undefined; toolCallId?: string | undefined; toolName?: string | undefined; input?: unknown; approval?: { id: string; requestReason?: string | undefined } | undefined }
      if (t.state !== "approval-requested" || !t.approval || !t.toolCallId) return []
      return [{ id: t.approval.id, toolCallId: t.toolCallId, tool: t.toolName ?? t.type.replace(/^tool-/, ""), input: t.input, reason: t.approval.requestReason }]
    })
  }, [chat.messages])

  const { sendMessage, stop, addToolApprovalResponse } = chat
  const respond = React.useCallback((approvalId: string, approved: boolean, reason?: string) => addToolApprovalResponse({ id: approvalId, approved, ...(reason !== undefined && { reason }) }), [addToolApprovalResponse])

  return {
    messages,
    approvals,
    respond,
    /** The request failed; say so, and offer to try again with `chat.regenerate()`. */
    error: chat.error?.message,
    composer: {
      value,
      onValueChange: setValue,
      state,
      references,
      onReferencesChange: setReferences,
      onStop: stop,
      onSubmit: (text: string, refs: EntityRef[]) => {
        if (!text.trim()) return
        void sendMessage({ text }, refs.length ? { body: { references: refs } } : undefined)
        setValue("")
        setReferences([])
      },
    },
  }
}

/*
 * While a reply streams, useChat gives a new message list for every chunk, but only the message that changed is a new
 * object: the others keep their identity. So each message's conversion is kept, by the message object, with the
 * options it was converted with, and used again while the message and every option are the same objects. A message
 * converts on its own (its sources, tool results and approvals are all in its own parts); only its status reads the
 * chat's, so the last reply is always converted again.
 */
type Converted = { options: Omit<FromAiSdkOptions, "chatStatus">; data: MessageData }
const converted = new WeakMap<UIMessage, Converted>()

const sameOptions = (a: Omit<FromAiSdkOptions, "chatStatus">, b: Omit<FromAiSdkOptions, "chatStatus">) =>
  a.agent === b.agent && a.createdAt === b.createdAt && a.toolTitle === b.toolTitle && a.summarize === b.summarize && a.sourcesFrom === b.sourcesFrom

/** `fromAiSdkMessages`, converting only the messages that changed since the last call. The output is the same. */
function convertMessages(messages: UIMessage[], { chatStatus, ...options }: FromAiSdkOptions): MessageData[] {
  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant")
  return messages.map((m, i) => {
    if (i === lastAssistant) return fromAiSdkMessage(m, { ...options, chatStatus, last: true })
    const kept = converted.get(m)
    if (kept && sameOptions(kept.options, options)) return kept.data
    const data = fromAiSdkMessage(m, { ...options, chatStatus, last: false })
    converted.set(m, { options, data })
    return data
  })
}
