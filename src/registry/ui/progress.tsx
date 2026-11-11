"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { useLocale } from "@/registry/foundation/locale"
import { cn } from "@/lib/utils"
import { motion } from "@/registry/foundation/motion"

const valueMotion = motion("progress", "value", "fill")
const indeterminateMotion = motion("progress", "indeterminate", "live")

/**
 * A bar for work whose progress is measured: an upload, an import, an index. It moves only between values the service
 * reported, and it starts at the first value it is given rather than filling from empty. With no `value` it is
 * indeterminate: a pulsing bar and the `label` as text, and never a made-up percentage.
 *
 * @motion fill:value The filled part moves to each new measured value in the slow duration, and not on first draw.
 * @motion live:indeterminate While the total is unknown, the bar pulses (the live family's pulse) and the label shimmers
 * with it; it runs only while that state lasts, and stops the moment a value arrives.
 */
function Progress(allProps: ProgressProps) {
  const { className, value, max = 100, label, children, ...props } = allProps
  const { locale } = useLocale()
  const known = typeof value === "number" && Number.isFinite(value) && max > 0
  const percent = known ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  // Plain elements rather than Base UI's Indicator, which sets its own width: the fill moves on --cd-progress.
  const indicator =
    children ??
    (known ? (
      <div
        key="value"
        data-slot="progress-indicator"
        className="h-full w-[calc(100%+var(--cd-progress))] rounded-full bg-primary cd-fill"
        style={{ ...valueMotion, "--cd-progress": `-${100 - percent}%` } as React.CSSProperties}
      />
    ) : (
      <div
        key="unknown"
        data-slot="progress-indicator"
        style={indeterminateMotion}
        className="size-full cd-live-pulse bg-[linear-gradient(90deg,var(--muted)_0%,var(--primary)_50%,var(--muted)_100%)] opacity-60"
      />
    ))
  return (
    <>
      <ProgressPrimitive.Root
        data-slot="progress"
        value={known ? value : null}
        max={max}
        locale={locale}
        aria-label={label}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        {indicator}
      </ProgressPrimitive.Root>
      {!known && label ? (
        <span data-slot="progress-label" aria-hidden style={indeterminateMotion} className="shimmer-text mt-1.5 block text-xs">
          {label}
        </span>
      ) : null}
    </>
  )
}

type ProgressProps = Omit<ProgressPrimitive.Root.Props, "value" | "max" | "className"> & {
    /** Classes for the bar's track. */
    className?: string | undefined
    /**
     * How far along the work is, from `0` to `max`, as the service reported it. Leave it out (or pass `null`) when the
     * total isn't known: the bar then shows no fraction, only that work is going on, with the `label`. A bar is a claim
     * about a fraction, so the app never estimates one.
     */
    value?: number | null | undefined
    /** The value that means finished. Defaults to 100. */
    max?: number | undefined
    /**
     * What is progressing, in the app's words and language ("Indexing 12 files", "Uploading report.pdf"). It names the
     * bar for assistive technology, and when `value` is unknown it is printed under the bar as the word that says so.
     */
    label?: string | undefined
  }

export { Progress }
