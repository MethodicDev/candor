import { createFileRoute } from "@tanstack/react-router"
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { streamClaudeAgent } from "@/components/claude-agent-server"
import { crossSite, crossSiteRefused } from "@/app/cross-site.server"
import { addTask, instructions, listTasks } from "@/app/tasks.server"

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] })

/**
 * The agent on the Claude Agent SDK. Needs ANTHROPIC_API_KEY, and one long-running Node server: permission requests
 * wait in this process's memory, so serverless functions spread over instances can't answer them.
 */
export const Route = createFileRoute("/api/agent/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Another site's page can't make a signed-in person's browser start a run here.
        if (crossSite(request)) return crossSiteRefused()
        if (!process.env.ANTHROPIC_API_KEY?.trim()) {
          return new Response("ANTHROPIC_API_KEY isn't set on the server, so the agent can't run.", { status: 503 })
        }
        const { prompt, sessionId } = (await request.json()) as { prompt: string; sessionId?: string }

        return streamClaudeAgent(
          ({ canUseTool, abortController }) => {
            const tasks = createSdkMcpServer({
              name: "tasks",
              tools: [
                tool("list_tasks", "List the person's to-do list.", {}, async () => text(listTasks())),
                tool("add_task", "Add a task to the person's to-do list.", { title: z.string().min(1).max(200) }, async ({ title }) => text(addTask(title))),
              ],
            })
            return query({
              prompt,
              options: {
                systemPrompt: instructions,
                model: "claude-opus-5-5",
                mcpServers: { tasks },
                // No built-in tools (files, shell): only the to-do list. Reading runs at once;
                // add_task isn't allowed up front, so it goes through canUseTool and waits for the person.
                tools: [],
                allowedTools: ["mcp__tasks__list_tasks"],
                canUseTool,
                abortController,
                resume: sessionId,
                includePartialMessages: true,
                maxTurns: 5,
                settingSources: [],
              },
            })
          },
          // In your app, pass the signed-in user's id as `owner`, so only they can answer its requests.
          { signal: request.signal }
        )
      },
    },
  },
})
