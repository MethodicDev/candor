"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"
import { withRender, type RenderProp } from "@/registry/lib/render-prop"
import { cn } from "@/lib/utils"

/**
 * The name of a control. Point it at the control with `htmlFor` and the control's `id`, or wrap both in it. Clicking
 * it focuses or toggles the control. It dims with the control beside it (a `peer`) when that control is disabled or
 * locked, so keep it directly after the control in the markup, or set `data-disabled` on a wrapping `group`.
 */
function Label(allProps: React.ComponentProps<typeof LabelPrimitive.Root> & RenderProp) {
  const { className, ...props } = withRender(allProps)
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-45 peer-disabled:cursor-not-allowed peer-disabled:opacity-45 peer-data-[locked]:cursor-not-allowed peer-data-[locked]:opacity-45",
        className
      )}
      {...props}
    />
  )
}

export { Label }
