import { cn } from "@/lib/utils"
import { statusLabel, type RunStatus } from "@/registry/lib/status"

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
 * states a person may need to watch or act on. The label is always available
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
  showLabel?: boolean
  /** Words to use instead of the status name. */
  label?: string
  className?: string
}) {
  const text = label ?? statusLabel[status]
  const live = status === "running" || status === "waiting"
  return (
    <span
      data-slot="status-dot"
      data-status={status}
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", dotColor[status], live && "animate-pulse-dot")}
      />
      {showLabel ? <span>{text}</span> : <span className="sr-only">{text}</span>}
    </span>
  )
}

export { StatusDot }
