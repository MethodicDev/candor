"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { type RenderProp } from "@/registry/foundation/render-prop"
import { cn } from "@/lib/utils"
import { motion } from "@/registry/foundation/motion"

const tickMotion = motion("checkbox", "tick", "mark")

/**
 * A box the person ticks. Nothing is checked until the person checks it or the app says so with `checked` or
 * `defaultChecked`; a choice that decides something is left empty, never pre-ticked. `checked="indeterminate"` shows a
 * dash for a parent whose children are only partly ticked. Pair it with a `Label` (`htmlFor` and `id`), or wrap both
 * in a <label>. To lock it, wrap it in `Locked` with a reason: it stays focusable, says why, and doesn't change.
 *
 * @motion mark:tick The tick draws along its path when the person checks the box. A box that is already checked when it
 * appears, or that the app changes, shows its tick at once: nothing is drawn for a change the person didn't make.
 */
function Checkbox(allProps: React.ComponentProps<typeof CheckboxPrimitive.Root> & RenderProp) {
  const { className, onCheckedChange, render, nativeButton: _nativeButton, children, ...props } = allProps
  // The tick is drawn only for the state the person just set. An app-driven `checked` that differs retires it, so a later
  // app change (even to the same value) shows the tick at once.
  const [personSet, setPersonSet] = React.useState<boolean | "indeterminate" | undefined>(undefined)
  if (personSet !== undefined && props.checked !== undefined && props.checked !== personSet) setPersonSet(undefined)
  const byPerson = personSet !== undefined && (props.checked === undefined || props.checked === personSet)
  const mark = children ?? (
    <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="group/mark grid place-content-center text-current">
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5 group-data-[state=indeterminate]/mark:hidden"
      >
        <path d="M3.5 8.5 6.75 11.5 12.5 4.75" pathLength={1} strokeDasharray={1} style={tickMotion} className={cn(byPerson && "cd-mark")} />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="hidden size-3.5 group-data-[state=indeterminate]/mark:block"
      >
        <path d="M4 8h8" />
      </svg>
    </CheckboxPrimitive.Indicator>
  )
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      onCheckedChange={(checked) => {
        setPersonSet(checked)
        onCheckedChange?.(checked)
      }}
      className={cn(
        "peer relative after:absolute after:-inset-1 grid size-4 shrink-0 place-content-center rounded-xs border border-input bg-card text-primary-foreground shadow-xs cd-tint outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/80 disabled:cursor-not-allowed disabled:opacity-45 data-[locked]:cursor-not-allowed data-[locked]:opacity-45 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary aria-invalid:border-destructive aria-invalid:ring-destructive/25 dark:bg-input/30",
        className
      )}
      {...props}
      {...(render ? { asChild: true } : null)}
    >
      {render ? React.cloneElement(render, undefined, mark) : mark}
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
