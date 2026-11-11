"use client"

import * as React from "react"
import { LockKeyhole } from "lucide-react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"
import { useLocale } from "@/registry/foundation/locale"

const lockedKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"])

/**
 * A control for a value in a range, with one thumb or, when the value has two numbers, a range. Pass `aria-label` (or
 * `aria-labelledby`) to name a single thumb, or `thumbLabels` for each thumb of a range. Arrow keys step, Page keys and
 * Home/End jump. The thumb starts at `min` unless the app gives `defaultValue`; leave it there for a choice the person
 * hasn't made, and show the value beside the slider, since a position alone isn't a number.
 *
 * @motion clock:drag The thumb and the filled range follow the pointer exactly, with no easing: what moves is the
 * person's hand, not an animation.
 * @motion tint:tint The thumb's ring fades in when the pointer is over it and when it takes keyboard focus.
 */
function Slider(allProps: SliderProps) {
  const {
    className,
    locked,
    thumbLabels,
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    min = 0,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    onPointerDownCapture,
    onKeyDownCapture,
    children,
    ...props
  } = allProps
  const { locale } = useLocale()
  const reasonId = React.useId()
  const count = Array.isArray(value) ? value.length : Array.isArray(defaultValue) ? defaultValue.length : 1
  const isLocked = Boolean(locked)
  const asList = (next: number | readonly number[]) => (Array.isArray(next) ? [...next] : [next as number])
  // The thumb's focusable part is Base UI's range input inside it: that is where a lock is announced.
  const markInput = (input: HTMLInputElement | null) => {
    if (!input) return
    if (isLocked) input.setAttribute("aria-disabled", "true")
    else input.removeAttribute("aria-disabled")
  }
  const parts = children ?? (
    <SliderPrimitive.Control
      data-slot="slider-control"
      className="relative flex w-full touch-none items-center select-none data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <SliderPrimitive.Indicator data-slot="slider-range" className="bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
      </SliderPrimitive.Track>
      {Array.from({ length: count }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          index={i}
          data-slot="slider-thumb"
          data-locked={isLocked ? "" : undefined}
          aria-label={thumbLabels?.[i] ?? ariaLabel}
          aria-labelledby={thumbLabels?.[i] ? undefined : ariaLabelledby}
          aria-describedby={isLocked ? reasonId : undefined}
          inputRef={markInput}
          className="relative after:absolute after:-inset-2 block size-4 shrink-0 rounded-full border border-primary bg-card shadow-sm ring-ring/40 cd-tint outline-none hover:ring-[3px] has-focus-visible:ring-[3px] has-focus-visible:ring-ring/80 data-[locked]:cursor-not-allowed data-[locked]:hover:ring-0"
        />
      ))}
    </SliderPrimitive.Control>
  )

  return (
    <>
      <SliderPrimitive.Root
        data-slot="slider"
        data-locked={isLocked ? "" : undefined}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange && ((next) => onValueChange(asList(next)))}
        onValueCommitted={onValueCommit && ((next) => onValueCommit(asList(next)))}
        min={min}
        locale={locale}
        onPointerDownCapture={(e) => {
          onPointerDownCapture?.(e)
          if (!isLocked) return
          // Keep Base UI from starting a drag, but let the thumb take focus so the reason is reachable.
          e.preventDefault()
          e.stopPropagation()
          ;(e.target as HTMLElement).closest<HTMLElement>('[data-slot="slider-thumb"]')?.querySelector("input")?.focus()
        }}
        onKeyDownCapture={(e) => {
          onKeyDownCapture?.(e)
          if (isLocked && lockedKeys.has(e.key)) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        className={cn(
          "relative flex w-full touch-none items-center select-none data-[locked]:cursor-not-allowed data-[locked]:opacity-45 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45",
          className
        )}
        {...props}
      >
        {parts}
      </SliderPrimitive.Root>
      {isLocked ? (
        <p id={reasonId} data-slot="slider-reason" className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <LockKeyhole aria-hidden className="size-3" />
          {locked}
        </p>
      ) : null}
    </>
  )
}

type SliderProps = Omit<SliderPrimitive.Root.Props, "className" | "value" | "defaultValue" | "onValueChange" | "onValueCommitted"> & {
  /** Classes, merged with Candor's. */
  className?: string | undefined
  /** The thumbs' values, when the app controls them: one number, or two for a range. */
  value?: number[] | undefined
  /** The thumbs' values at first, when the slider keeps its own state. */
  defaultValue?: number[] | undefined
  /** Called with the thumbs' values as the person moves one. */
  onValueChange?: ((value: number[]) => void) | undefined
  /** Called with the thumbs' values when the person lets go, or after a key press: the value to act on. */
  onValueCommit?: ((value: number[]) => void) | undefined
  /** Names a single thumb. */
  "aria-label"?: string | undefined
  /** Names a single thumb by the id of the element that labels it. */
  "aria-labelledby"?: string | undefined
  /**
   * Why the slider can't be changed. With a reason it stays focusable but the pointer and arrow keys do nothing, it is
   * marked `aria-disabled` and described by the reason, and the reason is printed under it. Without one the slider is
   * normal. Use this rather than `disabled`, which takes the slider out of the tab order and says nothing.
   */
  locked?: string | undefined
  /**
   * A name for each thumb, in order (a range has two: "Lowest price", "Highest price"). A thumb without one takes
   * `aria-label`; give them in the app's language.
   */
  thumbLabels?: string[] | undefined
}

export { Slider }
