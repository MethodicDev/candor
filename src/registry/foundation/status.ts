import { useStrings } from "@/registry/foundation/locale"

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

/** The machine or worker a run is on, when the app can't reach it. */
export type HostOffline = {
  /** The host's name as the app knows it: "Build runner 3", "Priya’s laptop". Left out, it's "The host". */
  host?: string | undefined
  /** When the app lost contact. */
  since?: string | undefined
}

/**
 * Whether a run can be called alive. "live": heard from recently, or the app doesn't track it. "stale": running, but
 * nothing heard for longer than `staleAfter`, so it may have stopped. "offline": its host can't be reached.
 * "unchecked": there's no clock yet (rendering on the server), so freshness isn't claimed either way. "settled": it
 * has finished, so silence is expected. Only a running run goes stale: a queued or waiting one is quiet by design.
 */
export type RunLiveness = "live" | "stale" | "offline" | "unchecked" | "settled"

/** Two minutes: the default silence after which a running run is no longer called running. */
export const STALE_AFTER = 120_000

export function runLiveness(
  run: { status: RunStatus; lastHeardAt?: Date | string | undefined; hostOffline?: HostOffline | undefined },
  now: number | null,
  staleAfter = STALE_AFTER
): RunLiveness {
  if (isTerminal(run.status)) return "settled"
  if (run.hostOffline) return "offline"
  if (run.status !== "running" || run.lastHeardAt === undefined) return "live"
  const heard = new Date(run.lastHeardAt).getTime()
  // An unreadable time ("", "10:42") is no evidence the run is alive.
  if (Number.isNaN(heard)) return "stale"
  if (now === null) return "unchecked"
  return now - heard > staleAfter ? "stale" : "live"
}
