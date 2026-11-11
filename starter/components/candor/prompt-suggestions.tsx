"use client"

import { ArrowUpRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PromptSuggestion } from "@/lib/candor/chat"
import { Skeleton } from "@/components/candor/ui/skeleton"
import { useStrings } from "@/components/candor/locale"
import { motion } from "@/lib/candor/motion"

/**
 * @motion press:press A suggestion shrinks slightly while it is held down and returns when it is let go. Under
 * reduced motion no suggestion changes size.
 */
const pressMotion = motion("prompt-suggestions", "press", "press", { amp: "0.98" })

/** PromptSuggestions' fixed words; override them under `promptSuggestions` in LocaleProvider's `strings`. */
export const promptSuggestionsStrings = {
  label: "Try asking",
}

/**
 * Prompts to start from. Choosing one puts it in the composer to edit, rather
 * than sending it, because suggestions are model output too. Loading shows
 * placeholders of the right shape; an empty list renders nothing.
 */
function PromptSuggestions({
  suggestions,
  onChoose,
  title,
  busy = false,
  variant = "chips",
  className,
}: {
  /** What to offer. */
  suggestions: PromptSuggestion[]
  /** Called with the chosen one; put it in the composer to edit rather than sending it. */
  onChoose: (suggestion: PromptSuggestion) => void
  /** The heading above the suggestions, also their accessible name; "Try asking" by default. */
  title?: string | undefined
  /** Shows placeholders while suggestions load. */
  busy?: boolean | undefined
  /** Compact chips, or larger cards for an empty thread. */
  variant?: "chips" | "cards" | undefined
  className?: string | undefined
}) {
  const t = useStrings("promptSuggestions", promptSuggestionsStrings)
  const label = title ?? t("label")
  if (!busy && suggestions.length === 0) return null
  return (
    <section data-slot="prompt-suggestions" aria-label={label} className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles aria-hidden className="size-3" /> {label}
      </p>
      <div className={cn(variant === "cards" ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-1.5")}>
        {busy
          ? Array.from({ length: variant === "cards" ? 4 : 3 }, (_, i) => (
              <Skeleton key={i} className={variant === "cards" ? "h-16 rounded-xl" : "h-8 w-44 rounded-lg"} />
            ))
          : suggestions.map((s) =>
              variant === "cards" ? (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChoose(s)}
                  style={pressMotion}
                  className="group/suggestion flex items-start justify-between gap-3 rounded-xl border bg-card p-3 text-start text-sm cd-press outline-none hover:border-border-strong hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/80"
                >
                  <span>{s.text}</span>
                  <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-faint-foreground cd-tint group-hover/suggestion:text-accent-text" />
                </button>
              ) : (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChoose(s)}
                  className="rounded-lg border bg-card px-(--cd-control-px,0.75rem) py-(--cd-item-py,0.375rem) text-sm text-muted-foreground cd-tint outline-none hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80"
                >
                  {s.text}
                </button>
              )
            )}
      </div>
    </section>
  )
}

export { PromptSuggestions }
