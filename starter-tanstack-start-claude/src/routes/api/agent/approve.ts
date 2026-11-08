import { createFileRoute } from "@tanstack/react-router"
import { answerClaudeAgentApproval } from "@/components/claude-agent-server"

/** A person's answer to the agent's permission request: `{ id, approved, reason? }`. */
export const Route = createFileRoute("/api/agent/approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { id, approved, reason } = (await request.json()) as { id?: unknown; approved?: unknown; reason?: unknown }
        if (typeof id !== "string" || typeof approved !== "boolean") {
          return Response.json({ ok: false, error: "Send an id and approved." }, { status: 400 })
        }
        return Response.json({ ok: answerClaudeAgentApproval(id, approved, typeof reason === "string" ? reason : undefined) })
      },
    },
  },
})
