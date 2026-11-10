"use client"

import * as React from "react"
import { Direction } from "radix-ui"
import {
  fill,
  nounDefaults,
  pick,
  singularNouns,
  startOf,
  withNouns,
  type Noun,
  type NounTable,
  type Nouns,
  type Phrase,
  type PluralPhrase,
  type SelectPhrase,
} from "@/lib/candor/fill-strings"

/**
 * The interface's words, language and direction. Every fixed string in Candor (labels, buttons, screen-reader text,
 * "just now") reads from here, with English as the default, and dates and numbers follow the locale. The app's own
 * nouns ("environment", "account", "product") are set here too, and fill its messages.
 *
 * Each component keeps its English defaults in an exported table named after it (`threadStrings`, `composerStrings`),
 * and you override any of them under the component's registry name in camelCase (`thread`, `relativeTime`,
 * `commandPalette`):
 *
 *   <LocaleProvider locale="fr" strings={{ thread: { jumpToLatest: "Aller au plus récent" } }}>
 *
 * A string can hold `{name}` placeholders, a count can choose between plural forms
 * (`{ one: "{count} file", other: "{count} files" }`), and a word can choose between cases
 * (`{ select: "environment", cases: { feminine: "…", other: "…" } }`), so every override stays plain, serialisable data
 * that a server component can pass.
 *
 * The app's nouns are message arguments: `{environment}` in any message reads the app's word for it, in the form the
 * message's `count` picks, and `{Environment}` reads it at the start of a sentence.
 *
 *   <LocaleProvider nouns={{ environment: { one: "workspace", other: "workspaces" }, account: "team" }}>
 */

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
  nouns: NounTable
  singular: Nouns
}

const LocaleContext = React.createContext<LocaleState>({ dir: "ltr", strings: {}, nouns: nounDefaults, singular: singularNouns(nounDefaults) })

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
  nouns,
  children,
}: {
  /** A BCP 47 tag such as "en-GB", "fr" or "ar-EG", for dates, numbers and plural forms. Left out, the browser's own is used once the page has hydrated. */
  locale?: string | undefined
  /** Text direction. Left out, it follows the locale: "rtl" for Arabic, Hebrew, Persian, Urdu and the like. Set `dir` on `<html>` too, so the page's own layout flips with Candor's. */
  dir?: TextDirection | undefined
  /** An IANA time zone such as "Europe/Paris". With `locale`, server and browser format dates the same way, so absolute times render on the server too. */
  timeZone?: string | undefined
  /**
   * Overrides by component name, e.g. `{ thread: { jumpToLatest: "…" } }`; any left out stay English. Nested providers
   * merge. One exception to the name: ChangeDiff's strings go under `metadataDiff`, its name before 3.0.
   */
  strings?: StringOverrides | undefined
  /**
   * The app's nouns, which fill `{environment}`, `{environments}`, `{account}` and `{product}` in every message, and
   * any noun of the app's own that its overrides name. A word, or plural forms (`{ one: "workspace", other:
   * "workspaces" }`), with an optional `gender` for select messages and `start` for the start of a sentence. Any left
   * out stay Candor's; nested providers merge noun by noun. An `environment` with an `other` form and no
   * `environments` gives `environments` that form; an `environments` you set wins.
   */
  nouns?: Partial<NounTable> | undefined
  children: React.ReactNode
}) {
  const parent = React.useContext(LocaleContext)
  const nextLocale = locale ?? parent.locale
  // `strings` is usually an inline object; keyed by its content so consumers don't re-render on every render here.
  const stringsKey = JSON.stringify(strings ?? {})
  const nounsKey = JSON.stringify(nouns ?? {})
  const value = React.useMemo<LocaleState>(() => {
    const merged: StringOverrides = { ...parent.strings }
    for (const [name, table] of Object.entries(strings ?? {})) merged[name] = { ...parent.strings[name], ...table }
    const nounTable = nounsKey === "{}" ? parent.nouns : withNouns(parent.nouns, JSON.parse(nounsKey) as Partial<NounTable>)
    return {
      locale: nextLocale,
      timeZone: timeZone ?? parent.timeZone,
      dir: dir ?? (locale ? directionOf(locale) : parent.dir),
      strings: merged,
      nouns: nounTable,
      singular: nounTable === parent.nouns ? parent.singular : singularNouns(nounTable),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `strings` and `nouns` are tracked by their content
  }, [parent, nextLocale, locale, timeZone, dir, stringsKey, nounsKey])
  return (
    <LocaleContext.Provider value={value}>
      <Direction.Provider dir={value.dir}>{children}</Direction.Provider>
    </LocaleContext.Provider>
  )
}

/**
 * The app's nouns in effect, each in its singular (or only) form, for the app's own code:
 * `useNouns().environment` is "environment", or the app's "workspace". Candor's components don't need it: their
 * messages fill `{environment}` themselves. At the start of a sentence, `startOf(nouns.environment)`.
 */
function useNouns(): Nouns {
  return React.useContext(LocaleContext).singular
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

/** The same styles with the short day name in front ("Tue, 10 Nov 2026"); Intl can't add a weekday to `dateStyle`. */
const weekdayOptions: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  datetime: { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
  time: { weekday: "short", hour: "numeric", minute: "2-digit" },
}

/** What `Formatter.date` takes beyond the style. */
export type DateOptions = {
  /**
   * The IANA time zone to show the time in, e.g. "Europe/London", in place of LocaleProvider's `timeZone`: for a time
   * that belongs to a place, such as a schedule's next run. A zone this browser's Intl doesn't know shows the ISO form
   * in UTC, which says so, rather than throwing.
   */
  timeZone?: string | undefined
  /** Put the short day name in front: "Tue, 10 Nov 2026, 9:00". */
  weekday?: boolean | undefined
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
  /**
   * An absolute time, in LocaleProvider's `timeZone` (or the browser's), or in `options.timeZone` when given. Until the
   * page hydrates it reads as an ISO date in UTC, unless both a locale and a time zone are set.
   */
  date: (date: Date | string | number, style?: DateStyle, options?: DateOptions | undefined) => string
  /** Items joined as the locale does: "A, B and C". */
  list: (items: string[], type?: "conjunction" | "disjunction") => string
}

/**
 * `Formatter.date`, outside the hook so the React Compiler can optimise `useFormat` (it doesn't lower the conditionals
 * a try/catch holds here).
 */
function formatDate(
  value: Date | string | number,
  style: DateStyle,
  options: DateOptions | undefined,
  context: { tag: string | undefined; locale: string | undefined; timeZone: string | undefined; hydrated: boolean }
): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const zone = options?.timeZone ?? context.timeZone
  if (!(context.hydrated || Boolean(context.locale && zone))) return isoText(d, style)
  const format = { ...(options?.weekday ? weekdayOptions : dateOptions)[style], ...(zone && { timeZone: zone }) }
  const given = options?.timeZone !== undefined
  try {
    return new Intl.DateTimeFormat(context.tag, format).format(d)
  } catch (e) {
    // An unknown zone: the UTC form says which zone it is in, where the provider's zone wouldn't.
    if (e instanceof RangeError && given) return isoText(d, style)
    throw e
  }
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
    return {
      tag,
      number: (n, options) => new Intl.NumberFormat(tag, options).format(n),
      date: (value, style = "datetime", options) => formatDate(value, style, options, { tag, locale, timeZone, hydrated }),
      list: (items, type = "conjunction") => new Intl.ListFormat(tag, { style: "long", type }).format(items),
    }
  }, [locale, timeZone, hydrated])
}


/**
 * A translated sentence with elements in it: `place(t("signedInAs"), { email: <strong>{email}</strong> })`. Each
 * `{name}` becomes that node, so translators can move it within the sentence and it keeps its styling. A placeholder
 * named like one of the app's nouns (`{account}`, `{environment}`) is filled with the noun by `t` unless it is given, so
 * pass it through to keep it for `place`: `place(t("typeToConfirm", { account: "{account}" }), { account: <b>…</b> })`.
 */
export function place(text: string, nodes: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? <React.Fragment key={i}>{part in nodes ? nodes[part] : `{${part}}`}</React.Fragment> : part))
}

/** Looks up one string by key and fills its placeholders, the app's nouns among them; `count` also picks the plural form. */
export type Translate<T extends StringTable> = (key: keyof T & string, vars?: Record<string, string | number>) => string

/**
 * A component's strings: `t("jumpToLatest")`, `t("remove", { name })`, `t("files", { count: 3 })`. `name` is the
 * component's registry name in camelCase, the key apps override it under; `defaults` is its English table. The app's
 * nouns fill their placeholders (`{environment}`, `{Product}`) without being passed.
 */
function useStrings<T extends StringTable>(name: string, defaults: T): Translate<T> {
  const { strings, locale, nouns } = React.useContext(LocaleContext)
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
      return fill(pick(message, count, rules, nouns, vars), vars, number, nouns, locale)
    }
  }, [overrides, defaults, format, locale, nouns])
}

/** Physical side for the reading direction: "left" in LTR, "right" in RTL. For the few places CSS can't say start. */
function useStartSide(): "left" | "right" {
  return useLocale().dir === "rtl" ? "right" : "left"
}

// fill, pick, startOf and the noun types live in foundation/fill-strings, without "use client", so server code can use
// them; exported from here too, so app code imports everything about words from one place.
export type { Phrase, PluralPhrase, SelectPhrase, Noun, NounTable, Nouns }
export { LocaleProvider, useLocale, useFormat, useHydrated, useStrings, useStartSide, useNouns, fill, pick, startOf, nounDefaults }
