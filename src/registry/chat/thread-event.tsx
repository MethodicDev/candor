"use client"

import * as React from "react"
import { Info, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { RelativeTime } from "@/registry/blocks/relative-time"
import type { DateStyle } from "@/registry/blocks/locale"

/**
 * A quiet, centred line in a thread for something that happened rather than something said: "Sam joined", "Switched
 * to the staging environment", "Run stopped by a guardrail". System messages are drawn with it too, so app events and
 * system lines look the same. Text here is the app's own, never model output.
 */
function ThreadEvent({
  icon: Icon = Info,
  tone = "quiet",
  at,
  timeFormat,
  children,
  className,
  ...props
}: {
  /** The glyph before the text; `null` for none. Default: an info mark. */
  icon?: LucideIcon | null | undefined
  /** "quiet" (the default) or "attention", for an event a reader shouldn't miss. */
  tone?: "quiet" | "attention" | undefined
  /** When it happened, shown after the text as a relative time. */
  at?: string | undefined
  /** "relative" (the default) or an absolute "time", "date" or "datetime" in the locale. */
  timeFormat?: "relative" | DateStyle | undefined
  /** What happened, in a short line. */
  children: React.ReactNode
  className?: string | undefined
} & Omit<React.ComponentProps<"div">, "children">) {
  return (
    <div
      data-slot="thread-event"
      data-tone={tone}
      className={cn("flex items-center justify-center gap-1.5 py-1 text-center text-xs", tone === "attention" ? "text-attention-text" : "text-faint-foreground", className)}
      {...props}
    >
      {Icon && <Icon aria-hidden className="size-3 shrink-0" />}
      {children}
      {at && (
        <>
          <span aria-hidden>·</span>
          <RelativeTime date={at} format={timeFormat} />
        </>
      )}
    </div>
  )
}

export { ThreadEvent }
