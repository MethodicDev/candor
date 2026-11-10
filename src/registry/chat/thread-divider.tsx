"use client"

import { cn } from "@/lib/utils"
import { useFormat, useLocale, useStrings } from "@/registry/foundation/locale"
import { useNow } from "@/registry/parts/relative-time"

/** ThreadDivider's fixed words; override them under `threadDivider` in LocaleProvider's `strings`. */
export const threadDividerStrings = {
  today: "Today",
  yesterday: "Yesterday",
}

/** The calendar day of a time, as y-m-d in a time zone (the browser's when left out). */
function dayOf(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...(timeZone && { timeZone }) }).format(d)
}

/**
 * A rule across the thread with a label in the middle: a day ("Today", "Yesterday", "5 Nov 2026") or a chapter of
 * the conversation ("Drafting", "Review"). Read by screen readers as a separator with that label. Dates wait for the
 * browser's clock and time zone, like every time in Candor, so server and browser render the same thing.
 */
function ThreadDivider({
  date,
  label,
  className,
}: {
  /** A day to mark, shown as Today, Yesterday or the date in the locale. With neither this nor `label`, a plain rule. */
  date?: Date | string | undefined
  /** A chapter or any other label; wins over `date`. */
  label?: string | undefined
  className?: string | undefined
}) {
  const t = useStrings("threadDivider", threadDividerStrings)
  const fmt = useFormat()
  const now = useNow()
  const { timeZone } = useLocale()
  let text = label ?? ""
  if (!label && date !== undefined) {
    const d = typeof date === "string" ? new Date(date) : date
    if (now !== null) {
      const day = dayOf(d, timeZone)
      const today = dayOf(new Date(now), timeZone)
      const yesterday = dayOf(new Date(now - 86_400_000), timeZone)
      text = day === today ? t("today") : day === yesterday ? t("yesterday") : fmt.date(d, "date")
    } else text = fmt.date(d, "date")
  }
  return (
    <div data-slot="thread-divider" role="separator" aria-label={text || undefined} className={cn("flex items-center gap-3 py-1 text-xs font-medium text-muted-foreground", className)}>
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span aria-hidden>{text}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  )
}

export { ThreadDivider }
