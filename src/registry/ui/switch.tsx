"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"
import { motion } from "@/registry/foundation/motion"

const thumbMotion = motion("switch", "thumb", "move")

/**
 * A setting that is on or off. It is off until the person turns it on or the app says so with `checked` or
 * `defaultChecked`. Space or Enter flips it. Pair it with a `Label`. To lock it, wrap it in `Locked` with a reason: it
 * stays focusable, says why, and doesn't flip. Use a switch for a setting that takes effect at once; a choice the
 * person confirms belongs in a `Checkbox` or `RadioGroup` with a button.
 *
 * @motion move:thumb The thumb slides to the other end when the state changes, over the move family's 200 ms. It follows the
 * reading direction, so it slides the other way in right-to-left text.
 */
function Switch({ className, children, ...props }: Omit<SwitchPrimitive.Root.Props, "className"> & { className?: string | undefined }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative after:absolute after:-inset-1 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent bg-input shadow-xs cd-tint outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/80 data-disabled:cursor-not-allowed data-disabled:opacity-45 data-[locked]:cursor-not-allowed data-[locked]:opacity-45 data-checked:bg-primary aria-invalid:ring-destructive/25",
        className
      )}
      {...props}
    >
      {children ?? (
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          style={thumbMotion}
          className="pointer-events-none block size-4 rounded-full bg-card shadow-sm ring-0 cd-move data-checked:translate-x-[calc(100%-2px)] data-checked:bg-primary-foreground data-unchecked:translate-x-0 rtl:data-checked:-translate-x-[calc(100%-2px)]"
        />
      )}
    </SwitchPrimitive.Root>
  )
}

export { Switch }
