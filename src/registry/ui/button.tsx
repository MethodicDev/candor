"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { withRender, type RenderProp } from "@/registry/foundation/render-prop"
import { cn } from "@/lib/utils"
import { motion } from "@/registry/foundation/motion"

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

function Button(
  allProps: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      /** Render the child element (a link, say) with the button's styles instead of a <button>. */
      asChild?: boolean | undefined
    } & RenderProp
) {
  const { className, style, variant = "default", size = "default", asChild = false, ...props } = withRender(allProps)
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      style={{ ...pressMotion, ...style }}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
