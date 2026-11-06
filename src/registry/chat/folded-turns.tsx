"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStrings } from "@/registry/blocks/locale"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/ui/collapsible"

/** FoldedTurns' fixed words; override them under `foldedTurns` in LocaleProvider's `strings`. */
export const foldedTurnsStrings = {
  show: { one: "Show {count} turn", other: "Show {count} turns" },
  hide: { one: "Hide {count} turn", other: "Hide {count} turns" },
}

/**
 * A run of turns folded into one line, for long agent work a reader doesn't need to see step by step: "Drafted three
 * versions and compared them". The line says how many turns are inside and opens them in place; `summary` is yours
 * (a sentence, a count of tool calls, a cost). Folding never hides that the turns happened.
 */
function FoldedTurns({
  count,
  summary,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className,
}: {
  /** How many turns are inside, for the button ("Show 12 turns"). */
  count: number
  /** What happened in them, shown on the folded line: text or your own small summary. */
  summary?: React.ReactNode | undefined
  /** Start open. */
  defaultOpen?: boolean | undefined
  /** Controlled open state. */
  open?: boolean | undefined
  /** Called when a person opens or closes it. */
  onOpenChange?: ((open: boolean) => void) | undefined
  /** The turns, usually Messages. */
  children: React.ReactNode
  className?: string | undefined
}) {
  const t = useStrings("foldedTurns", foldedTurnsStrings)
  const [own, setOwn] = React.useState(defaultOpen)
  const isOpen = open ?? own
  const set = (next: boolean) => {
    if (open === undefined) setOwn(next)
    onOpenChange?.(next)
  }
  return (
    <Collapsible open={isOpen} onOpenChange={set} data-slot="folded-turns" className={cn("group/folded flex flex-col gap-7", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed px-3 py-2 text-sm">
        {summary && <div className="min-w-0 flex-1 text-muted-foreground">{summary}</div>}
        <CollapsibleTrigger className="relative after:absolute after:inset-x-0 after:-inset-y-0.5 ms-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent-text outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/80">
          <ChevronRight aria-hidden className="rtl:-scale-x-100 size-3.5 transition-transform duration-200 group-data-[state=open]/folded:[transform:rotate(90deg)]" />
          {t(isOpen ? "hide" : "show", { count })}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="flex flex-col gap-7">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export { FoldedTurns }
