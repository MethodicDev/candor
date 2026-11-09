/**
 * Plain-words titles for the demo agent's tool calls. Arguments stream in, so `input` is undefined until they parse;
 * until then Candor shows the tool's own name. Unknown tools fall back to Candor's default.
 */
export function toolTitle(tool: string, input: unknown): string | undefined {
  if (tool === "list_tasks") return "Read your to-do list"
  if (tool === "add_task") {
    const title = typeof input === "object" && input && "title" in input ? String((input as { title: unknown }).title) : ""
    return title ? `Add “${title}” to your to-do list` : "Add a task to your to-do list"
  }
  return undefined
}
