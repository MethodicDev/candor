import * as React from "react"
import type { AgentIdentity } from "@/lib/candor/chat"
import { ChatView } from "./chat-view"
import { createScriptedAgent } from "./scripted-agent"

/** Set in .env.local. Empty or unset: the scripted agent runs in the browser. */
const agentUrl = import.meta.env.VITE_AGENT_URL?.trim() || undefined

const live: AgentIdentity = { id: "agent", name: "Agent", role: "assistant" }
const scripted: AgentIdentity = { id: "scripted-agent", name: "Scripted agent", role: "assistant" }

export function App() {
  // One scripted agent per page load; it is only used when there is no VITE_AGENT_URL.
  const script = React.useMemo(() => (agentUrl ? undefined : createScriptedAgent()), [])

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col">
      <header className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm font-semibold">Candor starter</p>
          <a className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline" href="https://candor.themethodic.com/docs">
            Candor docs
          </a>
        </div>
        <div>
          <h1 className="text-base font-semibold">Agent chat on AG-UI</h1>
          <p className="text-sm text-muted-foreground">
            {agentUrl ? (
              <>
                <code className="font-mono text-xs">useAgUi</code> is talking to the AG-UI agent at{" "}
                <code className="font-mono text-xs break-all">{agentUrl}</code>.
              </>
            ) : (
              <>
                <code className="font-mono text-xs">VITE_AGENT_URL</code> isn&rsquo;t set, so a scripted agent in this page answers: fixed
                replies, no model. Point the variable at an AG-UI endpoint (LangGraph, CrewAI…) to use a real one.
              </>
            )}
          </p>
        </div>
      </header>
      <ChatView url={agentUrl ?? "/scripted-agent"} agent={agentUrl ? live : scripted} fetch={script} />
    </main>
  )
}
