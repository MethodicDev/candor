"use client"

import { Check, Copy, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCopy } from "@/registry/lib/use-copy"
import { useStrings } from "@/registry/blocks/locale"
import { motion } from "@/registry/lib/motion"

/**
 * @motion pop:tick After the person copies, a tick (or a cross, if the browser refused the clipboard) pops in on the
 * button once the browser has answered. Nothing shows before the answer, and under reduced motion it fades in.
 */
const tickMotion = motion("copy-field", "tick", "pop")

/** CopyField's fixed words; override them under `copyField` in LocaleProvider's `strings`. */
export const copyFieldStrings = {
  copy: "Copy",
  copied: "Copied",
  failed: "Couldn’t copy",
}

/**
 * A value a person copies somewhere else (a callback URL, a scope list). The
 * whole field is the copy target; it says "Copied" only once the clipboard
 * took the value, and its tick (or the cross of a refused write) appears then,
 * never while the write is still pending.
 *
 * The whole value is shown: it wraps, breaking a long command, key or URL at any character where it must, so it can be
 * read before it's copied on a phone or at 400% zoom (WCAG 1.4.10, reflow). For a one-line field set `truncate`: the
 * value is cut off with an ellipsis, screen readers still read all of it, and it shows in full while the field has
 * focus.
 */
function CopyField({
  label,
  value,
  truncate = false,
  className,
}: {
  /** What the value is, shown above it. */
  label: string
  /** The text that is shown and copied. */
  value: string
  /** Keeps the value on one line, ending in an ellipsis where it doesn't fit. It shows in full while the field has focus, and screen readers read all of it. Left out, the value wraps. */
  truncate?: boolean | undefined
  className?: string | undefined
}) {
  const { state, copy } = useCopy()
  const t = useStrings("copyField", copyFieldStrings)
  return (
    <div data-slot="copy-field" className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => copy(value)}
        className="group/copy flex w-full items-center gap-2 rounded-lg border bg-sunken px-(--cd-control-px,0.75rem) py-(--cd-control-py,0.5rem) text-start outline-none cd-tint hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring/80"
      >
        <code
          data-truncate={truncate ? "" : undefined}
          className={cn(
            "min-w-0 flex-1 font-mono text-xs",
            truncate
              ? "truncate group-focus/copy:overflow-visible group-focus/copy:whitespace-pre-wrap group-focus/copy:[overflow-wrap:anywhere]"
              : "whitespace-pre-wrap [overflow-wrap:anywhere]"
          )}
        >
          {value}
        </code>{" "}
        <span aria-live="polite" data-copy={state} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover/copy:text-foreground">
          {state === "copied" ? (
            <>
              <Check style={tickMotion} className="size-3 text-success-text cd-pop" /> {t("copied")}
            </>
          ) : state === "failed" ? (
            <>
              <X style={tickMotion} className="size-3 text-destructive-text cd-pop" /> {t("failed")}
            </>
          ) : (
            <>
              <Copy className="size-3" /> {t("copy")}
            </>
          )}
        </span>
      </button>
    </div>
  )
}

export { CopyField }
