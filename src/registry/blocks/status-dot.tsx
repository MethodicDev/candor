"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useStatusLabel, type RunStatus } from "@/registry/lib/status"

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

const finished = (status: RunStatus) => status === "succeeded" || status === "failed"
const over = (status: RunStatus) => finished(status) || status === "cancelled" || status === "skipped"

/**
 * How many times the status reached done or failed from an unfinished one while the dot was on screen; zero when it
 * mounted finished, so nothing moves for a change the reader never saw.
 */
function useSettled(status: RunStatus): number {
  const [settled, setSettled] = React.useState(0)
  const previous = React.useRef(status)
  React.useLayoutEffect(() => {
    const was = previous.current
    previous.current = status
    if (was !== status && !over(was) && finished(status)) setSettled((n) => n + 1)
  }, [status])
  return settled
}

/**
 * A small status mark. Running and waiting pulse, since they are the two
 * states a person may need to watch or act on. When one of them reaches done
 * or failed while on screen, the new dot pops into place (too small for a drawn
 * mark); a dot that mounts finished is still. The label is always available
 * to assistive tech; pass `showLabel` to print it too.
 */
function StatusDot({
  status,
  showLabel = false,
  label,
  className,
}: {
  /** Which status to show; running and waiting pulse. */
  status: RunStatus
  /** Print the status name next to the dot. */
  showLabel?: boolean | undefined
  /** Words to use instead of the status name. */
  label?: string | undefined
  className?: string | undefined
}) {
  const statusLabel = useStatusLabel()
  const text = label ?? statusLabel(status)
  const live = status === "running" || status === "waiting"
  const settled = useSettled(status)
  return (
    <span
      data-slot="status-dot"
      data-status={status}
      data-settled={settled > 0 ? "" : undefined}
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      <span
        key={settled}
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", dotColor[status], live && "animate-pulse-dot", settled > 0 && "animate-pop-in")}
      />
      {showLabel ? <span>{text}</span> : <span className="sr-only">{text}</span>}
    </span>
  )
}

export { StatusDot }
