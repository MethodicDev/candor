"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useFormat } from "@/components/candor/locale"
import { motion } from "@/lib/candor/motion"
import { neutralizeBidi } from "@/lib/candor/bidi"
// Re-exported for code that imported it from here; it lives in a module without "use client" so the server can call it.
import { formatElapsed } from "@/lib/candor/format-elapsed"

/**
 * @motion live:caret While the text is still streaming in, a caret blinks at its end. It goes when streaming stops,
 * and under reduced motion it is a still bar.
 */
const caretMotion = motion("streaming-text", "caret", "live", { dur: 1000 })

/** How long a chunk that arrived keeps `data-arrived`, in milliseconds: longer than any drawing for it (200 ms at most). */
const arrivedFor = 600

/**
 * Whether a chunk may be drawn as a block of its own (`data-arrived="short"`): one word of 40 characters or fewer that
 * starts after white space (or at the start), so a block breaks where the word would. The drawing keeps it a block only
 * while nothing follows it, and the next chunk may continue the word.
 */
const isShort = (text: string, from: number, piece: string) => piece.length <= 40 && !/\s/.test(piece) && (from === 0 || /\s/.test(text[from - 1]!))

/** One run of the text after the first draw: where it starts, and whether it is still marked as just arrived. */
type Piece = { from: number; id: number; arrived: boolean }
/** What is drawn: the text (bidi controls marked), and the pieces that came after the first draw. */
type Drawn = { text: string; pieces: Piece[]; next: number }

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null

/**
 * The last place at or before `at` where `text` can be split without breaking a character a person sees as one (a
 * flag, an emoji with a skin tone, a letter with its accents): a grapheme boundary where `Intl.Segmenter` is there,
 * else a code point boundary.
 */
function graphemeFloor(text: string, at: number): number {
  if (at <= 0 || at >= text.length) return Math.max(0, Math.min(at, text.length))
  if (segmenter) {
    // Clusters are short, so only the stretch round `at` is segmented, not the whole reply on every token.
    const start = Math.max(0, at - 64)
    let floor = start
    for (const { index } of segmenter.segment(text.slice(start, at + 64))) {
      if (start + index > at) break
      floor = start + index
    }
    return floor
  }
  const code = text.charCodeAt(at - 1)
  return code >= 0xd800 && code <= 0xdbff ? at - 1 : at
}

/**
 * Text that is still arriving. Shows a caret while `streaming`, and announces
 * politely so screen readers hear the finished text rather than every token.
 *
 * Text that arrives after the first draw is drawn in its own `<span data-arrived>`, one per render that added to the
 * text, split where no character a person sees as one is broken, after bidi controls are marked. The mark goes 600 ms
 * later without the visible text changing, and spans whose mark has gone join the plain text with the next chunk that
 * arrives. Text present at the first draw, and text the app replaces rather than adds to, is plain. Nothing in the
 * free kit draws the mark; the Pro motion-drawings item's `--cd-show-stream` does, so the text is split, and the marks
 * timed, only when the brand names a drawing there (read once, after the first draw): without one, the text is one
 * plain run, as in 4.3, with no timers and no extra renders.
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
  const full = neutralizeBidi(text)
  const ref = React.useRef<HTMLDivElement>(null)
  // Whether the brand names a stream drawing here: read after the first draw, which is always plain anyway.
  const [drawing, setDrawing] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (el && getComputedStyle(el).getPropertyValue("--cd-show-stream").trim() !== "") setDrawing(true)
  }, [])
  const [drawn, setDrawn] = React.useState<Drawn>(() => ({ text: full, pieces: [], next: 0 }))
  if (drawing && drawn.text !== full) {
    if (drawn.text.length < full.length && full.startsWith(drawn.text)) {
      // Added to: the new part arrives, split at a boundary a person sees. Pieces whose mark has gone join the plain
      // text now, in the same change as the new text, so a screen reader hears nothing more than the addition.
      const at = graphemeFloor(full, drawn.text.length)
      const kept = drawn.pieces.filter((p) => p.from < at && p.arrived)
      setDrawn({ text: full, pieces: [...kept, { from: at, id: drawn.next, arrived: true }], next: drawn.next + 1 })
    } else setDrawn({ text: full, pieces: [], next: drawn.next })
  }
  // Each piece's mark goes `arrivedFor` after it arrived, on a timer of its own; the piece stays a span (no text node
  // changes) until the next arrival.
  const marked = drawn.pieces.filter((p) => p.arrived).map((p) => p.id).join(" ")
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>())
  React.useEffect(() => {
    for (const id of marked ? marked.split(" ").map(Number) : []) {
      if (timers.current.has(id)) continue
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id)
          setDrawn((d) => ({ ...d, pieces: d.pieces.map((p) => (p.id === id ? { ...p, arrived: false } : p)) }))
        }, arrivedFor)
      )
    }
  }, [marked])
  React.useEffect(() => {
    const all = timers.current
    return () => {
      for (const timer of all.values()) clearTimeout(timer)
      all.clear()
    }
  }, [])
  const shown = drawing && drawn.text === full ? drawn.pieces : []
  return (
    <div
      ref={ref}
      data-slot="streaming-text"
      aria-live="polite"
      aria-busy={streaming}
      className={cn("whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-foreground", className)}
    >
      {shown.length ? full.slice(0, shown[0]!.from) : full}
      {shown.map((p, i) => {
        const piece = full.slice(p.from, shown[i + 1]?.from ?? full.length)
        return (
          // One word after a space may be drawn as a block of its own (a pop); anything else is drawn inline.
          <span key={p.id} data-arrived={p.arrived ? (isShort(full, p.from, piece) ? "short" : "") : undefined}>
            {piece}
          </span>
        )
      })}
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
