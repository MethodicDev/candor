"use client"

import { CircleAlert, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useStrings } from "@/components/locale"
import { motion } from "@/lib/motion"

const spinMotion = motion("degraded-panel", "busy", "live", { dur: 1000 })

/** DegradedPanel's fixed words; override them under `degradedPanel` in LocaleProvider's `strings`. */
export const degradedPanelStrings = {
  missing: "Missing:",
  retry: "Retry",
  retrying: "Retrying",
}

/**
 * Something couldn't be done. Says what went wrong, what is missing because of
 * it, and offers a retry only when the caller can actually retry (Candor's
 * DegradedPanel: a degraded state names what's missing, never just looks sad).
 */
function DegradedPanel({
  reason,
  missing,
  onRetry,
  retrying = false,
  variant = "block",
  className,
}: {
  /** What went wrong, in a sentence. */
  reason: React.ReactNode
  /** What the person won't see because of it. */
  missing?: React.ReactNode | undefined
  /** Shows a Try again button that calls this. */
  onRetry?: (() => void) | undefined
  /** Shows the retry as in progress. */
  retrying?: boolean | undefined
  /** A boxed panel, or one line inside other content. */
  variant?: "block" | "inline" | undefined
  className?: string | undefined
}) {
  const t = useStrings("degradedPanel", degradedPanelStrings)
  return (
    <div
      data-slot="degraded-panel"
      role="status"
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
        <Button size="xs" variant="outline" onClick={onRetry} disabled={retrying} aria-busy={retrying} className="shrink-0">
          <RotateCw style={spinMotion} className={cn(retrying && "cd-live-spin")} /> {retrying ? t("retrying") : t("retry")}
        </Button>
      )}
    </div>
  )
}

export { DegradedPanel }
