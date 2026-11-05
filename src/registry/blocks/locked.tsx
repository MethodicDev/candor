"use client"

import * as React from "react"
import { LockKeyhole } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/ui/tooltip"

type Lockable = React.ReactElement<{
  "aria-disabled"?: boolean | "true" | "false"
  "aria-describedby"?: string
  onClick?: React.MouseEventHandler
  onKeyDown?: React.KeyboardEventHandler
  "data-locked"?: string
}>

/**
 * The honest-state rule: a control that cannot be used says why.
 *
 * Wrap any single control. With a `reason`, the control stays focusable but is
 * marked `aria-disabled`, its activation is blocked (click, Enter, Space), and
 * it is described by the reason — so keyboard and screen-reader users reach
 * the explanation on the control itself. The reason shows as a tooltip, or
 * printed under the control with `inline`.
 */
function Locked({
  reason,
  inline = false,
  children,
  className,
}: {
  /** Why the control can't be used. Without one, the control renders as normal. */
  reason?: string | null
  /** Print the reason under the control instead of in a tooltip. */
  inline?: boolean
  children: Lockable
  className?: string
}) {
  const id = React.useId()
  if (!reason) return children

  const block = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const control = React.cloneElement(children, {
    "aria-disabled": true,
    "aria-describedby": id,
    "data-locked": "",
    onClick: block,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") block(e)
    },
  })

  return (
    <span data-slot="locked" className={cn("relative inline-flex flex-col items-start gap-1.5", className)}>
      {inline ? (
        control
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{control}</TooltipTrigger>
          <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
      )}
      <span id={id} className={cn("items-center gap-1 text-xs text-muted-foreground", inline ? "inline-flex" : "sr-only")}>
        <LockKeyhole aria-hidden className="size-3" />
        {reason}
      </span>
    </span>
  )
}

export { Locked }
