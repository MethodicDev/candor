/**
 * The demo's to-do list, kept in server memory so the starter runs with no database. It resets when the server
 * restarts. Replace it with your own data before real use. (`.server.ts`: Start keeps this file out of the browser.)
 */

export type Task = { id: string; title: string; done: boolean }

const tasks: Task[] = [
  { id: "t1", title: "Read the Candor docs", done: false },
  { id: "t2", title: "Install a Candor component", done: true },
]

export function listTasks(): Task[] {
  return tasks.map((t) => ({ ...t }))
}

export function addTask(title: string): Task {
  const task = { id: `t${tasks.length + 1}`, title: title.trim(), done: false }
  tasks.push(task)
  return { ...task }
}

export const instructions = [
  "You are the assistant in the Candor starter app, a demo of Candor UI's chat components.",
  "You can read and add to the person's to-do list with your tools. Adding a task asks the person first.",
  "Keep answers short. If someone asks what this app is, say it's a starter for building agent UIs with Candor.",
].join(" ")
