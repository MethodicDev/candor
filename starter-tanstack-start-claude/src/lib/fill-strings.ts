type Message = string | ({ other: string } & Partial<Record<Intl.LDMLPluralRule, string>>) // LocaleProvider's Phrase: one string, or its plural forms by `count`

/** Fill `{name}` placeholders. Numbers go through `number`, the locale's number format in a component. */
export function fill(template: string, vars: Record<string, string | number> | undefined, number: (n: number) => string = String): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key]
    return v === undefined ? whole : typeof v === "number" ? number(v) : v
  })
}

/** The plural form for `count`, falling back to `other`. */
export function pick(message: Message, count: number | undefined, rules: Intl.PluralRules): string {
  if (typeof message === "string") return message
  if (count === undefined) return message.other
  if (count === 0 && message.zero !== undefined) return message.zero
  return message[rules.select(count)] ?? message.other
}

/**
 * A translate function over a table of English defaults, for code that runs outside a component: on the server, or a
 * helper called without the component's `useStrings`. It fills placeholders and picks plural forms as `useStrings`
 * does with no overrides, in English. This module has no `"use client"`, so a server module can import it.
 *
 *   const t = englishStrings(dataTableStrings)
 *   t("selected", { count: 3 }) // "3 selected"
 */
export function englishStrings<T extends Record<string, Message>>(table: T): (key: keyof T & string, vars?: Record<string, string | number>) => string {
  const rules = new Intl.PluralRules("en-US")
  const number = new Intl.NumberFormat("en-US")
  return (key, vars) => {
    const message = table[key]
    if (message === undefined) return key
    return fill(pick(message, typeof vars?.count === "number" ? vars.count : undefined, rules), vars, (n) => number.format(n))
  }
}
