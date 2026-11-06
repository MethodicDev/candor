"use client"

import { Check, Copy, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCopy } from "@/registry/lib/use-copy"
import { useStrings } from "@/registry/blocks/locale"

/** CopyField's fixed words; override them under `copyField` in LocaleProvider's `strings`. */
export const copyFieldStrings = {
  copy: "Copy",
  copied: "Copied",
  failed: "Couldn’t copy",
}

/**
 * A value a person copies somewhere else (a callback URL, a scope list). The
 * whole field is the copy target; it says "Copied" only once the clipboard
 * took the value.
 */
function CopyField({
  label,
  value,
  className,
}: {
  /** What the value is, shown above it. */
  label: string
  /** The text that is shown and copied. */
  value: string
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
        className="group/copy flex w-full items-center gap-2 rounded-lg border bg-sunken px-3 py-2 text-start outline-none transition-colors duration-150 hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring/80"
      >
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
        <span aria-live="polite" className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover/copy:text-foreground">
          {state === "copied" ? (
            <>
              <Check className="size-3 text-success-text" /> {t("copied")}
            </>
          ) : state === "failed" ? (
            <>
              <X className="size-3 text-destructive-text" /> {t("failed")}
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
