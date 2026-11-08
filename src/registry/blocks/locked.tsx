"use client"

import * as React from "react"
import { LockKeyhole } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/ui/tooltip"
import { motion } from "@/registry/lib/motion"

/** A press on the locked control: the reason is emphasised, and under expressive the control shakes. */
const refuseMotion = motion("locked", "refuse", "refuse")
const reasonMotion = motion("locked", "reason", "tint", { dur: 200 })

type Lockable = React.ReactElement<{
  "aria-disabled"?: boolean | "true" | "false" | undefined
  "aria-describedby"?: string | undefined
  onClick?: React.MouseEventHandler | undefined
  onKeyDown?: React.KeyboardEventHandler | undefined
  "data-locked"?: string | undefined
}>

/**
 * The honest-state rule: a control that cannot be used says why.
 *
 * Wrap any single control. With a `reason`, the control stays focusable but is
 * marked `aria-disabled`, its activation is blocked (click, Enter, Space), and
 * it is described by the reason — so keyboard and screen-reader users reach
 * the explanation on the control itself. The reason shows as a tooltip, or
 * printed under the control with `inline`. Pressing the control reveals the
 * reason (the tooltip is held open, the printed reason is emphasised) and,
 * under data-motion="expressive" only, shakes it briefly; with reduced motion
 * or the default subtle preset, only the reason is shown.
 */
function Locked({
  reason,
  inline = false,
  children,
  className,
}: {
  /** Why the control can't be used. Without one, the control renders as normal. */
  reason?: string | null | undefined
  /** Print the reason under the control instead of in a tooltip. */
  inline?: boolean | undefined
  children: Lockable
  className?: string | undefined
}) {
  const id = React.useId()
  // The tooltip as hover and focus drive it, and a press, which holds the reason open and shakes (when expressive).
  // `press` counts presses so a second one restarts both timers.
  const [shown, setShown] = React.useState(false)
  const [press, setPress] = React.useState(0)
  const [shaking, setShaking] = React.useState(false)
  const [held, setHeld] = React.useState(false)
  React.useEffect(() => {
    if (press === 0) return
    const shake = window.setTimeout(() => setShaking(false), 400)
    const hold = window.setTimeout(() => setHeld(false), 1800)
    return () => {
      window.clearTimeout(shake)
      window.clearTimeout(hold)
    }
  }, [press])

  if (!reason) return children

  const block = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPress((n) => n + 1)
    setShaking(true)
    setHeld(true)
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
    <span
      data-slot="locked"
      data-pressed={held ? "" : undefined}
      style={refuseMotion}
      className={cn("relative inline-flex flex-col items-start gap-1.5", shaking && "cd-refuse", className)}
    >
      {inline ? (
        control
      ) : (
        <Tooltip open={shown || held} onOpenChange={setShown}>
          <TooltipTrigger asChild>{control}</TooltipTrigger>
          <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
      )}
      <span
        id={id}
        data-slot="locked-reason"
        style={reasonMotion}
        className={cn(
          "items-center gap-1 text-xs text-muted-foreground cd-tint",
          inline ? "inline-flex" : "sr-only",
          held && "text-foreground"
        )}
      >
        <LockKeyhole aria-hidden className="size-3" />
        {reason}
      </span>
    </span>
  )
}

export { Locked }
