"use client"

import * as React from "react"
import { useFormat, useStrings, type DateStyle } from "@/registry/blocks/locale"

/** RelativeTime's fixed words; override them under `relativeTime` in LocaleProvider's `strings`. */
export const relativeTimeStrings = {
  justNow: "just now",
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
]

/**
 * "5 minutes ago", "in 6 days", in the locale (the runtime's own when left out). `bare` drops the direction for tight
 * spaces: "5 minutes".
 */
export function formatRelative(
  date: Date,
  now = new Date(),
  { locale, justNow = relativeTimeStrings.justNow, bare = false, numeric = "auto" }: { locale?: string | undefined; justNow?: string | undefined; bare?: boolean | undefined; numeric?: "auto" | "always" | undefined } = {}
) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  if (Math.abs(seconds) < 10) return justNow
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "second") {
      const n = Math.round(seconds / size)
      return bare
        ? new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(Math.abs(n))
        : new Intl.RelativeTimeFormat(locale, { numeric }).format(n, unit)
    }
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

/**
 * "3 minutes ago" / "in 6 days", kept fresh, with the exact time on hover. Shows the date until the clock is known.
 * `bare` shows "3 minutes" and still names the whole phrase, "3 minutes ago", to a screen reader.
 * `format` shows an absolute time instead ("5 Nov 2026, 14:03"), in the locale, with the same server-safe gate.
 */
function RelativeTime({
  date,
  bare = false,
  format = "relative",
  className,
}: {
  /** When it happened. Shown as "5 minutes ago", with the exact time on hover. */
  date: Date | string
  /** Drop "ago" and "in", for tight spaces: "5 minutes". Assistive technology still gets the direction. */
  bare?: boolean | undefined
  /** "relative" (the default), or an absolute "date", "datetime" or "time" in the locale. */
  format?: "relative" | DateStyle | undefined
  className?: string | undefined
}) {
  const d = typeof date === "string" ? new Date(date) : date
  const current = useNow()
  const fmt = useFormat()
  const t = useStrings("relativeTime", relativeTimeStrings)
  const text =
    format !== "relative"
      ? fmt.date(d, format)
      : current === null
        ? d.toISOString().slice(0, 10)
        : formatRelative(d, new Date(current), { locale: fmt.tag, justNow: t("justNow"), bare })
  // A bare time ("2 days") is read aloud without its direction, so a screen reader hears the whole phrase ("2 days ago")
  // while the page keeps the short one. "always" keeps the number ("1 day ago", not "yesterday"), so the spoken words match the shown ones.
  const spoken =
    bare && format === "relative" && current !== null ? formatRelative(d, new Date(current), { locale: fmt.tag, justNow: t("justNow"), numeric: "always" }) : text
  return (
    <time dateTime={d.toISOString()} title={current === null ? undefined : fmt.date(d, "datetime")} className={className}>
      {spoken === text ? (
        text
      ) : (
        <>
          <span aria-hidden>{text}</span>
          <span className="sr-only">{spoken}</span>
        </>
      )}
    </time>
  )
}

export { RelativeTime }
