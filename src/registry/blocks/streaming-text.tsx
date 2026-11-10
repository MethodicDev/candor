"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useFormat } from "@/registry/blocks/locale"
import { motion } from "@/registry/lib/motion"
// Re-exported for code that imported it from here; it lives in a module without "use client" so the server can call it.
import { formatElapsed } from "@/registry/lib/format-elapsed"

/**
 * @motion live:caret While the text is still streaming in, a caret blinks at its end. It goes when streaming stops,
 * and under reduced motion it is a still bar.
 */
const caretMotion = motion("streaming-text", "caret", "live", { dur: 1000 })

/**
 * Text that is still arriving. Shows a caret while `streaming`, and announces
 * politely so screen readers hear the finished text rather than every token.
 */
function StreamingText({
  text,
  streaming = false,
  className,
}: {
  /** The text so far. */
  text: string
  /** Show a caret while more is arriving; announced once when it stops. */
  streaming?: boolean | undefined
  className?: string | undefined
}) {
  return (
    <div
      data-slot="streaming-text"
      aria-live="polite"
      aria-busy={streaming}
      className={cn("whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-foreground", className)}
    >
      {text}
      {streaming && (
        <span
          aria-hidden
          style={caretMotion}
          className="ms-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-primary cd-live-caret"
        />
      )}
    </div>
  )
}

/*
 * One clock for every working-line timer on the page: one timer, ticking every tenth of a second while any is shown. A
 * read between ticks still gets the current time: the shared value is taken afresh when it's a tenth of a second or
 * more old, or when the clock has gone back, so a timer that mounts later never counts from an earlier or later clock.
 * Reads within the same tenth get the same value, as useSyncExternalStore needs. During server rendering and hydration
 * there's no "now", so no time is shown until the browser takes over.
 */
const listeners = new Set<() => void>()
let now = 0
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 100)
  }
  return () => {
    listeners.delete(onChange)
    if (!listeners.size) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

const noop = () => () => {}
function readNow() {
  const current = Date.now()
  if (current - now >= 100 || current < now) now = current
  return now
}

/** Milliseconds since `start`, updated every tenth of a second; null on the server, or with no start. */
function useElapsed(start: number | undefined): number | null {
  const current = React.useSyncExternalStore(start === undefined ? noop : subscribe, start === undefined ? () => null : readNow, () => null)
  return start === undefined || current === null ? null : Math.max(0, current - start)
}

/**
 * A label that shimmers while an agent is working ("Thinking", "Reading the docs"). Given `startedAt`, it also counts
 * the time since then, live: "Thinking · 4.2s". Under reduced motion the shimmer stops and the number still counts.
 * The count is hidden from screen readers, so a control or log the label sits in keeps the same name while it runs.
 */
function ShimmerLabel({
  children,
  startedAt,
  className,
}: {
  children: React.ReactNode
  /**
   * When the work started: when the request went out, as a Date or milliseconds since the epoch. The label then shows
   * the time since, counting until you stop showing the label (when the reply begins). Left out, no time is shown.
   */
  startedAt?: number | Date | undefined
  className?: string | undefined
}) {
  const start = startedAt === undefined ? undefined : typeof startedAt === "number" ? startedAt : startedAt.getTime()
  const elapsed = useElapsed(start !== undefined && Number.isFinite(start) ? start : undefined)
  const format = useFormat()
  if (elapsed === null) return <span className={cn("shimmer-text text-sm font-medium", className)}>{children}</span>
  return (
    <span className={cn("text-sm font-medium", className)}>
      <span className="shimmer-text">{children}</span>
      {/* Seen, not read: it changes ten times a second, inside a button's name or a log a screen reader would re-read. */}
      <span aria-hidden className="text-muted-foreground tabular-nums"> · {formatElapsed(elapsed, format)}</span>
    </span>
  )
}

export { StreamingText, ShimmerLabel, formatElapsed }
