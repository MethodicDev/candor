"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai"
import { useCandorChat } from "@/components/use-candor-chat"
import type { AgentIdentity } from "@/lib/chat"
import { toolTitle } from "@/app/_lib/tool-title"
import { ChatView } from "./chat-view"

const agent: AgentIdentity = { id: "assistant", name: "Assistant", role: "assistant" }
const transport = new DefaultChatTransport({ api: "/api/chat" })

/** The chat on the Vercel AI SDK: useChat runs it, useCandorChat maps it to Candor's components. */
export function AiSdkChat() {
  // After the person answers an approval, send the answer back so the agent can go on.
  const chat = useChat({ transport, sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses })
  const candor = useCandorChat(chat, { agent, toolTitle })
  return <ChatView chat={candor} />
}
