"use client"

import * as React from "react"
import { ChevronRight, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { StepMark } from "@/registry/blocks/step-list"
import { ShimmerLabel } from "@/registry/blocks/streaming-text"
import type { ToolCall as ToolCallData } from "@/registry/lib/chat"
import { useStatusLabel } from "@/registry/lib/status"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/ui/collapsible"
import { Payload } from "@/registry/chat/payload"
import { useStrings } from "@/registry/blocks/locale"
import { motion } from "@/registry/lib/motion"

/**
 * @motion reveal:open A call's detail opens to its full height when the person opens it, and the chevron turns with
 * it; closing reverses both. Under reduced motion it snaps open or shut.
 */
const openMotion = motion("tool-call", "open", "reveal")
/**
 * @motion reveal:group-open A group of calls opens to its full height when the person opens it, and its chevron turns
 * with it; closing reverses both. Under reduced motion it snaps open or shut.
 */
const groupMotion = motion("tool-call", "group-open", "reveal")

/** ToolCall's fixed words; override them under `toolCall` in LocaleProvider's `strings`. */
export const toolCallStrings = {
  input: "Input",
  output: "Output",
  calls: { one: "{count} tool call", other: "{count} tool calls" },
  done: "{count} done",
  failed: "{count} failed",
  working: "working",
  approvedAutomatically: "Approved automatically",
  approvedByPerson: "Approved by a person",
  editedBeforeRun: "Edited before it ran",
  editedNote: "A person changed the input before allowing it. Input is what ran.",
  proposed: "As the agent proposed it",
}

/**
 * One tool call as a compact row: what it did in plain words, its status, and
 * how long it took. Expands to the input and output. A failed call opens by
 * default and leads with its error. A call that finishes while on screen draws
 * its tick or cross; one that arrives finished is drawn still.
 */
function ToolCall({
  call,
  className,
}: {
  /** The call: tool name, plain-words title, status, input, output, duration or error. */
  call: ToolCallData
  className?: string | undefined
}) {
  const t = useStrings("toolCall", toolCallStrings)
  const statusLabel = useStatusLabel()
  const failed = call.status === "failed"
  const [open, setOpen] = React.useState(failed)
  const hasDetail = Boolean(call.input || call.output || call.error || call.approval?.note || call.approval?.originalInput)

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="tool-call" data-status={call.status} className={cn("group/tool", className)}>
      <CollapsibleTrigger
        disabled={!hasDetail}
        className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-start outline-none cd-tint enabled:hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/80"
      >
        <StepMark status={call.status} />
        <span className="min-w-0 flex-1 truncate text-sm">
          {call.status === "running" ? <ShimmerLabel className="font-normal">{call.title}</ShimmerLabel> : call.title}
          <span className="sr-only"> — {statusLabel(call.status)}</span>
        </span>
        {call.approval?.originalInput !== undefined && (
          <span data-slot="tool-call-edited" className="shrink-0 rounded-xs bg-warning-weak px-1 text-2xs text-warning-text">
            {t("editedBeforeRun")}
          </span>
        )}
        {call.approval?.by === "automatic" && (
          <span data-slot="tool-call-approval" className="shrink-0 rounded-xs bg-muted px-1 text-2xs text-muted-foreground">
            {t("approvedAutomatically")}
          </span>
        )}
        <code className="hidden shrink-0 font-mono text-2xs text-faint-foreground sm:inline">{call.tool}</code>
        {call.duration && <span className="shrink-0 text-xs tabular-nums text-faint-foreground">{call.duration}</span>}
        {hasDetail && (
          <ChevronRight
            aria-hidden
            style={openMotion}
            className="rtl:-scale-x-100 size-3.5 shrink-0 text-faint-foreground cd-reveal-turn group-data-[state=open]/tool:[transform:rotate(90deg)]"
          />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent style={openMotion}>
        <div className="mt-1 mb-2 ms-[1.375rem] flex flex-col gap-2 border-s ps-3.5">
          {call.error && (
            <p className="rounded-md bg-destructive-weak px-2.5 py-1.5 text-xs text-destructive-text">{call.error}</p>
          )}
          {call.approval?.note && (
            <p className="text-xs text-muted-foreground">
              {call.approval.by === "automatic" ? t("approvedAutomatically") : t("approvedByPerson")}: {call.approval.note}
            </p>
          )}
          {call.approval?.originalInput !== undefined && <p className="text-xs text-muted-foreground">{t("editedNote")}</p>}
          {call.input && <Payload language="json" title={t("input")} text={call.input} />}
          {call.approval?.originalInput !== undefined && <Payload language="json" title={t("proposed")} text={call.approval.originalInput} />}
          {call.output && <Payload language={call.outputLanguage ?? "text"} title={t("output")} text={call.output} />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** A run of tool calls, with a count when it's long enough to fold. */
function ToolCallGroup({
  calls,
  className,
}: {
  /** Several calls, summarised as a group. */
  calls: ToolCallData[]
  className?: string | undefined
}) {
  const t = useStrings("toolCall", toolCallStrings)
  const done = calls.filter((c) => c.status === "succeeded").length
  const failed = calls.filter((c) => c.status === "failed").length
  const running = calls.some((c) => c.status === "running")
  const [open, setOpen] = React.useState(true)

  if (calls.length <= 2) {
    return (
      <div data-slot="tool-call-group" className={cn("flex flex-col", className)}>
        {calls.map((c) => (
          <ToolCall key={c.id} call={c} />
        ))}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="tool-call-group" className={cn("group/tools rounded-lg border bg-card", className)}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-(--cd-control-px,0.75rem) py-(--cd-row-py,0.5rem) text-start text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80 rounded-lg">
        <Wrench aria-hidden className="size-3.5" />
        <span className="flex-1">
          {t("calls", { count: calls.length })}
          {done > 0 && ` · ${t("done", { count: done })}`}
          {failed > 0 && <span className="text-destructive-text"> · {t("failed", { count: failed })}</span>}
          {running && ` · ${t("working")}`}
        </span>
        <ChevronRight aria-hidden style={groupMotion} className="rtl:-scale-x-100 size-3.5 cd-reveal-turn group-data-[state=open]/tools:[transform:rotate(90deg)]" />
      </CollapsibleTrigger>
      <CollapsibleContent style={groupMotion}>
        <div className="flex flex-col border-t px-1.5 py-1.5">
          {calls.map((c) => (
            <ToolCall key={c.id} call={c} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { ToolCall, ToolCallGroup }
