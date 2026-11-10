"use client"

import { useClaudeAgent } from "@/components/candor/use-claude-agent"
import type { AgentIdentity } from "@/lib/candor/chat"
import { toolTitle } from "@/app/_lib/tool-title"
import { ChatView } from "./chat-view"

const agent: AgentIdentity = { id: "claude-agent", name: "Claude agent", role: "assistant" }

/** The chat on the Claude Agent SDK: app/api/agent runs it, useClaudeAgent maps it to Candor's components. */
export function ClaudeAgentChat() {
  const chat = useClaudeAgent({ api: "/api/agent", approveApi: "/api/agent/approve", agent, toolTitle })
  return <ChatView chat={chat} />
}
