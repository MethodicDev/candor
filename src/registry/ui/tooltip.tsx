"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { withRender, type RenderProp } from "@/registry/foundation/render-prop"
import { motion } from "@/registry/foundation/motion"

/**
 * @motion overlay:open The tooltip fades in and scales up a little from the control it describes once the delay has
 * passed, and fades out when the pointer or focus leaves. Under reduced motion it is a short fade.
 */
const openMotion = motion("tooltip", "open", "overlay")

type TooltipTiming = Pick<React.ComponentProps<typeof TooltipPrimitive.Provider>, "delayDuration" | "skipDelayDuration" | "disableHoverableContent">

// The TooltipProvider above, if any: a lone Tooltip supplies its own when there is none, and a nested provider takes
// the outer one's timing for any setting it leaves out.
const HasProvider = React.createContext<TooltipTiming | null>(null)

/**
 * Tooltip timing for everything below it. A setting left out keeps what a TooltipProvider above set; with none above,
 * tooltips open at once (`delayDuration` 0) and Radix's defaults apply to the rest.
 */
function TooltipProvider({
  delayDuration,
  skipDelayDuration,
  disableHoverableContent,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  const outer = React.useContext(HasProvider)
  const delay = delayDuration ?? outer?.delayDuration ?? 0
  const skip = skipDelayDuration ?? outer?.skipDelayDuration
  const hoverable = disableHoverableContent ?? outer?.disableHoverableContent
  const timing = React.useMemo<TooltipTiming>(
    () => ({ delayDuration: delay, skipDelayDuration: skip, disableHoverableContent: hoverable }),
    [delay, skip, hoverable]
  )
  return (
    <HasProvider.Provider value={timing}>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delay}
        skipDelayDuration={skip}
        disableHoverableContent={hoverable}
        {...props}
      />
    </HasProvider.Provider>
  )
}

/** Works with or without a TooltipProvider above; an app-level one sets the delay for all. */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />
  return React.useContext(HasProvider) !== null ? root : <TooltipProvider>{root}</TooltipProvider>
}

function TooltipTrigger(allProps: React.ComponentProps<typeof TooltipPrimitive.Trigger> & RenderProp) {
  const props = withRender(allProps)
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  style,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        style={{ ...openMotion, ...style }}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background cd-overlay data-[state=closed]:cd-overlay-out",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
