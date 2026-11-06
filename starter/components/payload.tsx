"use client"

import * as React from "react"
import { Check, Copy, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PayloadLanguage } from "@/lib/chat"
import { useCopy } from "@/lib/use-copy"
import { tokenize } from "@/lib/highlight"

import { useStrings, type Translate } from "@/components/locale"

/** Payload's fixed words; override them under `payload` in LocaleProvider's `strings`. */
export const payloadStrings = {
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn’t copy",
  shell: "Shell",
  text: "Text",
}

// Language names are the same in every language; only the generic ones ("Shell", "Text") come from the strings table.
const knownLabels: Record<string, string> = { json: "JSON", xml: "XML", sql: "SQL", yaml: "YAML", html: "HTML", css: "CSS", js: "JavaScript", ts: "TypeScript", tsx: "TSX", python: "Python" }
const translatedLabels: Record<string, "shell" | "text"> = { bash: "shell", sh: "shell", text: "text" }

/** "json" → "JSON", "python" → "Python", short unknown ones upper-cased ("hcl" → "HCL"). */
const languageLabel = (lang: string, t: Translate<typeof payloadStrings>) => {
  const key = translatedLabels[lang]
  if (key) return t(key)
  return knownLabels[lang] ?? (lang.length <= 4 ? lang.toUpperCase() : lang.charAt(0).toUpperCase() + lang.slice(1))
}

/**
 * A block of code or query text from the agent: a query it ran, code it
 * wrote, a config file. Rendered as text in a sunken well, with its language and a copy
 * control that only says "Copied" once the clipboard took it. `bare` drops the frame and
 * the caption, for a card or panel that already has its own.
 *
 * Code is split into tokens (keywords, strings, comments…) rendered as spans of text, never as HTML. They're coloured
 * when `highlight` is set, or anywhere under `data-syntax="highlight"` (set it on `<html>` for the whole app).
 */
function Payload({
  language,
  text,
  title,
  bare = false,
  highlight,
  className,
}: {
  /** Shown as the label, e.g. json, sql, python. Never executed or highlighted as HTML. */
  language: PayloadLanguage
  /** The code or query, shown as text. */
  text: string
  /** What it is, e.g. "The query I ran". Not shown when `bare`. */
  title?: string | undefined
  /** Just the code: no border, language label or copy button, for inside something that has them. */
  bare?: boolean | undefined
  /** Colour the code by its syntax. Left out, it follows the nearest `data-syntax` attribute (off by default). */
  highlight?: boolean | undefined
  className?: string | undefined
}) {
  const { state, copy } = useCopy()
  const t = useStrings("payload", payloadStrings)
  const syntax = highlight === undefined ? undefined : highlight ? "highlight" : "off"
  const code = <Code text={text} language={language} />
  if (bare) {
    return (
      // It scrolls on its own, so it takes focus: keyboard users can scroll long output.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      <pre data-slot="payload" data-bare="" data-language={language} data-syntax={syntax} tabIndex={0} className={cn("max-h-80 overflow-auto rounded-md bg-sunken outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground", className)}>
        {code}
      </pre>
    )
  }
  return (
    <figure data-slot="payload" data-language={language} data-syntax={syntax} className={cn("overflow-hidden rounded-lg border bg-sunken", className)}>
      <figcaption className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="truncate text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{languageLabel(language, t)}</span>
          {title && <span> · {title}</span>}
        </span>
        <button
          type="button"
          onClick={() => copy(text)}
          aria-live="polite"
          className="relative after:absolute after:inset-x-0 after:-inset-y-0.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80"
        >
          {state === "copied" ? (
            <>
              <Check className="size-3 text-success-text" /> {t("copied")}
            </>
          ) : state === "failed" ? (
            <>
              <X className="size-3 text-destructive-text" /> {t("copyFailed")}
            </>
          ) : (
            <>
              <Copy className="size-3" /> {t("copy")}
            </>
          )}
        </button>
      </figcaption>
      {/* It scrolls on its own, so it takes focus: keyboard users can scroll long output. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <pre tabIndex={0} className="max-h-80 overflow-auto px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset">{code}</pre>
    </figure>
  )
}

/** The code as token spans. Each token is a text child, so nothing in it is parsed as markup. */
function Code({ text, language }: { text: string; language: string }) {
  const tokens = React.useMemo(() => tokenize(text, language), [text, language])
  return (
    <code>
      {tokens.map((tok, i) =>
        tok.type === "plain" ? (
          <React.Fragment key={i}>{tok.text}</React.Fragment>
        ) : (
          <span key={i} data-token={tok.type}>
            {tok.text}
          </span>
        )
      )}
    </code>
  )
}

export { Payload }
