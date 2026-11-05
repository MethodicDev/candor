import type { Metadata } from "next"
import { Suspense } from "react"
import { ClaudeAgentChat } from "@/app/_components/claude-agent-chat"
import { MissingKey } from "@/app/_components/missing-key"
import { PageHeader } from "@/app/_components/page-header"
import { hasAnthropicKey } from "@/app/_lib/has-key"

export const metadata: Metadata = { title: "Claude Agent SDK · Candor starter" }

async function Chat() {
  return (await hasAnthropicKey()) ? <ClaudeAgentChat /> : <MissingKey />
}

export default function ClaudePage() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col">
      <PageHeader
        current="/claude"
        title="Agent chat on the Claude Agent SDK"
        description={
          <>
            <code className="font-mono text-xs">streamClaudeAgent</code> and <code className="font-mono text-xs">useClaudeAgent</code>,
            with the agent in <code className="font-mono text-xs">app/api/agent/route.ts</code>. Needs a long-running Node server
            (<code className="font-mono text-xs">next start</code>, a container or a VM), not serverless functions: permission
            requests wait in the server&rsquo;s memory.
          </>
        }
      />
      <Suspense fallback={<div className="flex-1" />}>
        <Chat />
      </Suspense>
    </main>
  )
}
