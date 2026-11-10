"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { withRender, type RenderProp } from "@/lib/candor/render-prop"
import { cn } from "@/lib/utils"

// The accent fills the one primary act, the radius is the theme's
// --cd-radius-button, and buttons press down slightly on :active.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-button text-sm font-medium whitespace-nowrap outline-none select-none transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 ease-standard active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-45 data-[locked]:cursor-not-allowed data-[locked]:opacity-45 data-[locked]:active:scale-100 aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-on-destructive hover:bg-destructive/90 focus-visible:ring-destructive/25",
        outline: "border border-input bg-card hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-accent-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-8 px-3.5 has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-5 text-base has-[>svg]:px-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
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
      asChild?: boolean
    } & RenderProp
) {
  const { className, variant = "default", size = "default", asChild = false, ...props } = withRender(allProps)
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
