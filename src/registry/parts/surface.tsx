import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Candor's cards are borderless grey grounds with large radii; in an app they
// also need a bordered and a floating form. One component carries all three so
// no screen hand-rolls its own card.
const surfaceVariants = cva("relative text-card-foreground", {
  variants: {
    tone: {
      plain: "bg-card border",
      muted: "bg-muted",
      subtle: "bg-sunken border",
      raised: "bg-card border shadow-raised",
      floating: "bg-popover border shadow-float",
      accent: "bg-accent-weak text-foreground",
    },
    radius: {
      md: "rounded-lg",
      lg: "rounded-xl",
      xl: "rounded-2xl",
    },
    pad: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-6",
    },
  },
  defaultVariants: { tone: "plain", radius: "xl", pad: "md" },
})

/** A container with Candor's card colours, border, radius and padding, for grouping content that isn't a card with a header. */
function Surface({
  className,
  tone,
  radius,
  pad,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) {
  return <div data-slot="surface" className={cn(surfaceVariants({ tone, radius, pad }), className)} {...props} />
}

export { Surface, surfaceVariants }
