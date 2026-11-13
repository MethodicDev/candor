import * as React from "react"
import type { UIMessage } from "ai"
import type { UseChatHelpers } from "@ai-sdk/react"
import type { ComposerState } from "@/registry/chat/composer"
import type { EntityRef, MessageData } from "@/registry/foundation/chat"
import { fromAiSdkMessages, type FromAiSdkOptions } from "@/registry/adapters/ai-sdk"

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
    () => fromAiSdkMessages(chat.messages, { agent, createdAt, toolTitle, summarize, sourcesFrom, chatStatus: chat.status }),
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
