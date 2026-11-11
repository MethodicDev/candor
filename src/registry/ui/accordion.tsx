"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "@/lib/utils"
import { motion } from "@/registry/foundation/motion"

const openMotion = motion("accordion", "open", "reveal")

/**
 * A stack of headings that each open to reveal more. Pass `type="single"` (one open at a time; add `collapsible` so the
 * open one can be closed) or `type="multiple"`. Everything is closed until the person opens it, unless the app names
 * what starts open with `defaultValue` or `value`. Arrow keys move between headings, Home and End go to the first
 * and last, Space or Enter opens and closes.
 */
/** One heading open at a time. */
type SingleAccordion = {
  /** One item open at a time. */
  type: "single"
  /** Whether the open item can be closed, leaving none open. Defaults to false. */
  collapsible?: boolean | undefined
  /** The open item's value, when the app controls it; "" for none. */
  value?: string | undefined
  /** The item open at first, when the accordion keeps its own state. */
  defaultValue?: string | undefined
  /** Called with the open item's value ("" when the person closes it). */
  onValueChange?: ((value: string) => void) | undefined
}

/** Any number of headings open at once. */
type MultipleAccordion = {
  /** Several items may be open at once. */
  type: "multiple"
  collapsible?: undefined
  /** The open items' values, when the app controls them. */
  value?: string[] | undefined
  /** The items open at first, when the accordion keeps its own state. */
  defaultValue?: string[] | undefined
  /** Called with the open items' values. */
  onValueChange?: ((value: string[]) => void) | undefined
}

/**
 * Arrow keys between the headings, and Home and End to the first and last (Base UI follows the newer APG advice and
 * leaves them out; Candor kept them, so a long accordion is quick to move through).
 */
function moveBetweenHeadings(event: React.KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"]
  const from = event.target
  if (!keys.includes(event.key) || !(from instanceof HTMLElement) || from.getAttribute("data-slot") !== "accordion-trigger") return
  // This accordion's own headings, not a nested one's.
  const headings = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-slot="accordion-trigger"]')].filter(
    (h) => h.closest('[data-slot="accordion"]') === event.currentTarget && !h.hasAttribute("disabled")
  )
  const at = headings.indexOf(from)
  if (at < 0) return
  const next = event.key === "Home" ? 0 : event.key === "End" ? headings.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + headings.length) % headings.length
  event.preventDefault()
  headings[next]?.focus()
}

const asList = (value: string | string[] | undefined) => (value === undefined ? undefined : Array.isArray(value) ? value : value ? [value] : [])

function Accordion({
  type,
  collapsible = false,
  value,
  defaultValue,
  onValueChange,
  onKeyDown,
  className,
  ...props
}: Omit<AccordionPrimitive.Root.Props<string>, "className" | "value" | "defaultValue" | "onValueChange" | "multiple"> &
  (SingleAccordion | MultipleAccordion) & { className?: string | undefined }) {
  const changed = onValueChange as ((value: string | string[]) => void) | undefined
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      multiple={type === "multiple"}
      value={asList(value)}
      defaultValue={asList(defaultValue)}
      onValueChange={(next, details) => {
        // A single accordion that isn't collapsible keeps one item open.
        if (type === "single" && !collapsible && next.length === 0) {
          details.cancel()
          return
        }
        changed?.(type === "multiple" ? next : (next[0] ?? ""))
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!event.defaultPrevented) moveBetweenHeadings(event)
      }}
      className={className}
      {...props}
    />
  )
}

/** One heading and its panel. Give it a `value` that is unique in the accordion. */
function AccordionItem({ className, ...props }: Omit<AccordionPrimitive.Item.Props, "className"> & { className?: string | undefined }) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b border-border last:border-b-0", className)} {...props} />
}

/** The heading that opens and closes its panel, with a chevron that turns over when open. Its children are the heading's text. */
function AccordionTrigger({ className, children, ...props }: Omit<AccordionPrimitive.Trigger.Props, "className"> & { className?: string | undefined }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-3 text-start text-sm font-medium outline-none cd-tint hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/80 disabled:pointer-events-none disabled:opacity-45 data-[locked]:cursor-not-allowed data-[locked]:opacity-45 [&[data-panel-open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown aria-hidden style={openMotion} className="pointer-events-none mt-0.5 size-4 shrink-0 text-muted-foreground cd-reveal-turn" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

/**
 * The panel. It opens and closes to the height Base UI measured, so a change is seen settling rather than snapping;
 * data-motion="none" and the OS's reduced-motion setting make it snap.
 *
 * @motion reveal:open The panel grows to its full height when the person opens it and shrinks back when they close it.
 * What the app puts inside it doesn't move. Under reduced motion the panel snaps open or shut.
 */
function AccordionContent({
  className,
  children,
  style,
  forceMount,
  keepMounted,
  ...props
}: Omit<AccordionPrimitive.Panel.Props, "className" | "style"> & {
  /** Classes for the panel's content (inside the part that opens and closes). */
  className?: string | undefined
  /** Inline styles, merged over the part's motion chain. */
  style?: React.CSSProperties | undefined
  /** Keeps the panel in the page, hidden, while it is closed. The same as Base UI's `keepMounted`. */
  forceMount?: boolean | undefined
}) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      keepMounted={keepMounted ?? forceMount}
      // cd-reveal reads Base UI's collapsible height, then the accordion panel's own.
      style={{ ...openMotion, ...style }}
      className="overflow-hidden text-sm data-open:cd-reveal data-closed:cd-reveal-out"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
