import { createFileRoute } from "@tanstack/react-router"
import { ChatView } from "@/app/chat-view"
import { getHasKey } from "@/app/has-key"
import { MissingKey } from "@/app/missing-key"

export const Route = createFileRoute("/")({
  loader: () => getHasKey(),
  component: Home,
})

function Home() {
  const hasKey = Route.useLoaderData()

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
          <h1 className="text-base font-semibold">Agent chat on TanStack Start and the Claude Agent SDK</h1>
          <p className="text-sm text-muted-foreground">
            <code className="font-mono text-xs">streamClaudeAgent</code> and <code className="font-mono text-xs">useClaudeAgent</code>, with
            the agent in <code className="font-mono text-xs">src/routes/api/agent/index.ts</code>. Needs a long-running Node server
            (<code className="font-mono text-xs">npm start</code>, a container or a VM), not serverless functions: permission requests wait
            in the server&rsquo;s memory.
          </p>
        </div>
      </header>
      {hasKey ? <ChatView /> : <MissingKey />}
    </main>
  )
}
