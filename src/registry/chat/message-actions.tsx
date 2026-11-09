"use client"

import * as React from "react"
import { Check, Copy, RotateCw, ThumbsDown, ThumbsUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCopy } from "@/registry/lib/use-copy"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/ui/tooltip"
import { useStrings } from "@/registry/blocks/locale"
import { motion } from "@/registry/lib/motion"

/**
 * @motion pop:tick After the person copies, a tick (or a cross, if the browser refused the clipboard) pops in on the
 * button once the browser has answered. Nothing shows before the answer, and under reduced motion it fades in.
 */
const tickMotion = motion("message-actions", "tick", "pop")

/** MessageActions' fixed words; override them under `messageActions` in LocaleProvider's `strings`. */
export const messageActionsStrings = {
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn’t copy",
  retry: "Retry",
  good: "Good answer",
  bad: "Bad answer",
}

export type Rating = "up" | "down" | null

function ActionButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string
  onClick?: (() => void) | undefined
  pressed?: boolean | undefined
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className="flex size-(--cd-control-h-xs,1.75rem) items-center justify-center rounded-md text-faint-foreground cd-tint outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80 aria-pressed:text-accent-text [&_svg]:size-3.5"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Copy, retry and rate under an agent's reply. Each action appears only when
 * its handler is given. Copy reports what the clipboard did: the icon stays a
 * copy icon until the write settles, then becomes a tick (or a cross when the
 * clipboard refused). A rating is the caller's state, so it shows only what
 * the service recorded.
 *
 * `report` puts a report control after the ratings and links the two: a bad rating opens it, so the person says what was
 * wrong once, in the report, rather than rating and then reporting separately. `report-reply` (Pro) takes the control
 * as it is: `report={(control) => <ReportReply {...control} reviewer="the quality team" onReport={send} />}`.
 */
function MessageActions({
  text,
  onRetry,
  rating,
  onRate,
  report,
  meta,
  className,
}: {
  /** What Copy copies; without it there's no Copy. */
  text?: string | undefined
  /** Shows Retry. */
  onRetry?: (() => void) | undefined
  /** The current rating: up, down or none. */
  rating?: Rating | undefined
  /** Shows thumbs up and down. */
  onRate?: ((rating: Rating) => void) | undefined
  /** A report control after the ratings, given whether it's open; a bad rating opens it. Pair it with `report-reply`. */
  report?: ((control: { open: boolean; onOpenChange: (open: boolean) => void }) => React.ReactNode) | undefined
  /** Facts after the actions, e.g. the model and cost. */
  meta?: React.ReactNode | undefined
  className?: string | undefined
}) {
  const { state, copy } = useCopy()
  const t = useStrings("messageActions", messageActionsStrings)
  const [reporting, setReporting] = React.useState(false)
  return (
    <div data-slot="message-actions" className={cn("flex items-center gap-0.5", className)}>
      {text !== undefined && (
        <ActionButton label={state === "copied" ? t("copied") : state === "failed" ? t("copyFailed") : t("copy")} onClick={() => copy(text)}>
          {state === "copied" ? (
            <Check data-copy="copied" style={tickMotion} className="text-success-text cd-pop" />
          ) : state === "failed" ? (
            <X data-copy="failed" style={tickMotion} className="text-destructive-text cd-pop" />
          ) : (
            <Copy data-copy={state} />
          )}
        </ActionButton>
      )}
      {onRetry && (
        <ActionButton label={t("retry")} onClick={onRetry}>
          <RotateCw />
        </ActionButton>
      )}
      {onRate && (
        <>
          <ActionButton label={t("good")} pressed={rating === "up"} onClick={() => onRate(rating === "up" ? null : "up")}>
            <ThumbsUp className={cn(rating === "up" && "fill-current")} />
          </ActionButton>
          <ActionButton
            label={t("bad")}
            pressed={rating === "down"}
            onClick={() => {
              const next = rating === "down" ? null : "down"
              onRate(next)
              if (next === "down" && report) setReporting(true)
            }}
          >
            <ThumbsDown className={cn(rating === "down" && "fill-current")} />
          </ActionButton>
        </>
      )}
      {report?.({ open: reporting, onOpenChange: setReporting })}
      {meta && <span className="ms-1.5 truncate text-xs text-faint-foreground">{meta}</span>}
    </div>
  )
}

export { MessageActions }
