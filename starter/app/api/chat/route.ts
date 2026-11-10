import { anthropic } from "@ai-sdk/anthropic"
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai"
import { z } from "zod"
import { crossSite, crossSiteRefused } from "@/app/_lib/cross-site"
import { addTask, instructions, listTasks } from "@/app/_lib/tasks"

export const maxDuration = 60

/**
 * The agent on the Vercel AI SDK 7. Needs ANTHROPIC_API_KEY. Set
 * CANDOR_APPROVAL_SECRET too, so a browser can't approve a call the server
 * never asked about.
 */
export async function POST(request: Request) {
  // Another site's page can't make a signed-in person's browser start a run here.
  if (crossSite(request)) return crossSiteRefused()
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY isn't set on the server, so the agent can't run.", { status: 503 })
  }
  const { messages } = (await request.json()) as { messages: UIMessage[] }

  const result = streamText({
    model: anthropic("claude-opus-5-5"),
    system: instructions,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    // Calls a person must OK first. Reading runs at once; adding a task waits for the person.
    toolApproval: { addTask: "user-approval" },
    // Signs each approval request, so only approvals the server asked for are accepted.
    experimental_toolApprovalSecret: process.env.CANDOR_APPROVAL_SECRET,
    tools: {
      listTasks: tool({
        description: "List the person's to-do list.",
        inputSchema: z.object({}),
        execute: async () => listTasks(),
      }),
      addTask: tool({
        description: "Add a task to the person's to-do list.",
        inputSchema: z.object({ title: z.string().min(1).max(200).describe("The task, in a few words") }),
        execute: async ({ title }) => addTask(title),
      }),
    },
  })

  return result.toUIMessageStreamResponse({
    // The browser gets a plain sentence; the details stay in the server log.
    onError: (error) => {
      console.error("Agent request failed:", error)
      return "The agent stopped because of an error on the server."
    },
  })
}
