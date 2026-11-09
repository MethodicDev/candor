"use client"

import { Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentIdentity } from "@/registry/lib/chat"
import { useStrings } from "@/registry/blocks/locale"
import { Button } from "@/registry/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/ui/popover"

/** AiDisclosure's fixed words; override them under `aiDisclosure` in LocaleProvider's `strings`. */
export const aiDisclosureStrings = {
  /** The line in the thread when the app names the agent. */
  line: "{name} is an AI system, not a person.",
  /** The line in the thread when no name is given. */
  lineUnnamed: "You're interacting with an AI system, not a person.",
  /** The badge's visible text. */
  badge: "AI",
  /** The badge's accessible name when the app names the agent. */
  badgeLabel: "{name} is an AI system",
  /** The badge's accessible name when no name is given. */
  badgeLabelUnnamed: "AI system",
  /** The heading of the badge's explanation. */
  about: "About {name}",
  aboutUnnamed: "About this AI system",
  learnMore: "Learn more",
}

/**
 * A plain notice that the person is interacting with an AI system: a first line in the thread (`variant="line"`) or
 * a compact "AI" badge for a thread header (`variant="badge"`) that opens to the app's own explanation. It helps an
 * app tell people they're talking to an AI, as transparency rules such as Article 50(1) of the EU AI Act ask; whether
 * a given placement meets those rules, and what else applies, stays the deployer's call. The agent's name and any
 * details come from the app, never from model text. It's static: read in place, never announced as a live update.
 */
function AiDisclosure({
  agent,
  variant = "line",
  details,
  onLearnMore,
  className,
}: {
  /** The agent, named by the app: an AgentIdentity or a plain name. Left out, the notice says "an AI system". Never model text. */
  agent?: AgentIdentity | string | undefined
  /** "line" (the default) for a first line in the thread; "badge" for a compact mark in a header, e.g. ThreadHeader's. Place each where it fits. */
  variant?: "line" | "badge" | undefined
  /** The app's own plain text about the system: who operates it, what data it uses, how to reach a person. Shown under the line, or in the badge's explanation. */
  details?: string | undefined
  /** Opens the app's own page or dialog about its AI use. A callback, never a URL from the model. Shows a "Learn more" button. */
  onLearnMore?: (() => void) | undefined
  className?: string | undefined
}) {
  const t = useStrings("aiDisclosure", aiDisclosureStrings)
  const name = typeof agent === "string" ? agent : agent?.name
  const sentence = name ? t("line", { name }) : t("lineUnnamed")
  const learnMore = onLearnMore && (
    <Button type="button" variant="link" size="xs" className="h-6 px-0 has-[>svg]:px-0" onClick={onLearnMore}>
      {t("learnMore")}
    </Button>
  )

  if (variant === "badge") {
    const label = name ? t("badgeLabel", { name }) : t("badgeLabelUnnamed")
    const mark = (
      <>
        <Bot aria-hidden className="size-3 shrink-0" />
        <span aria-hidden>{t("badge")}</span>
      </>
    )
    const badgeClass = "inline-flex min-h-6 min-w-6 items-center justify-center gap-1 rounded-full border px-2 text-2xs font-medium text-muted-foreground"
    // Nothing more to say: a static mark with a name, not a button that opens nothing.
    if (!details && !onLearnMore)
      return (
        <span data-slot="ai-disclosure" data-variant="badge" role="img" aria-label={label} className={cn(badgeClass, className)}>
          {mark}
        </span>
      )
    return (
      <Popover>
        <PopoverTrigger data-slot="ai-disclosure" data-variant="badge" aria-label={label} className={cn(badgeClass, "outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/80", className)}>
          {mark}
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-72 flex-col gap-1.5 p-3 text-xs">
          <p className="text-sm font-medium">{name ? t("about", { name }) : t("aboutUnnamed")}</p>
          <p>{sentence}</p>
          {details && <p className="text-muted-foreground">{details}</p>}
          {learnMore && <div>{learnMore}</div>}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div data-slot="ai-disclosure" data-variant="line" role="note" className={cn("flex items-start justify-center gap-1.5 py-1 text-center text-xs text-muted-foreground", className)}>
      <Bot aria-hidden className="mt-0.5 size-3 shrink-0" />
      <p className="flex flex-wrap items-center justify-center gap-x-1.5">
        <span>{sentence}</span>
        {details && <span>{details}</span>}
        {learnMore}
      </p>
    </div>
  )
}

export { AiDisclosure }
