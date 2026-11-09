"use client"

import { cn } from "@/lib/utils"
import { useNow } from "@/registry/blocks/relative-time"
import { motion, useSettled } from "@/registry/lib/motion"
import { runLiveness, STALE_AFTER, useStatusLabel, type RunStatus } from "@/registry/lib/status"

/** The pulse while a run is heard from. */
const liveMotion = motion("status-dot", "live", "live")
/** The dot popping into its final colour when the run settles on screen. */
const settleMotion = motion("status-dot", "settle", "pop")

const dotColor: Record<RunStatus, string> = {
  idle: "bg-faint-foreground/60",
  queued: "bg-faint-foreground",
  running: "bg-primary text-accent-text",
  waiting: "bg-warning text-warning-text",
  blocked: "bg-transparent ring-[1.5px] ring-inset ring-faint-foreground",
  succeeded: "bg-success",
  failed: "bg-destructive",
  cancelled: "bg-faint-foreground/60",
  skipped: "bg-faint-foreground/40",
}

/**
 * A small status mark. Running and waiting pulse, since they are the two
 * states a person may need to watch or act on. When one of them reaches done
 * or failed while on screen, the new dot pops into place (too small for a drawn
 * mark); a dot that mounts finished is still. The label is always available
 * to assistive tech; pass `showLabel` to print it too.
 *
 * Live means heard from: with `lastHeardAt`, a running dot pulses only while the
 * run has been heard from within `staleAfter`, and is still (with its word)
 * once it hasn't, or before the page has a clock. Without it the app isn't
 * tracking freshness, and running pulses as before.
 */
function StatusDot({
  status,
  showLabel = false,
  label,
  lastHeardAt,
  staleAfter = STALE_AFTER,
  className,
}: {
  /** Which status to show; running and waiting pulse. */
  status: RunStatus
  /** Print the status name next to the dot. */
  showLabel?: boolean | undefined
  /** Words to use instead of the status name. */
  label?: string | undefined
  /**
   * When the run was last heard from (an event, a heartbeat). A running dot pulses only while this is within
   * `staleAfter`; past it, or when the time can't be read, the dot is still. Left out, the dot doesn't claim to know.
   */
  lastHeardAt?: Date | string | undefined
  /** How long a running run may be silent, in milliseconds, before the dot stops pulsing. Two minutes by default. */
  staleAfter?: number | undefined
  className?: string | undefined
}) {
  const statusLabel = useStatusLabel()
  const text = label ?? statusLabel(status)
  const now = useNow()
  const liveness = runLiveness({ status, lastHeardAt }, now, staleAfter)
  const live = (status === "running" || status === "waiting") && liveness === "live"
  const settled = useSettled(status)
  return (
    <span
      data-slot="status-dot"
      data-status={status}
      data-settled={settled > 0 ? "" : undefined}
      data-liveness={lastHeardAt === undefined ? undefined : liveness}
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      <span
        key={settled}
        aria-hidden
        style={live ? liveMotion : settleMotion}
        className={cn("size-2 shrink-0 rounded-full", dotColor[status], live && "cd-live-dot", settled > 0 && "cd-pop")}
      />
      {showLabel ? <span>{text}</span> : <span className="sr-only">{text}</span>}
    </span>
  )
}

export { StatusDot }
