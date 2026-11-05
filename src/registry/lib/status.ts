import { useStrings } from "@/registry/blocks/locale"

/**
 * The status vocabulary every Candor agent component shares. Components take
 * plain data in these shapes rather than an SDK's message objects, so they work
 * with your own LLM drivers, the Vercel AI SDK or anything else; adapters
 * map an SDK's parts onto them.
 */
export type RunStatus =
  | "idle" // not started
  | "queued" // accepted, waiting for a worker
  | "running" // an agent is working on it now
  | "waiting" // stopped to ask a person (approval, question)
  | "blocked" // can't start: something it depends on failed or is waiting
  | "succeeded"
  | "failed"
  | "cancelled"
  | "skipped"

/** Status words; override them under `status` in LocaleProvider's `strings`. */
export const statusStrings = {
  idle: "Not started",
  queued: "Queued",
  running: "Running",
  waiting: "Needs you",
  blocked: "Blocked",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  skipped: "Skipped",
} satisfies Record<RunStatus, string>

/** English status labels. Kept for compatibility; components use `useStatusLabel()` so they follow the locale. */
export const statusLabel: Record<RunStatus, string> = statusStrings

/** A status's label in the current locale: `const label = useStatusLabel(); label("running")`. */
export function useStatusLabel(): (status: RunStatus) => string {
  const t = useStrings("status", statusStrings)
  return t
}

/** The Badge variant that carries each status. */
export const statusTone = {
  idle: "outline",
  queued: "secondary",
  running: "running",
  waiting: "warning",
  blocked: "outline",
  succeeded: "success",
  failed: "destructive",
  cancelled: "outline",
  skipped: "outline",
} as const satisfies Record<RunStatus, string>

export function isTerminal(status: RunStatus) {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "skipped"
}
