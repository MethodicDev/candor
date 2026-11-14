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

/** A small panel that opens beside a trigger to show content or a control without leaving the page. */
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

/**
 * The button that opens a `Popover`. A control handed over through `render` (a Button) keeps its own `data-slot`, so the
 * theme and the forced-colour rules still find it; only the trigger's own button is `popover-trigger`. To lock it, put
 * `Locked` around the trigger, not in `render`: `<Locked reason={…}><PopoverTrigger render={<Button />} /></Locked>`.
 * `Locked` passes on nothing the trigger gives it, so in `render` the button would never open the popover.
 */
function PopoverTrigger({ className, render, ...props }: Omit<PopoverPrimitive.Trigger.Props, "className"> & { className?: string | undefined }) {
  return <PopoverPrimitive.Trigger {...(React.isValidElement(render) ? null : { "data-slot": "popover-trigger" })} className={className} render={render} {...props} />
}

/** Where the popup sits against its trigger (or a PopoverAnchor): the props Base UI's Positioner takes. */
type Placement = Pick<PopoverPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "alignOffset" | "collisionPadding" | "sticky">

/** The floating panel a `Popover` shows, for a small form or a few details. */
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

/** Gives `node` to one ref and returns what takes it back: a callback's own cleanup (React 19), or it called with `null`, or the object emptied. */
function giveRef<T>(ref: React.Ref<T> | undefined, node: T | null): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(node)
    return typeof cleanup === "function" ? cleanup : () => ref(null)
  }
  if (!ref) return () => {}
  ;(ref as React.RefObject<T | null>).current = node
  return () => {
    ;(ref as React.RefObject<T | null>).current = null
  }
}

/**
 * One callback ref that gives the element to the app's ref and to the item's own, the same function while neither
 * changes, so React gives the element again only when one does: a ref the app passes after the first render takes over.
 * Each may be an object, a callback (with or without React 19's cleanup) or `undefined`.
 */
function useMergedRef<T>(own: React.Ref<T> | undefined, app: React.Ref<T> | undefined): React.RefCallback<T> {
  return React.useCallback(
    (node: T | null) => {
      const releases = [giveRef(own, node), giveRef(app, node)]
      return () => releases.forEach((release) => release())
    },
    [own, app]
  )
}

/** An element the popover is positioned against instead of its trigger. */
function PopoverAnchor({ ref, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(AnchorContext)
  const setAnchor = context?.setAnchor
  const setRef = useMergedRef<HTMLDivElement>(setAnchor, ref)
  return (
    <div
      data-slot="popover-anchor"
      ref={setRef}
      {...props}
    />
  )
}

/** The top of a `PopoverContent`: its title and description. */
function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-1 text-sm", className)} {...props} />
}

/** The heading of a `Popover`. */
function PopoverTitle({ className, ...props }: Omit<PopoverPrimitive.Title.Props, "className"> & { className?: string | undefined }) {
  // A div, as before Base UI, so a popover's title doesn't join the page's heading outline; it still names the popup.
  return <PopoverPrimitive.Title data-slot="popover-title" render={<div />} className={cn("font-medium", className)} {...props} />
}

/** The line under a `PopoverTitle` saying what the `Popover` is for. */
function PopoverDescription({ className, ...props }: Omit<PopoverPrimitive.Description.Props, "className"> & { className?: string | undefined }) {
  return <PopoverPrimitive.Description data-slot="popover-description" className={cn("text-muted-foreground", className)} {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverHeader, PopoverTitle, PopoverDescription }
