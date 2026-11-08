"use client"

import * as React from "react"
import { Brain, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShimmerLabel } from "@/registry/blocks/streaming-text"
import type { ReasoningEntry } from "@/registry/lib/chat"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/ui/collapsible"

import { useStrings } from "@/registry/blocks/locale"
import { motion, useArrived } from "@/registry/lib/motion"

const arriveMotion = motion("reasoning", "arrive", "arrive")

const turnMotion = motion("reasoning", "open", "reveal")

/** Reasoning's fixed words; override them under `reasoning` in LocaleProvider's `strings`. */
export const reasoningStrings = {
  verified: "Verified",
  believed: "Believed",
  assumed: "Assumed",
  reasoning: "Reasoning",
  steps: { one: "{count} step", other: "{count} steps" },
  assumedCount: "{count} assumed",
  thinking: "Thinking",
  evidence: "Evidence:",
  assumption: "Assumption:",
}

const basisTone = {
  verified: "bg-success-weak text-success-text",
  believed: "bg-muted text-muted-foreground",
  assumed: "bg-warning-weak text-warning-text",
} as const

/**
 * The agent's stated reasoning above its answer. Each step says what it rests
 * on: verified against evidence, believed, or assumed (with the assumption
 * spelled out). Open while the agent is thinking; folds to a one-line summary
 * when it answers.
 */
function Reasoning({
  entries,
  thinking = false,
  thoughtFor,
  className,
}: {
  /** The steps, each verified (with evidence), believed or assumed. */
  entries: ReasoningEntry[]
  /** The agent is still thinking; opens the panel and shows progress. */
  thinking?: boolean | undefined
  /** How long it thought, once known, e.g. "6s". */
  thoughtFor?: string | undefined
  className?: string | undefined
}) {
  const t = useStrings("reasoning", reasoningStrings)
  // An entry added while the reasoning is on screen rises in; the ones it drew with are still.
  const arrived = useArrived(React.useMemo(() => entries.map((e) => e.id), [entries]))
  const [open, setOpen] = React.useState(thinking)
  React.useEffect(() => setOpen(thinking), [thinking])

  const assumed = entries.filter((e) => e.basis === "assumed").length
  const summary = thinking ? null : (
    <>
      {t("reasoning")}{thoughtFor && <> · {thoughtFor}</>} · {t("steps", { count: entries.length })}
      {assumed > 0 && <span className="text-warning-text"> · {t("assumedCount", { count: assumed })}</span>}
    </>
  )

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="reasoning" className={cn("group/reasoning", className)}>
      <CollapsibleTrigger className="relative after:absolute after:inset-x-0 after:-inset-y-0.5 inline-flex items-center gap-1.5 rounded-md py-0.5 pe-1.5 text-xs text-muted-foreground outline-none cd-tint hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80">
        <Brain aria-hidden className={cn("size-3.5", thinking && "text-accent-text")} />
        {thinking ? <ShimmerLabel className="text-xs">{t("thinking")}</ShimmerLabel> : summary}
        <ChevronRight aria-hidden style={turnMotion} className="rtl:-scale-x-100 size-3 cd-reveal-turn group-data-[state=open]/reasoning:[transform:rotate(90deg)]" />
      </CollapsibleTrigger>
      <CollapsibleContent style={turnMotion}>
        <ol className="mt-2 ms-1.5 flex flex-col gap-3 border-s ps-4">
          {entries.map((e) => (
            <li key={e.id} style={arriveMotion} className={cn("relative", arrived(e.id) && "cd-arrive")}>
              <span aria-hidden className="absolute top-1.5 -start-[1.2rem] size-1.5 rounded-full bg-border-strong" />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-sm font-medium">{e.title}</p>
                <span className={cn("rounded-xs px-1 text-2xs font-medium", basisTone[e.basis])}>{t(e.basis)}</span>
              </div>
              {e.body && <p className="mt-0.5 text-sm text-muted-foreground">{e.body}</p>}
              <p className="mt-1 text-xs text-faint-foreground">
                {e.basis === "verified" ? <>{t("evidence")} {e.evidence}</> : <>{t("assumption")} {e.assumption}</>}
              </p>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { Reasoning }
