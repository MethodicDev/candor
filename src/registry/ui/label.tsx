"use client"

import * as React from "react"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "@/lib/utils"

/**
 * The name of a control. Point it at the control with `htmlFor` and the control's `id`, or wrap both in it. Clicking
 * it focuses or toggles the control. It dims with the control beside it (a `peer`) when that control is disabled or
 * locked, so keep it directly after the control in the markup, or set `data-disabled` on a wrapping `group`.
 */
function Label({
  className,
  render,
  ref,
  onMouseDown,
  ...props
}: React.ComponentProps<"label"> & {
  /** Draws this element instead of a <label>, with the label's styles: `render={<span />}` for a caption that names a group. */
  render?: useRender.RenderProp | undefined
}) {
  return useRender({
    defaultTagName: "label",
    render,
    ref,
    props: {
      "data-slot": "label",
      ...props,
      // A double click on a label doesn't select its text (it toggles or focuses its control instead).
      onMouseDown: (event: React.MouseEvent<HTMLLabelElement>) => {
        onMouseDown?.(event)
        const inControl = event.target instanceof Element && event.target.closest("button, input, select, textarea")
        if (!event.defaultPrevented && !inControl && event.detail > 1) event.preventDefault()
      },
      className: cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-45 peer-disabled:cursor-not-allowed peer-disabled:opacity-45 peer-data-[locked]:cursor-not-allowed peer-data-[locked]:opacity-45",
        className
      ),
    },
  })
}

export { Label }
