type Unit = "second" | "minute"

/** How a measured span reads: the locale it's in and its number format, as LocaleProvider's `useFormat()` gives them. */
export type ElapsedFormat = {
  /** The BCP 47 tag the list of units is joined in; undefined is the runtime's own locale. */
  tag: string | undefined
  /** A number in the locale, with Intl.NumberFormat's options. */
  number: (n: number, options?: Intl.NumberFormatOptions) => string
}

/**
 * A measured span of time in the locale: "4.2s" under ten seconds, "42s" under a minute, then "2m 5s". Rounded down,
 * so it never reads longer than what was measured. In a component, pass `useFormat()` from LocaleProvider. This module
 * has no `"use client"`, so a server component or a server-side replay can call it too, with a format of its own:
 * `formatElapsed(ms, { tag: "en-GB", number: (n, o) => new Intl.NumberFormat("en-GB", o).format(n) })`.
 */
export function formatElapsed(ms: number, format: ElapsedFormat): string {
  const s = Math.max(0, ms) / 1000
  const unit = (n: number, u: Unit, digits = 0) => format.number(n, { style: "unit", unit: u, unitDisplay: "narrow", minimumFractionDigits: digits, maximumFractionDigits: digits })
  if (s < 10) return unit(Math.floor(s * 10) / 10, "second", 1)
  if (s < 60) return unit(Math.floor(s), "second")
  const minutes = Math.floor(s / 60)
  const seconds = Math.floor(s % 60)
  return new Intl.ListFormat(format.tag, { style: "narrow", type: "unit" }).format(seconds ? [unit(minutes, "minute"), unit(seconds, "second")] : [unit(minutes, "minute")])
}
