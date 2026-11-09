"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { withRender, type RenderProp } from "@/registry/lib/render-prop"
import { cn } from "@/lib/utils"
import { motion } from "@/registry/lib/motion"

const openMotion = motion("accordion", "open", "reveal")

/**
 * A stack of headings that each open to reveal more. Pass `type="single"` (one open at a time; add `collapsible` so the
 * open one can be closed) or `type="multiple"`. Everything is closed until the person opens it, unless the app names
 * what starts open with `defaultValue` or `value`. Arrow keys move between headings, Home and End go to the first
 * and last, Space or Enter opens and closes.
 */
function Accordion(allProps: React.ComponentProps<typeof AccordionPrimitive.Root> & RenderProp) {
  const props = withRender(allProps)
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

/** One heading and its panel. Give it a `value` that is unique in the accordion. */
function AccordionItem(allProps: React.ComponentProps<typeof AccordionPrimitive.Item> & RenderProp) {
  const { className, ...props } = withRender(allProps)
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b border-border last:border-b-0", className)} {...props} />
}

/** The heading that opens and closes its panel, with a chevron that turns over when open. Its children are the heading's text. */
function AccordionTrigger(allProps: React.ComponentProps<typeof AccordionPrimitive.Trigger> & RenderProp) {
  const { className, children, render, nativeButton: _nativeButton, ...props } = allProps
  const heading = (
    <>
      {children}
      <ChevronDown aria-hidden style={openMotion} className="pointer-events-none mt-0.5 size-4 shrink-0 text-muted-foreground cd-reveal-turn" />
    </>
  )
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-3 text-start text-sm font-medium outline-none cd-tint hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/80 disabled:pointer-events-none disabled:opacity-45 data-[locked]:cursor-not-allowed data-[locked]:opacity-45 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
        {...(render ? { asChild: true } : null)}
      >
        {render ? React.cloneElement(render, undefined, heading) : heading}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

/**
 * The panel. It opens and closes to the height Radix measured, so a change is seen settling rather than snapping;
 * data-motion="none" and the OS's reduced-motion setting make it snap.
 *
 * @motion reveal:open The panel grows to its full height when the person opens it and shrinks back when they close it.
 * What the app puts inside it doesn't move. Under reduced motion the panel snaps open or shut.
 */
function AccordionContent(allProps: React.ComponentProps<typeof AccordionPrimitive.Content> & RenderProp) {
  const { className, children, render, nativeButton: _nativeButton, style, ...props } = allProps
  const inner = <div className={cn("pt-0 pb-4", className)}>{children}</div>
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      // cd-reveal reads Radix's collapsible height, then the accordion's own.
      style={{ ...openMotion, ...style }}
      className="overflow-hidden text-sm data-[state=open]:cd-reveal data-[state=closed]:cd-reveal-out"
      {...props}
      {...(render ? { asChild: true } : null)}
    >
      {render ? React.cloneElement(render, undefined, inner) : inner}
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
