import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { withRender, type RenderProp } from "@/lib/candor/render-prop"
import { motion } from "@/lib/candor/motion"

/**
 * @motion reveal:open The content grows to its full height when the person opens it and shrinks when they close it. A
 * collapsible that is already open when it first appears is shown open at once, and under reduced motion it snaps
 * open or shut.
 */
const openMotion = motion("collapsible", "open", "reveal")

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger(allProps: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger> & RenderProp) {
  const props = withRender(allProps)
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

/**
 * The content opens and closes to the height Radix measured (--radix-collapsible-content-height), so a change of
 * state is seen settling rather than snapping (the reveal family); data-motion="none" and the calm level make it snap.
 * An item can pass its own moment's chain as `style` (`motion("tool-call", "open", "reveal")`).
 */
function CollapsibleContent({
  className,
  style,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      style={{ ...openMotion, ...style }}
      className={cn("data-[state=open]:cd-reveal data-[state=closed]:cd-reveal-out", className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
