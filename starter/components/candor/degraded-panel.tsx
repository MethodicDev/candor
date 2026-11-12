"use client"

import { CircleAlert, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/candor/ui/button"
import { useStrings } from "@/components/candor/locale"
import { motion } from "@/lib/candor/motion"

/**
 * @motion live:busy While a retry is under way, the retry icon turns in place and the button says it is retrying. It
 * stops when the app ends the retry, and under reduced motion the icon is still.
 */
const spinMotion = motion("degraded-panel", "busy", "live", { dur: 1000 })

/** DegradedPanel's fixed words; override them under `degradedPanel` in LocaleProvider's `strings`. */
export const degradedPanelStrings = {
  /** Before what the person won't see. */
  missing: "Missing:",
  /** The retry button. */
  retry: "Retry",
  /** The retry button while a retry is under way. */
  retrying: "Retrying",
}

/**
 * A degraded result: what went wrong, what is missing because of it, and a
 * retry only when the caller can actually retry. A degraded state names
 * what's missing; it never just looks sad.
 */
function DegradedPanel({
  reason,
  missing,
  onRetry,
  busy = false,
  variant = "block",
  live = true,
  className,
}: {
  /** What went wrong, in a sentence. */
  reason: React.ReactNode
  /** What the person won't see because of it. */
  missing?: React.ReactNode | undefined
  /** Shows a Retry button that calls this. */
  onRetry?: (() => void) | undefined
  /** The retry is under way: the button is disabled, its icon turns, and it says it is retrying. */
  busy?: boolean | undefined
  /** A boxed panel, or one line inside other content. */
  variant?: "block" | "inline" | undefined
  /**
   * Whether the panel is a live region (`role="status"`), so a screen reader reads it when it appears. Left out, true.
   * Set it false only where something else already announces the failure, so it isn't read twice.
   */
  live?: boolean | undefined
  /** Classes, merged with Candor's. */
  className?: string | undefined
}) {
  const t = useStrings("degradedPanel", degradedPanelStrings)
  return (
    <div
      data-slot="degraded-panel"
      role={live ? "status" : undefined}
      className={cn(
        "flex gap-2.5 text-sm",
        variant === "block" ? "items-start rounded-lg border border-warning/40 bg-warning-weak/60 p-3" : "items-center",
        className
      )}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
      <div className="min-w-0 flex-1">
        <p className="text-foreground">{reason}</p>
        {missing && <p className="mt-0.5 text-xs text-muted-foreground">{t("missing")} {missing}</p>}
      </div>
      {onRetry && (
        <Button size="xs" variant="outline" onClick={onRetry} disabled={busy} aria-busy={busy} className="shrink-0">
          <RotateCw style={spinMotion} className={cn(busy && "cd-live-spin")} /> {busy ? t("retrying") : t("retry")}
        </Button>
      )}
    </div>
  )
}

export { DegradedPanel }
