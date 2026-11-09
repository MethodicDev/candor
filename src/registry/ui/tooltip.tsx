"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { withRender, type RenderProp } from "@/registry/lib/render-prop"
import { motion } from "@/registry/lib/motion"

/**
 * @motion overlay:open The tooltip fades in and scales up a little from the control it describes once the delay has
 * passed, and fades out when the pointer or focus leaves. Under reduced motion it is a short fade.
 */
const openMotion = motion("tooltip", "open", "overlay")

// Whether a TooltipProvider is above, so a lone Tooltip can supply its own.
const HasProvider = React.createContext(false)

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <HasProvider.Provider value>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
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
  return React.useContext(HasProvider) ? root : <TooltipProvider>{root}</TooltipProvider>
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
