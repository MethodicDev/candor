"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { ContextSegment } from "@/registry/lib/know"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/ui/popover"
import { useFormat, useStrings } from "@/registry/blocks/locale"
import { motion } from "@/registry/lib/motion"

/** The ring moving to a new measured value, after the first one was drawn in place. */
const fillMotion = motion("context-meter", "fill", "fill")

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
  files: "var(--faint-foreground)",
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
  React.useEffect(() => setDrawn(true), [])
  return (
    <Popover>
      <PopoverTrigger
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
            stroke={warn ? "var(--warning)" : "var(--primary)"}
            strokeWidth="2.5"
            strokeDasharray={`${pct * c} ${c}`}
            strokeLinecap="round"
            style={fillMotion}
            className={cn(drawn && "cd-fill")}
          />
        </svg>
        {fmt.number(Math.round(pct * 100) / 100, { style: "percent" })}
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
