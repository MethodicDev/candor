import * as React from "react"
import { LockKeyhole } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/candor/ui/tooltip"
import { motion } from "@/lib/candor/motion"

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

/** Whether the control opens a list or menu (a Select's or Menu's trigger), which opens on a press or an arrow key. */
const opensPopup = (e: React.SyntheticEvent) => {
  const popup = (e.currentTarget as Element).getAttribute("aria-haspopup")
  return popup !== null && popup !== "false"
}

/** Stops a Base UI part's own handler for this event (Base UI runs the handler passed in first). */
const stopBaseUI = (e: React.SyntheticEvent) =>
  (e as React.SyntheticEvent & { preventBaseUIHandler?: (() => void) | undefined }).preventBaseUIHandler?.()

/** The wrapper without a reason: no box of its own, so the control is laid out as if the wrapper weren't there. */
const unlockedStyle: React.CSSProperties = { display: "contents" }

/** The hidden inputs Base UI draws beside a checkbox, switch or radio. */
const hiddenInputs = 'input[type="checkbox"], input[type="radio"]'

type Lockable = React.ReactElement<{
  "aria-disabled"?: boolean | "true" | "false" | undefined
  "aria-describedby"?: string | undefined
  onClick?: React.MouseEventHandler | undefined
  onKeyDown?: React.KeyboardEventHandler | undefined
  onPointerDown?: React.PointerEventHandler | undefined
  onMouseDown?: React.MouseEventHandler | undefined
  "data-locked"?: string | undefined
  /** Classes, merged with Candor's. */
  className?: string | undefined
}>

/**
 * The honest-state rule: a control that cannot be used says why.
 *
 * Wrap any single control. With a `reason`, the control stays focusable but is
 * marked `aria-disabled`, its activation is blocked (click, Enter, Space, and
 * for a Select's or Menu's trigger the press and ArrowDown or ArrowUp), and
 * it is described by the reason, after anything that already describes it
 * (its own `aria-describedby` is kept) — so keyboard and screen-reader users reach
 * the explanation on the control itself. A checkbox, switch or radio inside
 * doesn't change by any other route either: not by a click on its label, a
 * radio group's arrow keys, or a form reset. The reason shows as a tooltip, or
 * printed under the control with `inline`. Pressing the control reveals the
 * reason (the tooltip is held open, the printed reason is emphasised) and,
 * under data-motion="expressive" only, shakes it briefly; with reduced motion
 * or the default subtle preset, only the reason is shown.
 *
 * The control sits in the same place whether or not there is a reason, so it
 * isn't drawn anew when one comes or goes: focus and a screen reader's place
 * stay on it. Without a reason its wrapper (`data-slot="locked"`, with
 * `data-unlocked`) is `display: contents`, so the page is laid out as if it
 * weren't there; a parent's CSS that selects its own children (`> *`,
 * `:first-child`) meets the wrapper, not the control, so select
 * `[data-slot=locked] > *` as well.
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
  /** The one control to lock, as a single element (a button, a trigger, a checkbox): Locked adds its props to it. */
  children: Lockable
  /**
   * Classes for the wrapper around the control and its reason. Without a reason the wrapper is `display: contents`
   * (it has no box), so they go on the control itself.
   */
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

  // A form reset puts a hidden <input> back to the checked state it was first drawn with, which can differ from what the
  // locked control shows (the app changed it since). The reset runs straight after its event, so the inputs inside are
  // put back as they were a microtask later: a locked control's form value doesn't change by a reset either.
  React.useEffect(() => {
    if (!reason) return
    const onReset = (e: Event) => {
      const el = box.current
      if (!el || !(e.target instanceof Node) || !e.target.contains(el)) return
      const inputs = Array.from(el.querySelectorAll<HTMLInputElement>(hiddenInputs))
      const was = inputs.map((input) => input.checked)
      queueMicrotask(() => inputs.forEach((input, i) => (input.checked = was[i]!)))
    }
    document.addEventListener("reset", onReset, true)
    return () => document.removeEventListener("reset", onReset, true)
  }, [reason])

  const block = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // On a Base UI part (a trigger, a menu item, a switch), this also stops the part's own handler from running.
    stopBaseUI(e)
    setPress((n) => n + 1)
    setShaking(true)
    setHeld(true)
  }
  // The same element either way, so the control is never drawn anew when a reason comes or goes: focus, and a screen
  // reader's place, stay on it. Without a reason only the classes the wrapper would have had are added (a layout class
  // isn't lost); its own handlers and description pass through untouched.
  const control = reason
    ? React.cloneElement(children, {
        "aria-disabled": true,
        // The reason joins whatever already describes the control (a hint, an error), rather than replacing it.
        "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" "),
        "data-locked": "",
        onClick: block,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " " || (opensPopup(e) && (e.key === "ArrowDown" || e.key === "ArrowUp"))) block(e)
        },
        // Base UI's Select and Menu triggers open on the press itself, before the click: their handler is stopped there.
        // The press goes on otherwise (focus, and other layers' outside-press), and the click that follows shows the reason.
        onPointerDown: (e: React.PointerEvent) => {
          if (opensPopup(e)) stopBaseUI(e)
          else children.props.onPointerDown?.(e)
        },
        onMouseDown: (e: React.MouseEvent) => {
          if (opensPopup(e)) stopBaseUI(e)
          else children.props.onMouseDown?.(e)
        },
      })
    : className
      ? React.cloneElement(children, { className: cn(children.props.className, className) })
      : children

  return (
    // The wrapper is always drawn, so the tree doesn't change shape when a reason comes or goes. Without a reason it is
    // `display: contents`: the page is laid out as if it weren't there.
    <span
      ref={box}
      data-slot="locked"
      data-unlocked={reason ? undefined : ""}
      // A Base UI checkbox, switch or radio keeps its state in a hidden <input> beside it, and that input takes the
      // control's `id`: a label pointing at it, or wrapping it, clicks the input, not the control. Cancelling that click
      // here, before it reaches the input, leaves the control unchanged (Base UI ignores a change whose click was
      // cancelled), whether it came from a label, a radio group's arrow keys, or anything else.
      onClickCapture={(e) => {
        if (reason && e.target instanceof HTMLInputElement && e.target.matches(hiddenInputs)) e.preventDefault()
      }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShaking(false)
      }}
      data-pressed={reason && held ? "" : undefined}
      // Inline rather than a class, so it holds whatever CSS the page has.
      style={reason ? refuseMotion : unlockedStyle}
      className={reason ? cn("relative inline-flex flex-col items-start gap-1.5", shaking && "cd-refuse", className) : undefined}
    >
      {inline ? (
        control
      ) : (
        // Always here, disabled without a reason, so the control keeps its place in the tree. The reason already
        // describes the control (the sr-only text below), so the tooltip doesn't describe it again.
        <Tooltip open={reason ? shown || held : false} onOpenChange={setShown} describes={false} disabled={!reason}>
          <TooltipTrigger render={control} />
          {reason ? <TooltipContent>{reason}</TooltipContent> : null}
        </Tooltip>
      )}
      {reason ? (
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
      ) : null}
    </span>
  )
}

export { Locked }
