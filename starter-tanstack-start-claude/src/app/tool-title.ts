/**
 * Plain-words titles for the demo's tool calls, shared by both adapters. The AI
 * SDK names them listTasks / addTask; the Claude Agent SDK, mcp__tasks__list_tasks
 * / mcp__tasks__add_task. Unknown tools fall back to Candor's default.
 */
export function toolTitle(tool: string, input: unknown): string | undefined {
  const name = tool.replace(/^mcp__tasks__/, "").replace(/_/g, "").toLowerCase()
  if (name === "listtasks") return "Read your to-do list"
  if (name === "addtask") {
    const title = typeof input === "object" && input && "title" in input ? String((input as { title: unknown }).title) : ""
    return title ? `Add “${title}” to your to-do list` : "Add a task to your to-do list"
  }
  return undefined
}
