import * as React from "react"
import { ChevronRight, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { StepMark } from "@/components/candor/step-list"
import { ShimmerLabel } from "@/components/candor/streaming-text"
import type { ToolCallData } from "@/lib/candor/chat"
import { useStatusLabel } from "@/lib/candor/status"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/candor/ui/collapsible"
import { Locked } from "@/components/candor/locked"
import { Payload } from "@/components/candor/payload"
import { useFormat, useStrings } from "@/components/candor/locale"
import { neutralizeBidi } from "@/lib/candor/bidi"
import { motion, useSettled, type SettledTest } from "@/lib/candor/motion"

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
/**
 * @motion value:lines A call's line counts ("+12 −3") crossfade to the new numbers when they change while the call is
 * on screen. Counts a call arrives with are shown still.
 */
const linesMotion = motion("tool-call", "lines", "value")
/** Every change of the counts counts. */
const changeTest: SettledTest<string> = { settled: () => true, over: () => false }

/** ToolCall's fixed words; override them under `toolCall` in LocaleProvider's `strings`. */
export const toolCallStrings = {
  /** Why the row can't be opened while the call is still going with nothing behind it yet; once it has finished, the row is text. */
  lockedNoDetail: "This call has no details to show.",
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
  /** The lines a call added, read out: `{count}` in the locale. */
  linesAdded: { one: "{count} line added", other: "{count} lines added" },
  /** The lines a call removed, read out, after the lines added. */
  linesRemoved: "{count} removed",
}

/**
 * The lines a call changed, "+12 −3", in the success and destructive colours with their signs, so colour never carries
 * it alone; read out as "12 lines added, 3 removed".
 */
function LineCounts({ lines }: { lines: { added: number; removed: number } }) {
  const t = useStrings("toolCall", toolCallStrings)
  const fmt = useFormat()
  const added = Math.max(0, Math.floor(lines.added))
  const removed = Math.max(0, Math.floor(lines.removed))
  const changes = useSettled(`${added}/${removed}`, changeTest)
  return (
    <span key={`${added}/${removed}`} data-slot="tool-call-lines" style={linesMotion} className={cn("shrink-0 font-mono text-2xs tabular-nums", changes > 0 && "cd-value")}>
      <span aria-hidden>
        <span className="text-success-text">+{fmt.number(added)}</span> <span className="text-destructive-text">−{fmt.number(removed)}</span>
      </span>
      <span className="sr-only">
        {t("linesAdded", { count: added })}, {t("linesRemoved", { count: removed })}
      </span>
    </span>
  )
}

/**
 * One tool call as a compact row: what it did in plain words, its status, and
 * how long it took. Expands to the input and output. A failed call opens by
 * default and leads with its error. A call that finishes while on screen draws
 * its tick or cross; one that arrives finished is drawn still. A call that
 * edited files and says how many lines (`lines`) shows "+12 −3" after its
 * title, read out as "12 lines added, 3 removed".
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
  // The title, the tool's name and the error come from the agent or the tool: no control character reorders them.
  const title = neutralizeBidi(call.title)
  const hasDetail = Boolean(call.input || call.output || call.error || call.approval?.note || call.approval?.originalInput)
  // A call that has finished gains nothing more to show; one still going may (KIT-231's Locked says it waits).
  const finished = call.status === "succeeded" || call.status === "failed" || call.status === "cancelled" || call.status === "skipped"

  const row = (
    <>
      <StepMark status={call.status} />
      {/* The title keeps at least 8rem; on a narrow row the meta after it wraps to a line of its own, at the end. */}
      <span className="min-w-[min(8rem,100%)] flex-1 basis-0 truncate text-sm">
        <bdi>{call.status === "running" ? <ShimmerLabel className="font-normal">{title}</ShimmerLabel> : title}</bdi>
        <span className="sr-only"> — {statusLabel(call.status)}</span>
      </span>
      <span data-slot="tool-call-meta" className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5">
        {call.lines && Number.isFinite(call.lines.added) && Number.isFinite(call.lines.removed) && <LineCounts lines={call.lines} />}
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
        <code className="hidden shrink-0 font-mono text-2xs text-faint-foreground sm:inline"><bdi>{neutralizeBidi(call.tool)}</bdi></code>
        {call.duration && <span className="shrink-0 text-xs tabular-nums text-faint-foreground">{call.duration}</span>}
        {hasDetail && (
          <ChevronRight
            aria-hidden
            style={openMotion}
            className="rtl:-scale-x-100 size-3.5 shrink-0 text-faint-foreground cd-reveal-turn group-data-open/tool:[transform:rotate(90deg)]"
          />
        )}
      </span>
    </>
  )

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="tool-call" data-status={call.status} className={cn("group/tool", className)}>
      {/* Finished with nothing behind it, the row is text, not a control: it would never open, so it isn't a tab stop. */}
      {hasDetail || !finished ? (
        <Locked reason={hasDetail ? undefined : t("lockedNoDetail")} className="w-full">
          <CollapsibleTrigger className={cn("flex w-full flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-md px-1.5 py-1 text-start outline-none cd-tint focus-visible:ring-[3px] focus-visible:ring-ring/80", hasDetail && "hover:bg-accent")}>
            {row}
          </CollapsibleTrigger>
        </Locked>
      ) : (
        <div data-slot="tool-call-row" className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-md px-1.5 py-1 text-start">
          {row}
        </div>
      )}
      <CollapsibleContent style={openMotion}>
        <div className="mt-1 mb-2 ms-[1.375rem] flex flex-col gap-2 border-s ps-3.5">
          {call.error && (
            <p className="rounded-md bg-destructive-weak px-2.5 py-1.5 text-xs text-destructive-text">{neutralizeBidi(call.error)}</p>
          )}
          {call.approval?.note && (
            <p className="text-xs text-muted-foreground">
              {call.approval.by === "automatic" ? t("approvedAutomatically") : t("approvedByPerson")}: <bdi>{neutralizeBidi(call.approval.note)}</bdi>
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
  const { separator } = useFormat()
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
          {done > 0 && separator + t("done", { count: done })}
          {failed > 0 && <span className="text-destructive-text">{separator + t("failed", { count: failed })}</span>}
          {running && separator + t("working")}
        </span>
        <ChevronRight aria-hidden style={groupMotion} className="rtl:-scale-x-100 size-3.5 cd-reveal-turn group-data-open/tools:[transform:rotate(90deg)]" />
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
