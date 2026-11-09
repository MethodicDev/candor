import { Suspense } from "react"
import { AiSdkChat } from "@/app/_components/ai-sdk-chat"
import { MissingKey } from "@/app/_components/missing-key"
import { PageHeader } from "@/app/_components/page-header"
import { hasAnthropicKey } from "@/app/_lib/has-key"

async function Chat() {
  return (await hasAnthropicKey()) ? <AiSdkChat /> : <MissingKey />
}

export default function Home() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col">
      <PageHeader
        current="/"
        title="Agent chat on the Vercel AI SDK"
        description={
          <>
            <code className="font-mono text-xs">useChat</code> and <code className="font-mono text-xs">useCandorChat</code>, with
            the agent in <code className="font-mono text-xs">app/api/chat/route.ts</code>.
          </>
        }
      />
      <Suspense fallback={<div className="flex-1" />}>
        <Chat />
      </Suspense>
    </main>
  )
}
