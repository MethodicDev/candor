"use client"

import { BookOpen, Braces, Database, FileText, Globe, Table2, Waypoints, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MessageSource, SourceKind } from "@/registry/foundation/chat"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/ui/popover"
import { useStrings, type Translate } from "@/registry/foundation/locale"

/** Citation's fixed words; override them under `citation` in LocaleProvider's `strings`. */
export const citationStrings = {
  document: "Document",
  web: "Web page",
  query: "Query",
  data: "Data",
  code: "Code",
  workflow: "Workflow",
  knowledge: "Knowledge",
  /** A kind not listed above. */
  source: "Source",
  notVerified: "The agent cites this but hasn’t verified it.",
  sourceLabel: "Source {marker}: {label}",
  sources: "Sources",
}

/** Kinds of evidence most apps cite. Others read as "Source". */
export const sourceKinds: Record<string, { Icon: LucideIcon; noun: string }> = {
  document: { Icon: FileText, noun: "Document" },
  web: { Icon: Globe, noun: "Web page" },
  query: { Icon: Database, noun: "Query" },
  data: { Icon: Table2, noun: "Data" },
  code: { Icon: Braces, noun: "Code" },
  workflow: { Icon: Waypoints, noun: "Workflow" },
  knowledge: { Icon: BookOpen, noun: "Knowledge" },
}

const builtInKinds = ["document", "web", "query", "data", "code", "workflow", "knowledge"] as const
type BuiltInKind = (typeof builtInKinds)[number]
const isBuiltIn = (kind: string): kind is BuiltInKind => (builtInKinds as readonly string[]).includes(kind)

const kindOf = (kind: SourceKind, t: Translate<typeof citationStrings>) => {
  const info = sourceKinds[kind]
  if (!info) return { Icon: FileText, noun: t("source") }
  return isBuiltIn(kind) ? { ...info, noun: t(kind) } : info
}

function SourceDetail({
  source,
}: {
  /** The source this marker points to; without it the marker says it's unknown. */
  source: MessageSource
}) {
  const t = useStrings("citation", citationStrings)
  const { Icon, noun } = kindOf(source.kind, t)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
          <Icon className="size-3" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{source.label}</p>
          <p className="text-xs text-muted-foreground">{source.origin ?? noun}</p>
        </div>
      </div>
      {source.snippet && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <blockquote tabIndex={0} className="max-h-40 overflow-auto rounded-md bg-sunken outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-inset px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {source.snippet}
        </blockquote>
      )}
      {source.provisional && (
        <p className="text-xs text-provisional">{t("notVerified")}</p>
      )}
    </div>
  )
}

/**
 * An inline [n]. Opens the source in a popover on click or Enter, so evidence is
 * one step away without leaving the thread. A source the message doesn't list
 * renders as a plain bracket rather than a guess.
 *
 * @motion tint:tint A source chip's border and text colour change when the pointer is over it, and a ring fades in
 * when a citation number or chip takes keyboard focus.
 */
function Citation({
  source,
  marker,
}: {
  /** The source this marker points to; without it the marker says it's unknown. */
  source?: MessageSource | undefined
  /** The number to show when there's no source. */
  marker?: number | undefined
}) {
  const t = useStrings("citation", citationStrings)
  if (!source) {
    return <sup data-slot="citation" className="text-faint-foreground">[{marker ?? "?"}]</sup>
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="citation"
          aria-label={t("sourceLabel", { marker: source.marker, label: source.label })}
          className={cn(
            "mx-0.5 inline-flex h-4 min-w-4 -translate-y-px items-center justify-center rounded-sm px-1 align-middle text-2xs font-semibold tabular-nums cd-tint outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
            source.provisional
              ? "border border-dashed border-provisional/60 text-provisional hover:bg-muted"
              : "bg-accent-weak text-accent-text hover:bg-primary hover:text-primary-foreground"
          )}
        >
          {source.marker}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={t("sourceLabel", { marker: source.marker, label: source.label })} className="w-80 max-w-[calc(100vw-2rem)] p-3">
        <SourceDetail source={source} />
      </PopoverContent>
    </Popover>
  )
}

/** The sources under a reply, as chips that open the same detail. A long label wraps inside its chip, so all of it can be read on a narrow screen. */
function SourceList({
  sources,
  className,
}: {
  /** Every source the reply used, in marker order. */
  sources: MessageSource[]
  className?: string | undefined
}) {
  const t = useStrings("citation", citationStrings)
  if (sources.length === 0) return null
  return (
    <div data-slot="source-list" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="me-0.5 text-xs text-faint-foreground">{t("sources")}</span>
      {[...sources]
        .sort((a, b) => a.marker - b.marker)
        .map((s) => {
          const { Icon } = kindOf(s.kind, t)
          return (
            <Popover key={s.id}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative after:absolute after:inset-x-0 after:-inset-y-0.5 inline-flex max-w-full items-start gap-1.5 rounded-md border bg-card py-0.5 pe-2 ps-1 text-start text-xs text-muted-foreground sm:max-w-72 cd-tint outline-none hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80",
                    s.provisional && "border-dashed"
                  )}
                >
                  <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-muted px-1 text-2xs font-semibold tabular-nums">{s.marker}</span>
                  <Icon aria-hidden className="mt-0.5 size-3 shrink-0" />{" "}
                  <span data-slot="source-label" className="min-w-0 [overflow-wrap:anywhere]">
                    {s.label}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" aria-label={t("sourceLabel", { marker: s.marker, label: s.label })} className="w-80 max-w-[calc(100vw-2rem)] p-3">
                <SourceDetail source={s} />
              </PopoverContent>
            </Popover>
          )
        })}
    </div>
  )
}

export { Citation, SourceList, SourceDetail }
