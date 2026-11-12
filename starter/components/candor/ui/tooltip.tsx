"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { LayerPortal, LayerRoot, layerClass, useLayerRoot } from "@/lib/candor/layer"
import { motion } from "@/lib/candor/motion"

/**
 * @motion overlay:open The tooltip fades in and scales up a little from the control it describes once the delay has
 * passed, and fades out when the pointer or focus leaves. Under reduced motion it is a short fade.
 */
const openMotion = motion("tooltip", "open", "overlay")

type TooltipTiming = Pick<TooltipPrimitive.Provider.Props, "delay" | "closeDelay" | "timeout"> & { disableHoverablePopup?: boolean | undefined }

// The TooltipProvider above, if any: a lone Tooltip supplies its own when there is none, and a nested provider takes
// the outer one's timing for any setting it leaves out.
const HasProvider = React.createContext<TooltipTiming | null>(null)

/**
 * Tooltip timing for everything below it, in Base UI's names: `delay` before a tooltip opens, `closeDelay` before it
 * closes, and `timeout`, the window in which the next tooltip opens at once. A setting left out keeps what a
 * TooltipProvider above set; with none above, tooltips open at once (`delay` 0) and Base UI's defaults apply to the rest.
 */
function TooltipProvider({
  delay,
  closeDelay,
  timeout,
  disableHoverablePopup,
  ...props
}: TooltipPrimitive.Provider.Props & {
  /** Closes each tooltip as the pointer leaves its trigger, even towards the tooltip. Left out, false (or what a provider above set). */
  disableHoverablePopup?: boolean | undefined
}) {
  const outer = React.useContext(HasProvider)
  const open = delay ?? outer?.delay ?? 0
  const close = closeDelay ?? outer?.closeDelay
  const skip = timeout ?? outer?.timeout
  const hoverable = disableHoverablePopup ?? outer?.disableHoverablePopup
  const timing = React.useMemo<TooltipTiming>(
    () => ({ delay: open, closeDelay: close, timeout: skip, disableHoverablePopup: hoverable }),
    [open, close, skip, hoverable]
  )
  return (
    <HasProvider.Provider value={timing}>
      <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={open} closeDelay={close} timeout={skip} {...props} />
    </HasProvider.Provider>
  )
}

// The open tooltip's id, for its trigger's `aria-describedby`; null while it is closed. Base UI doesn't link the two.
const Describes = React.createContext<string | null>(null)

/** Works with or without a TooltipProvider above; an app-level one sets the delay for all. */
function Tooltip({
  onOpenChange,
  disableHoverablePopup,
  open,
  defaultOpen,
  describes: describesTrigger = true,
  ...props
}: TooltipPrimitive.Root.Props & {
  /**
   * Whether the open tooltip describes its trigger to screen readers (`aria-describedby`). Left out, true. Set it false
   * only when the trigger already carries the same words, as `Locked` does with its reason, so they aren't read twice.
   */
  describes?: boolean | undefined
}) {
  // Whether it is open, as the app says (`open`) or as Base UI reported last; it decides whether the trigger is described.
  const [shown, setShown] = React.useState(defaultOpen ?? false)
  const layer = useLayerRoot((next: boolean, details: TooltipPrimitive.Root.ChangeEventDetails) => {
    onOpenChange?.(next, details)
    if (!details.isCanceled) setShown(next)
  })
  const timing = React.useContext(HasProvider)
  const id = React.useId()
  const root = (
    <Describes.Provider value={describesTrigger && (open ?? shown) ? id : null}>
      <LayerRoot anchor={layer.anchor}>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          onOpenChange={layer.onOpenChange}
          disableHoverablePopup={disableHoverablePopup ?? timing?.disableHoverablePopup}
          open={open}
          defaultOpen={defaultOpen}
          {...props}
        />
      </LayerRoot>
    </Describes.Provider>
  )
  return timing !== null ? root : <TooltipProvider>{root}</TooltipProvider>
}

/**
 * The control the tooltip describes. While the tooltip is open, the control is described by it (`aria-describedby`, after
 * any description of the control's own), as a screen reader expects.
 */
function TooltipTrigger({ className, render, ...props }: Omit<TooltipPrimitive.Trigger.Props, "className"> & { className?: string | undefined }) {
  // The provider's delay, so a trigger doesn't fall back to Base UI's own 600 ms.
  const timing = React.useContext(HasProvider)
  const describes = React.useContext(Describes)
  const own = (props["aria-describedby"] ?? (React.isValidElement<{ "aria-describedby"?: string | undefined }>(render) ? render.props["aria-describedby"] : undefined)) as
    | string
    | undefined
  const describedBy = describes ? (own ? `${own} ${describes}` : describes) : own
  const drawn =
    describes && React.isValidElement<{ "aria-describedby"?: string | undefined }>(render)
      ? React.cloneElement(render, { "aria-describedby": describedBy })
      : render
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      delay={timing?.delay}
      closeDelay={timing?.closeDelay}
      className={className}
      render={drawn}
      {...props}
      aria-describedby={describedBy}
    />
  )
}

/** The short label a `Tooltip` shows on hover or focus. It repeats what the control's name already says and holds no action. */
function TooltipContent({
  className,
  style,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset,
  collisionPadding,
  children,
  ...props
}: Omit<TooltipPrimitive.Popup.Props, "className" | "style"> &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "alignOffset" | "collisionPadding"> & {
    /** Classes, merged with Candor's. */
    className?: string | undefined
    /** Inline styles, merged over the part's motion chain. */
    style?: React.CSSProperties | undefined
  }) {
  const describes = React.useContext(Describes)
  return (
    <LayerPortal portal={TooltipPrimitive.Portal}>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className={cn("isolate z-50", layerClass)}
      >
        <TooltipPrimitive.Popup
          id={describes ?? undefined}
          data-slot="tooltip-content"
          role="tooltip"
          style={{ ...openMotion, ...style }}
          className={cn(
            "z-50 w-fit origin-(--transform-origin) rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background cd-overlay data-closed:cd-overlay-out",
            layerClass,
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=bottom]:translate-y-[calc(-50%_+_2px)] data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </LayerPortal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
