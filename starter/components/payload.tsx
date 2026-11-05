"use client"

import { Check, Copy, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PayloadLanguage } from "@/lib/chat"
import { useCopy } from "@/lib/use-copy"

const knownLabels: Record<string, string> = { json: "JSON", xml: "XML", sql: "SQL", yaml: "YAML", html: "HTML", css: "CSS", js: "JavaScript", ts: "TypeScript", tsx: "TSX", python: "Python", bash: "Shell", sh: "Shell", text: "Text" }

/** "json" → "JSON", "python" → "Python", short unknown ones upper-cased ("hcl" → "HCL"). */
const languageLabel = (lang: string) => knownLabels[lang] ?? (lang.length <= 4 ? lang.toUpperCase() : lang.charAt(0).toUpperCase() + lang.slice(1))

/**
 * A block of code or query text from the agent: a query it ran, code it
 * wrote, a config file. Rendered as text in a sunken well, with its language and a copy
 * control that only says "Copied" once the clipboard took it.
 */
function Payload({
  language,
  text,
  title,
  className,
}: {
  /** Shown as the label, e.g. json, sql, python. Never executed or highlighted as HTML. */
  language: PayloadLanguage
  /** The code or query, shown as text. */
  text: string
  /** What it is, e.g. "The query I ran". */
  title?: string
  className?: string
}) {
  const { state, copy } = useCopy()
  return (
    <figure data-slot="payload" className={cn("overflow-hidden rounded-lg border bg-sunken", className)}>
      <figcaption className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="truncate text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{languageLabel(language)}</span>
          {title && <span> · {title}</span>}
        </span>
        <button
          type="button"
          onClick={() => copy(text)}
          aria-live="polite"
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {state === "copied" ? (
            <>
              <Check className="size-3 text-success-text" /> Copied
            </>
          ) : state === "failed" ? (
            <>
              <X className="size-3 text-destructive-text" /> Couldn’t copy
            </>
          ) : (
            <>
              <Copy className="size-3" /> Copy
            </>
          )}
        </button>
      </figcaption>
      <pre className="max-h-80 overflow-auto px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
        <code>{text}</code>
      </pre>
    </figure>
  )
}

export { Payload }
