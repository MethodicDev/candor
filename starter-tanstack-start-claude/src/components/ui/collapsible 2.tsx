"use client"

import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { withRender, type RenderProp } from "@/lib/render-prop"

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
 * state is seen settling rather than snapping; data-motion="none" and the OS's reduced-motion setting make it snap.
 */
function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn("data-[state=open]:animate-collapse-down data-[state=closed]:animate-collapse-up", className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
