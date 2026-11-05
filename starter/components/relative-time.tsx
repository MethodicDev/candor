"use client"

import * as React from "react"

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
]

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

export function formatRelative(date: Date, now = new Date()) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  if (Math.abs(seconds) < 10) return "just now"
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "second") return rtf.format(Math.round(seconds / size), unit)
  }
  return ""
}

/*
 * One shared clock for every relative time on the page. During server rendering (and React's hydration pass) there's
 * no "now" to read, so useNow returns null and components show a fixed date until the browser takes over. That keeps
 * server and browser output identical, and lets frameworks prerender pages without reading the clock.
 */
const listeners = new Set<() => void>()
let now = 0
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 30_000)
  }
  return () => {
    listeners.delete(onChange)
    if (!listeners.size) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** The current time in milliseconds, updated every 30 seconds; null while rendering on the server. */
export function useNow(): number | null {
  return React.useSyncExternalStore(
    subscribe,
    () => now || (now = Date.now()),
    () => null
  )
}

/** "3 minutes ago" / "in 6 days", kept fresh, with the exact time on hover. Shows the date until the clock is known. */
function RelativeTime({
  date,
  bare = false,
  className,
}: {
  /** When it happened. Shown as "5 minutes ago", with the exact time on hover. */
  date: Date | string
  /** Drop "ago" and "in", for tight spaces: "5 minutes". */
  bare?: boolean
  className?: string
}) {
  const d = typeof date === "string" ? new Date(date) : date
  const current = useNow()
  let text = current === null ? d.toISOString().slice(0, 10) : formatRelative(d, new Date(current))
  if (bare) text = text.replace(/ ago$/, "").replace(/^in /, "")
  return (
    <time dateTime={d.toISOString()} title={current === null ? undefined : d.toLocaleString()} className={className}>
      {text}
    </time>
  )
}

export { RelativeTime }
