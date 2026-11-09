"use client"

import * as React from "react"
import { LockKeyhole } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/ui/tooltip"
import { motion } from "@/registry/lib/motion"

/** The running animation's duration on `el`, in milliseconds (its longest, if there are several); undefined when it can't be read. */
function animationMs(el: Element | null): number | undefined {
  if (!el || typeof getComputedStyle === "undefined") return undefined
  const times = getComputedStyle(el)
    .animationDuration.split(",")
    .map((t) => (t.trim().endsWith("ms") ? Number.parseFloat(t) : Number.parseFloat(t) * 1000))
    .filter((n) => Number.isFinite(n))
  return times.length ? Math.max(...times) : undefined
}

/**
 * @motion refuse:refuse A press on a locked control shows the reason it is locked; under the expressive setting the
 * control also shakes once. The control stays locked and does nothing it would have done unlocked. Nothing plays
 * until the person presses it.
 */
const refuseMotion = motion("locked", "refuse", "refuse")
/**
 * @motion tint:reason When the person presses a locked control, its reason changes from muted to full-strength text
 * so it can be read, and goes back to muted for a moment after the press. Screen readers always have the reason,
 * whether or not it is shown.
 */
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
  const box = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    if (press === 0) return
    // The shake ends when its animation does (onAnimationEnd below). This timer is only the fallback for when no
    // animation runs (motion off, or no Candor CSS), set from the duration the page resolved: a brand's longer shake,
    // or the speed token, isn't cut short.
    const shake = window.setTimeout(() => setShaking(false), (animationMs(box.current) ?? 400) + 100)
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
      ref={box}
      data-slot="locked"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShaking(false)
      }}
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
