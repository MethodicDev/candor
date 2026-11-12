"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { ContextSegment } from "@/registry/foundation/know"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/ui/popover"
import { useFormat, useStrings } from "@/registry/foundation/locale"
import { motion, useSettled, type SettledTest } from "@/registry/foundation/motion"

/** The ring moving to a new measured value, after the first one was drawn in place. */
const fillMotion = motion("context-meter", "fill", "fill")
/** The percentage changing in place. */
const valueMotion = motion("context-meter", "value", "value")
/** Every new figure counts as a change worth showing. */
const changed: SettledTest<string> = { settled: () => true, over: () => false }

/** ContextMeter's fixed words; override them under `contextMeter` in LocaleProvider's `strings`. */
export const contextMeterStrings = {
  /** A token count in thousands; `{n}` is already formatted. */
  thousands: "{n}k",
  label: "Context: {used} of {limit} tokens used",
  context: "Context",
  usage: "{used} / {limit} tokens",
  nearlyFull: "Nearly full. Older thread turns will be summarised to make room.",
}

const kindColor: Record<ContextSegment["kind"], string> = {
  system: "var(--chart-5)",
  instructions: "var(--chart-1)",
  knowledge: "var(--chart-2)",
  thread: "var(--chart-4)",
  tools: "var(--chart-3)",
  files: "var(--cd-faint-foreground)",
}

function k(n: number, format: (n: number, options?: Intl.NumberFormatOptions) => string, thousands: (n: string) => string) {
  if (n < 1000) return format(n, { useGrouping: false })
  const digits = n >= 10_000 ? 0 : 1
  return thousands(format(n / 1000, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }))
}

/**
 * What fills the model's context budget, as a ring in the composer that
 * opens to a breakdown: system, instructions, Know, the thread, tools, files.
 * Counts are the service's own token counts; the ring warns past 80%. When a
 * new count arrives the ring sweeps to it and changes colour at the warning
 * line; it draws its first value in place, with no sweep from zero.
 *
 * @motion fill:fill The ring moves from the old measured value to the new one when the count changes while the meter is
 * on screen, and changes colour at the warning line. The first value is drawn in place, never swept from empty.
 * @motion value:value The percentage beside the ring crossfades to the new figure in the quick duration when the count
 * changes while the meter is on screen; it never counts through values that were not measured.
 */
function ContextMeter({
  segments,
  limit,
  className,
}: {
  /** What fills the context window, by kind, in tokens. */
  segments: ContextSegment[]
  /** The model's context window, in tokens. */
  limit: number
  className?: string | undefined
}) {
  const t = useStrings("contextMeter", contextMeterStrings)
  const fmt = useFormat()
  const tokens = (n: number) => k(n, fmt.number, (v) => t("thousands", { n: v }))
  const used = segments.reduce((n, s) => n + s.tokens, 0)
  const pct = Math.min(1, used / limit)
  const warn = pct > 0.8
  const r = 7
  const c = 2 * Math.PI * r
  // The sweep is a transition, so it runs only for a value that changed after the first one was drawn.
  const [drawn, setDrawn] = React.useState(false)
  // oxlint-disable-next-line react/set-state-in-effect -- a mount flag: the sweep may animate only for a value that arrives after the first one was drawn, which takes a render after mount
  React.useEffect(() => setDrawn(true), [])
  const percent = fmt.number(Math.round(pct * 100) / 100, { style: "percent" })
  const percentChanges = useSettled(percent, changed)
  return (
    <Popover>
      <PopoverTrigger
        data-slot="context-meter"
        aria-label={t("label", { used: tokens(used), limit: tokens(limit) })}
        data-warn={warn ? "" : undefined}
        className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs tabular-nums outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/80", warn ? "text-warning-text" : "text-muted-foreground", className)}
      >
        <svg viewBox="0 0 18 18" className="size-4 -rotate-90" aria-hidden>
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--muted)" strokeWidth="2.5" />
          <circle
            data-slot="context-meter-ring"
            cx="9"
            cy="9"
            r={r}
            fill="none"
            stroke={warn ? "var(--cd-warning)" : "var(--primary)"}
            strokeWidth="2.5"
            strokeDasharray={`${pct * c} ${c}`}
            strokeLinecap="round"
            style={fillMotion}
            className={cn(drawn && "cd-fill")}
          />
        </svg>
        {percentChanges > 0 ? (
          <span key={percentChanges} style={valueMotion} className="cd-value">
            {percent}
          </span>
        ) : (
          percent
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="flex items-baseline justify-between text-sm font-medium">
          {t("context")} <span className="text-xs font-normal text-muted-foreground tabular-nums">{t("usage", { used: tokens(used), limit: tokens(limit) })}</span>
        </p>
        <div aria-hidden className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
          {segments.map((s) => (
            <span key={s.label} style={{ width: `${(s.tokens / limit) * 100}%`, background: kindColor[s.kind] }} />
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {[...segments]
            .sort((a, b) => b.tokens - a.tokens)
            .map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span aria-hidden className="size-2 rounded-xs" style={{ background: kindColor[s.kind] }} />
                <span className="flex-1">{s.label}</span>
                <span className="text-muted-foreground tabular-nums">{tokens(s.tokens)}</span>
              </li>
            ))}
        </ul>
        {warn && <p className="mt-3 text-xs text-warning-text">{t("nearlyFull")}</p>}
      </PopoverContent>
    </Popover>
  )
}

export { ContextMeter }
