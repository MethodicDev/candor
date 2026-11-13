"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "@/lib/utils"
import { motion } from "@/lib/candor/motion"

/**
 * @motion press:press The button shrinks a little while it is held down and returns when it is let go. A button that
 * is locked or disabled never moves, and under reduced motion no button changes size.
 */
const pressMotion = motion("button", "press", "press")

// The accent fills the one primary act, the radius is the theme's
// --cd-radius-button, and buttons press down slightly on :active. In forced colours a fill collapses to the system's
// background, so the filled variants draw a 1px ButtonText edge there (outline already has a border).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-(--cd-control-gap,0.5rem) rounded-button text-sm font-medium whitespace-nowrap outline-none select-none cd-press focus-visible:ring-[3px] focus-visible:ring-ring/80 disabled:pointer-events-none disabled:opacity-45 data-[locked]:cursor-not-allowed data-[locked]:opacity-45 data-[locked]:active:scale-100 aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover forced-colors:border forced-colors:border-[ButtonText]",
        destructive: "bg-destructive text-on-destructive hover:bg-destructive/90 focus-visible:ring-destructive/25 forced-colors:border forced-colors:border-[ButtonText]",
        outline: "border border-input bg-card hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent forced-colors:border forced-colors:border-[ButtonText]",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-accent-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-(--cd-control-h-sm,2rem) px-(--cd-control-px-md,0.875rem) has-[>svg]:px-(--cd-control-px,0.75rem)",
        xs: "h-(--cd-control-h-2xs,1.5rem) gap-1 px-(--cd-control-px-xs,0.5rem) text-xs has-[>svg]:px-[calc(var(--cd-control-px-xs,0.5rem)-2px)] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-(--cd-control-h-xs,1.75rem) gap-1.5 px-(--cd-control-px-sm,0.625rem) text-xs has-[>svg]:px-(--cd-control-px-xs,0.5rem) [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-(--cd-control-h-lg,2.5rem) px-(--cd-control-px-lg,1.25rem) text-base has-[>svg]:px-[calc(var(--cd-control-px-lg,1.25rem)-4px)]",
        icon: "size-(--cd-control-h-sm,2rem)",
        "icon-xs": "size-(--cd-control-h-2xs,1.5rem) [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-(--cd-control-h-xs,1.75rem) [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-(--cd-control-h-lg,2.5rem)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Where a pointer pressed the button, in its own box: `--cd-press-x` and `--cd-press-y` on the button, for the Pro
 * motion-drawings item's press ripple. Set only by a press the person made; nothing in the free CSS reads them.
 */
function markPressPoint(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget
  const box = el.getBoundingClientRect()
  el.style.setProperty("--cd-press-x", `${Math.round(event.clientX - box.left)}px`)
  el.style.setProperty("--cd-press-y", `${Math.round(event.clientY - box.top)}px`)
}

/**
 * A press without a pointer (Enter or Space, or a click a key or assistive technology made, whose `detail` is 0) has no
 * point in the box: the last pointer press's point is cleared, so the ripple grows from the middle.
 */
function clearPressPoint(el: HTMLElement) {
  el.style.removeProperty("--cd-press-x")
  el.style.removeProperty("--cd-press-y")
}

/**
 * A button in Candor's theme. It is a native `<button>` (in a form it submits unless given `type="button"`), or the
 * element `render` names, drawn with the button's styles and props.
 *
 * When a pointer presses it, the button notes where, as `--cd-press-x` and `--cd-press-y` in its own style (the point
 * in its box, in pixels), for the Pro motion-drawings item's press ripple to grow from. A press from the keyboard (Enter
 * or Space) or a click with no pointer clears them, so that ripple grows from the middle. Nothing in the free CSS reads
 * them, so the button looks and behaves as it did without them.
 */
function Button({
  className,
  style,
  variant = "default",
  size = "default",
  render,
  nativeButton: _nativeButton,
  onPointerDown,
  onKeyDown,
  onClick,
  ref,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Draws this element (a link, say) with the button's styles and props instead of a <button>:
     * `render={<a href="/docs" />}`. The element keeps its own children unless the button is given some. Base UI's
     * function form, `render={(props) => <a {...props} />}`, works too.
     */
    render?: useRender.RenderProp | undefined
    /**
     * Base UI's flag for a button drawn as another element (shadcn's Base UI rewrite adds `nativeButton={false}` beside
     * `render={<a … />}`). Candor's Button draws the element `render` gives as it is, so the flag changes nothing.
     */
    nativeButton?: boolean | undefined
  }) {
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      ...props,
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        markPressPoint(event)
        onPointerDown?.(event)
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "Enter" || event.key === " ") clearPressPoint(event.currentTarget)
        onKeyDown?.(event)
      },
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        if (event.detail === 0) clearPressPoint(event.currentTarget)
        onClick?.(event)
      },
      style: { ...pressMotion, ...style },
      className: cn(buttonVariants({ variant, size, className })),
    },
  })
}

export { Button, buttonVariants }
