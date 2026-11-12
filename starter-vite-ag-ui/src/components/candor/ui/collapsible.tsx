import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { cn } from "@/lib/utils"
import { motion } from "@/lib/candor/motion"

/**
 * @motion reveal:open The content grows to its full height when the person opens it and shrinks when they close it. A
 * collapsible that is already open when it first appears is shown open at once, and under reduced motion it snaps
 * open or shut.
 */
const openMotion = motion("collapsible", "open", "reveal")

/** One section that opens and closes to show or hide its content, controlled by a trigger. */
function Collapsible({ className, ...props }: Omit<CollapsiblePrimitive.Root.Props, "className"> & { className?: string | undefined }) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" className={className} {...props} />
}

/** The button that opens and closes a `Collapsible`. It reports its state to screen readers. */
function CollapsibleTrigger({ className, ...props }: Omit<CollapsiblePrimitive.Trigger.Props, "className"> & { className?: string | undefined }) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" className={className} {...props} />
}

/**
 * The content opens and closes to the height Base UI measured (--collapsible-panel-height), so a change of state is
 * seen settling rather than snapping (the reveal family); data-motion="none" and the calm level make it snap. An item
 * can pass its own moment's chain as `style` (`motion("tool-call", "open", "reveal")`). `forceMount` keeps the content
 * in the page while it is closed (hidden), as Base UI's `keepMounted` does.
 */
function CollapsibleContent({
  className,
  style,
  forceMount,
  keepMounted,
  ...props
}: Omit<CollapsiblePrimitive.Panel.Props, "className" | "style"> & {
  /** Classes, merged with Candor's. */
  className?: string | undefined
  /** Inline styles, merged over the part's motion chain. */
  style?: React.CSSProperties | undefined
  /** Keeps the content in the page, hidden, while it is closed. The same as Base UI's `keepMounted`. */
  forceMount?: boolean | undefined
}) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      keepMounted={keepMounted ?? forceMount}
      style={{ ...openMotion, ...style }}
      className={cn("overflow-hidden data-open:cd-reveal data-closed:cd-reveal-out", className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
