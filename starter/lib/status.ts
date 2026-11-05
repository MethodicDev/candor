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

export const statusLabel: Record<RunStatus, string> = {
  idle: "Not started",
  queued: "Queued",
  running: "Running",
  waiting: "Needs you",
  blocked: "Blocked",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  skipped: "Skipped",
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
