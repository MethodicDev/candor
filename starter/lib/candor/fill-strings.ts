type Vars = Record<string, string | number> // the values a message's placeholders are filled with

/** A message's plural forms, chosen by its `count`; `other` is the one every language has. */
export type PluralPhrase = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>

/**
 * A message's forms chosen by a word: `vars[select]` when it names a case, else the `gender` of the noun called
 * `select`, else `other`. Each case is a string or plural forms:
 *
 *   { select: "environment", cases: { feminine: "Nouvelle {environment}", other: "Nouvel {environment}" } }
 */
export type SelectPhrase = { select: string; cases: { other: string | PluralPhrase } & Record<string, string | PluralPhrase> }

/** One string, its plural forms by `count`, or its forms by a word; `{name}` placeholders are filled in. */
export type Phrase = string | PluralPhrase | SelectPhrase

/**
 * One of the app's nouns: a word ("workspace"), or its plural forms (`{ one: "workspace", other: "workspaces" }`),
 * with a `gender` for messages that select on it and a `start` for the start of a sentence where upper-casing the
 * first letter isn't how the language does it.
 */
export type Noun = string | (PluralPhrase & { gender?: string | undefined; start?: string | PluralPhrase | undefined })

/** The app's nouns by name; a message names one as `{environment}`, or `{Environment}` at the start of a sentence. */
export type NounTable = Record<string, Noun>

/** Each noun in its singular (or only) form, for the app's own code: what `useNouns()` gives. */
export type Nouns = {
  /** One place agents act in: "environment", or the app's "workspace", "project". */
  environment: string
  /** More than one of them: the app's own word, else the `other` form of the app's `environment`. */
  environments: string
  /** The paying customer that owns the environments. */
  account: string
  /** The product's own name, for labels like "In the app" and "What the app will read". */
  product: string
} & Record<string, string>

/** Candor's own nouns, which the app's replace one by one. */
export const nounDefaults = {
  environment: { one: "environment", other: "environments" },
  environments: "environments",
  account: { one: "account", other: "accounts" },
  product: "the app",
} satisfies NounTable

const own = <T>(table: Record<string, T> | undefined, key: string): T | undefined => (table && Object.hasOwn(table, key) ? table[key] : undefined)

const rulesByLocale = new Map<string, Intl.PluralRules>()
/** Plural rules for the language of the strings: the given locale, else English, the language of the defaults. */
function rulesFor(locale: string | undefined): Intl.PluralRules {
  const tag = locale ?? "en-US"
  let rules = rulesByLocale.get(tag)
  if (!rules) {
    try {
      rules = new Intl.PluralRules(tag)
    } catch {
      rules = new Intl.PluralRules("en-US")
    }
    rulesByLocale.set(tag, rules)
  }
  return rules
}

/** The plural form for `count`, falling back to `other`. */
function plural(forms: PluralPhrase, count: number | undefined, rules: Intl.PluralRules): string {
  if (count === undefined) return forms.other
  if (count === 0 && forms.zero !== undefined) return forms.zero
  return forms[rules.select(count)] ?? forms.other
}

/** A noun's form for the message's `count`: with no count, its `one` form, else `other`. */
function nounForm(noun: string | PluralPhrase, count: number | undefined, rules: Intl.PluralRules): string {
  if (typeof noun === "string") return noun
  return count === undefined ? (noun.one ?? noun.other) : plural(noun, count, rules)
}

/**
 * The text's first letter in upper case, as the locale writes it: "Environment" from "environment", "İstanbul" from
 * "istanbul" in Turkish. The first grapheme, so a letter with combining marks stays whole. For headings and the start
 * of a sentence.
 */
export function startOf(text: string, locale?: string): string {
  if (!text) return text
  let first = Array.from(text)[0]!
  try {
    if (typeof Intl.Segmenter === "function") first = new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text)[Symbol.iterator]().next().value?.segment ?? first
    return first.toLocaleUpperCase(locale) + text.slice(first.length)
  } catch {
    // A tag Intl doesn't accept: upper-case without the locale's rules.
    return first.toUpperCase() + text.slice(first.length)
  }
}

/** A placeholder filled from the nouns: `{environment}` as the count picks, `{Environment}` at a sentence's start. */
function nounText(nouns: NounTable, key: string, count: number | undefined, rules: Intl.PluralRules, locale: string | undefined): string | undefined {
  const exact = own(nouns, key)
  if (exact !== undefined) return nounForm(exact, count, rules)
  const first = key.charAt(0)
  if (first === first.toLowerCase()) return undefined
  const noun = own(nouns, first.toLowerCase() + key.slice(1))
  if (noun === undefined) return undefined
  if (typeof noun !== "string" && noun.start !== undefined) return nounForm(noun.start, count, rules)
  return startOf(nounForm(noun, count, rules), locale)
}

/**
 * Fill `{name}` placeholders: from `vars` first, then from the app's `nouns` (`{environment}` in the form the message's
 * `count` picks, else its `one` form). `{Environment}` reads `vars.Environment`, else `startOf(vars.environment)`, so a
 * value given for the noun also starts a sentence; with neither, a noun named `Environment`, else the noun's `start`,
 * else `startOf` it. A placeholder with none of these stays as written. Numbers go through `number`, the locale's number
 * format in a component.
 */
export function fill(template: string, vars: Vars | undefined, number: (n: number) => string = String, nouns?: NounTable, locale?: string): string {
  if (!vars && !nouns) return template
  const count = typeof vars?.count === "number" ? vars.count : undefined
  const rules = rulesFor(locale)
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = own(vars, key)
    if (v !== undefined) return typeof v === "number" ? number(v) : v
    const first = key.charAt(0)
    if (first !== first.toLowerCase()) {
      const given = own(vars, first.toLowerCase() + key.slice(1))
      if (given !== undefined) return typeof given === "number" ? number(given) : startOf(given, locale)
    }
    return (nouns && nounText(nouns, key, count, rules, locale)) ?? whole
  })
}

/**
 * The form of a message for `count`: plural forms fall back to `other`; a `SelectPhrase` takes its case from
 * `vars[select]`, else from the `gender` of the noun called `select`, else `other`.
 */
export function pick(message: Phrase, count: number | undefined, rules: Intl.PluralRules, nouns?: NounTable, vars?: Vars): string {
  if (typeof message === "string") return message
  if ("select" in message) {
    const given = own(vars, message.select)
    const noun = own(nouns, message.select)
    const gender = noun !== undefined && typeof noun !== "string" ? noun.gender : undefined
    const chosen = (typeof given === "string" ? own(message.cases, given) : undefined) ?? (gender !== undefined ? own(message.cases, gender) : undefined) ?? message.cases.other
    return typeof chosen === "string" ? chosen : plural(chosen, count, rules)
  }
  return plural(message, count, rules)
}

/** Each noun in its singular (or only) form. */
export function singularNouns(nouns: NounTable): Nouns {
  const out: Record<string, string> = {}
  for (const [name, noun] of Object.entries(nouns)) out[name] = typeof noun === "string" ? noun : (noun.one ?? noun.other)
  return out as Nouns
}

/**
 * A translate function over a table of English defaults, for code that runs outside a component: on the server, or a
 * helper called without the component's `useStrings`. It fills placeholders, the app's nouns among them, and picks
 * plural and select forms as `useStrings` does with no overrides, in English. This module has no `"use client"`, so a
 * server module can import it.
 *
 *   const t = englishStrings(dataTableStrings)
 *   t("selected", { count: 3 }) // "3 selected"
 *   englishStrings(table, { nouns: { environment: "workspace" } })
 */
export function englishStrings<T extends Record<string, Phrase>>(
  table: T,
  options?: {
    /** The app's nouns, over Candor's own (`nounDefaults`), for `{environment}` and the like. */
    nouns?: Partial<NounTable> | undefined
  }
): (key: keyof T & string, vars?: Vars) => string {
  const rules = rulesFor("en-US")
  const number = new Intl.NumberFormat("en-US")
  const nouns = withNouns(nounDefaults, options?.nouns)
  return (key, vars) => {
    const message = own(table, key)
    if (message === undefined) return key
    const count = typeof vars?.count === "number" ? vars.count : undefined
    return fill(pick(message, count, rules, nouns, vars), vars, (n) => number.format(n), nouns, "en-US")
  }
}

/**
 * `nouns` over `base`, noun by noun; a noun left out (or `undefined`) keeps the one below. An `environment` with an
 * `other` form and no `environments` beside it gives `environments` that form, so `{environments}` follows the app's
 * plural; an `environments` the app sets wins.
 */
export function withNouns(base: NounTable, nouns: Partial<NounTable> | undefined): NounTable {
  const out: NounTable = { ...base }
  for (const [name, noun] of Object.entries(nouns ?? {})) if (noun !== undefined) out[name] = noun
  const environment = own(nouns, "environment")
  if (environment !== undefined && typeof environment !== "string" && own(nouns, "environments") === undefined) out.environments = environment.other
  return out
}
