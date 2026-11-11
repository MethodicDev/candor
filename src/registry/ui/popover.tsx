"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { LayerPortal, LayerRoot, layerClass, useLayerRoot } from "@/registry/foundation/layer"
import { motion } from "@/registry/foundation/motion"

/**
 * @motion overlay:open The popover fades in and scales up a little from its trigger when the person opens it, and
 * fades out when it closes. Under reduced motion it is a short fade.
 */
const openMotion = motion("popover", "open", "overlay")

/** The element a PopoverAnchor names, which PopoverContent positions against instead of the trigger. */
const AnchorContext = React.createContext<{ anchor: HTMLElement | null; setAnchor: (el: HTMLElement | null) => void } | null>(null)

function Popover({ onOpenChange, children, ...props }: PopoverPrimitive.Root.Props) {
  const layer = useLayerRoot(onOpenChange)
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  return (
    <LayerRoot anchor={layer.anchor}>
      <AnchorContext.Provider value={{ anchor, setAnchor }}>
        <PopoverPrimitive.Root data-slot="popover" onOpenChange={layer.onOpenChange} {...props}>
          {children}
        </PopoverPrimitive.Root>
      </AnchorContext.Provider>
    </LayerRoot>
  )
}

function PopoverTrigger({ className, ...props }: Omit<PopoverPrimitive.Trigger.Props, "className"> & { className?: string | undefined }) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" className={className} {...props} />
}

/** Where the popup sits against its trigger (or a PopoverAnchor): the props Base UI's Positioner takes. */
type Placement = Pick<PopoverPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "alignOffset" | "collisionPadding" | "sticky">

function PopoverContent({
  className,
  style,
  align = "center",
  alignOffset,
  side = "bottom",
  sideOffset = 4,
  collisionPadding,
  sticky,
  ...props
}: Omit<PopoverPrimitive.Popup.Props, "className" | "style"> &
  Placement & {
    /** Classes, merged with Candor's. */
    className?: string | undefined
    /** Inline styles, merged over the part's motion chain. */
    style?: React.CSSProperties | undefined
  }) {
  const anchor = React.useContext(AnchorContext)?.anchor
  return (
    <LayerPortal portal={PopoverPrimitive.Portal}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        sticky={sticky}
        anchor={anchor ?? undefined}
        className={cn("isolate z-50", layerClass)}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          style={{ ...openMotion, ...style }}
          className={cn(
            "z-50 w-72 origin-(--transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-open:cd-overlay data-closed:cd-overlay-out",
            layerClass,
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </LayerPortal>
  )
}

/** An element the popover is positioned against instead of its trigger. */
function PopoverAnchor({ ref, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(AnchorContext)
  const setAnchor = context?.setAnchor
  return (
    <div
      data-slot="popover-anchor"
      ref={(el) => {
        setAnchor?.(el)
        if (typeof ref === "function") ref(el)
        else if (ref) ref.current = el
      }}
      {...props}
    />
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-1 text-sm", className)} {...props} />
}

function PopoverTitle({ className, ...props }: Omit<PopoverPrimitive.Title.Props, "className"> & { className?: string | undefined }) {
  // A div, as before Base UI, so a popover's title doesn't join the page's heading outline; it still names the popup.
  return <PopoverPrimitive.Title data-slot="popover-title" render={<div />} className={cn("font-medium", className)} {...props} />
}

function PopoverDescription({ className, ...props }: Omit<PopoverPrimitive.Description.Props, "className"> & { className?: string | undefined }) {
  return <PopoverPrimitive.Description data-slot="popover-description" className={cn("text-muted-foreground", className)} {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverHeader, PopoverTitle, PopoverDescription }
