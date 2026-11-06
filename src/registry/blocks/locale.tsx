"use client"

import * as React from "react"
import { Direction } from "radix-ui"

/**
 * The interface's words, language and direction. Every fixed string in Candor (labels, buttons, screen-reader text,
 * "just now") reads from here, with English as the default, and dates and numbers follow the locale. Terms stays for
 * the app's own nouns ("environment", "account").
 *
 * Each component keeps its English defaults in an exported table named after it (`threadStrings`, `composerStrings`),
 * and you override any of them under the component's registry name in camelCase (`thread`, `relativeTime`,
 * `commandPalette`):
 *
 *   <LocaleProvider locale="fr" strings={{ thread: { jumpToLatest: "Aller au plus récent" } }}>
 *
 * A string can hold `{name}` placeholders, and a count can choose between plural forms
 * (`{ one: "{count} file", other: "{count} files" }`), so every override stays plain, serialisable data that a
 * server component can pass.
 */

/** One string, or its plural forms chosen by `count`; `{name}` placeholders are filled in. */
export type Phrase = string | ({ other: string } & Partial<Record<Intl.LDMLPluralRule, string>>)

/** A component's strings: its English defaults, or your overrides. */
export type StringTable = Record<string, Phrase>

/** Overrides by component name, e.g. `{ thread: { jumpToLatest: "…" }, composer: { send: "…" } }`. */
export type StringOverrides = Record<string, Partial<StringTable> | undefined>

export type TextDirection = "ltr" | "rtl"

type LocaleState = {
  locale?: string | undefined
  timeZone?: string | undefined
  dir: TextDirection
  strings: StringOverrides
}

const LocaleContext = React.createContext<LocaleState>({ dir: "ltr", strings: {} })

// Scripts written right to left, by language subtag. Intl.Locale's text info isn't in every browser yet.
const rtlLanguages = new Set(["ar", "arc", "ckb", "dv", "fa", "he", "iw", "ks", "ku", "ps", "sd", "syr", "ug", "ur", "yi"])

/** "rtl" for Arabic, Hebrew, Persian, Urdu and the like; "ltr" otherwise. */
export function directionOf(locale: string | undefined): TextDirection {
  if (!locale) return "ltr"
  try {
    const l = new Intl.Locale(locale)
    if (l.script) return ["Arab", "Hebr", "Thaa", "Syrc", "Nkoo", "Adlm", "Rohg"].includes(l.script) ? "rtl" : "ltr"
    return rtlLanguages.has(l.language) ? "rtl" : "ltr"
  } catch {
    return "ltr"
  }
}

function LocaleProvider({
  locale,
  dir,
  timeZone,
  strings,
  children,
}: {
  /** A BCP 47 tag such as "en-GB", "fr" or "ar-EG", for dates, numbers and plural forms. Left out, the browser's own is used once the page has hydrated. */
  locale?: string | undefined
  /** Text direction. Left out, it follows the locale: "rtl" for Arabic, Hebrew, Persian, Urdu and the like. Set `dir` on `<html>` too, so the page's own layout flips with Candor's. */
  dir?: TextDirection | undefined
  /** An IANA time zone such as "Europe/Paris". With `locale`, server and browser format dates the same way, so absolute times render on the server too. */
  timeZone?: string | undefined
  /** Overrides by component name, e.g. `{ thread: { jumpToLatest: "…" } }`; any left out stay English. Nested providers merge. */
  strings?: StringOverrides | undefined
  children: React.ReactNode
}) {
  const parent = React.useContext(LocaleContext)
  const nextLocale = locale ?? parent.locale
  // `strings` is usually an inline object; keyed by its content so consumers don't re-render on every render here.
  const stringsKey = JSON.stringify(strings ?? {})
  const value = React.useMemo<LocaleState>(() => {
    const merged: StringOverrides = { ...parent.strings }
    for (const [name, table] of Object.entries(strings ?? {})) merged[name] = { ...parent.strings[name], ...table }
    return {
      locale: nextLocale,
      timeZone: timeZone ?? parent.timeZone,
      dir: dir ?? (locale ? directionOf(locale) : parent.dir),
      strings: merged,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `strings` is tracked by its content (stringsKey)
  }, [parent, nextLocale, locale, timeZone, dir, stringsKey])
  return (
    <LocaleContext.Provider value={value}>
      <Direction.Provider dir={value.dir}>{children}</Direction.Provider>
    </LocaleContext.Provider>
  )
}

/** The locale, time zone and text direction in effect. */
function useLocale(): { locale?: string | undefined; timeZone?: string | undefined; dir: TextDirection } {
  const { locale, timeZone, dir } = React.useContext(LocaleContext)
  return { locale, timeZone, dir }
}

const noop = () => () => {}

/**
 * False while rendering on the server and during React's hydration pass, true after. Anything that depends on the
 * browser (its locale, its time zone) waits for true, so server and browser render the same markup.
 */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    noop,
    () => true,
    () => false
  )
}

/** How an absolute time reads: "5 Nov 2026", "5 Nov 2026, 14:03" or "14:03". */
export type DateStyle = "date" | "datetime" | "time"

const dateOptions: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { dateStyle: "medium" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
  time: { timeStyle: "short" },
}

/** The ISO form shown before hydration: the same on server and browser, in UTC, and says so. */
function isoText(d: Date, style: DateStyle): string {
  const iso = d.toISOString()
  if (style === "date") return iso.slice(0, 10)
  if (style === "time") return `${iso.slice(11, 16)} UTC`
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

export type Formatter = {
  /** The locale actually used right now; "en-US" before hydration when no locale is set. */
  tag: string | undefined
  /** A number in the locale: "1,234.5", "1 234,5". */
  number: (n: number, options?: Intl.NumberFormatOptions) => string
  /** An absolute time. Until the page hydrates it reads as an ISO date in UTC, unless both `locale` and `timeZone` are set. */
  date: (date: Date | string | number, style?: DateStyle) => string
  /** Items joined as the locale does: "A, B and C". */
  list: (items: string[], type?: "conjunction" | "disjunction") => string
}

/**
 * Locale-aware formatting that's safe to render on the server. With no `locale` set, numbers use "en-US" until the
 * page hydrates and then the browser's locale; dates show their ISO form until then. Set `locale` (and `timeZone`
 * for dates) on the provider to render the final text on the server.
 */
function useFormat(): Formatter {
  const { locale, timeZone } = React.useContext(LocaleContext)
  const hydrated = useHydrated()
  return React.useMemo(() => {
    const tag = locale ?? (hydrated ? undefined : "en-US")
    const fixedDates = hydrated || Boolean(locale && timeZone)
    return {
      tag,
      number: (n, options) => new Intl.NumberFormat(tag, options).format(n),
      date: (value, style = "datetime") => {
        const d = value instanceof Date ? value : new Date(value)
        if (Number.isNaN(d.getTime())) return String(value)
        if (!fixedDates) return isoText(d, style)
        return new Intl.DateTimeFormat(tag, { ...dateOptions[style], ...(timeZone && { timeZone }) }).format(d)
      },
      list: (items, type = "conjunction") => new Intl.ListFormat(tag, { style: "long", type }).format(items),
    }
  }, [locale, timeZone, hydrated])
}

/** Fill `{name}` placeholders. Numbers go through the locale's number format. */
export function fill(template: string, vars: Record<string, string | number> | undefined, number: (n: number) => string = String): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key]
    return v === undefined ? whole : typeof v === "number" ? number(v) : v
  })
}

/** The plural form for `count`, falling back to `other`. */
export function pick(message: Phrase, count: number | undefined, rules: Intl.PluralRules): string {
  if (typeof message === "string") return message
  if (count === undefined) return message.other
  if (count === 0 && message.zero !== undefined) return message.zero
  return message[rules.select(count)] ?? message.other
}

/**
 * A translated sentence with elements in it: `place(t("signedInAs"), { email: <strong>{email}</strong> })`. Each
 * `{name}` becomes that node, so translators can move it within the sentence and it keeps its styling.
 */
export function place(text: string, nodes: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? <React.Fragment key={i}>{part in nodes ? nodes[part] : `{${part}}`}</React.Fragment> : part))
}

/** Looks up one string by key and fills its placeholders; `count` also picks the plural form. */
export type Translate<T extends StringTable> = (key: keyof T & string, vars?: Record<string, string | number>) => string

/**
 * A component's strings: `t("jumpToLatest")`, `t("remove", { name })`, `t("files", { count: 3 })`. `name` is the
 * component's registry name in camelCase, the key apps override it under; `defaults` is its English table.
 */
function useStrings<T extends StringTable>(name: string, defaults: T): Translate<T> {
  const { strings, locale } = React.useContext(LocaleContext)
  const format = useFormat()
  const overrides = strings[name]
  return React.useMemo(() => {
    // Plural forms follow the language of the strings: the provider's locale, else English (the defaults). Never the
    // browser's, which would pick Japanese "other" for English "{count} file".
    const rules = new Intl.PluralRules(locale ?? "en-US")
    const number = (n: number) => format.number(n)
    return (key, vars) => {
      const message = overrides?.[key] ?? defaults[key]
      if (message === undefined) return key
      const count = typeof vars?.count === "number" ? vars.count : undefined
      return fill(pick(message, count, rules), vars, number)
    }
  }, [overrides, defaults, format, locale])
}

/** Physical side for the reading direction: "left" in LTR, "right" in RTL. For the few places CSS can't say start. */
function useStartSide(): "left" | "right" {
  return useLocale().dir === "rtl" ? "right" : "left"
}

export { LocaleProvider, useLocale, useFormat, useHydrated, useStrings, useStartSide }
