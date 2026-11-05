"use client"

import * as React from "react"
import { Check, Copy, RotateCw, ThumbsDown, ThumbsUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCopy } from "@/lib/use-copy"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type Rating = "up" | "down" | null

function ActionButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string
  onClick?: () => void
  pressed?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className="flex size-7 items-center justify-center rounded-md text-faint-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-pressed:text-accent-text [&_svg]:size-3.5" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Copy, retry and rate under an agent's reply. Each action appears only when
 * its handler is given. Copy reports what the clipboard did. A rating is the
 * caller's state, so it shows only what the service recorded.
 */
function MessageActions({
  text,
  onRetry,
  rating,
  onRate,
  meta,
  className,
}: {
  /** What Copy copies; without it there's no Copy. */
  text?: string
  /** Shows Retry. */
  onRetry?: () => void
  /** The current rating: up, down or none. */
  rating?: Rating
  /** Shows thumbs up and down. */
  onRate?: (rating: Rating) => void
  /** Facts after the actions, e.g. the model and cost. */
  meta?: React.ReactNode
  className?: string
}) {
  const { state, copy } = useCopy()
  return (
    <div data-slot="message-actions" className={cn("flex items-center gap-0.5", className)}>
      {text !== undefined && (
        <ActionButton label={state === "copied" ? "Copied" : state === "failed" ? "Couldn’t copy" : "Copy"} onClick={() => copy(text)}>
          {state === "copied" ? <Check className="text-success-text" /> : state === "failed" ? <X className="text-destructive-text" /> : <Copy />}
        </ActionButton>
      )}
      {onRetry && (
        <ActionButton label="Retry" onClick={onRetry}>
          <RotateCw />
        </ActionButton>
      )}
      {onRate && (
        <>
          <ActionButton label="Good answer" pressed={rating === "up"} onClick={() => onRate(rating === "up" ? null : "up")}>
            <ThumbsUp className={cn(rating === "up" && "fill-current")} />
          </ActionButton>
          <ActionButton label="Bad answer" pressed={rating === "down"} onClick={() => onRate(rating === "down" ? null : "down")}>
            <ThumbsDown className={cn(rating === "down" && "fill-current")} />
          </ActionButton>
        </>
      )}
      {meta && <span className="ml-1.5 truncate text-xs text-faint-foreground">{meta}</span>}
    </div>
  )
}

export { MessageActions }
