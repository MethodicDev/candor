import { cn } from "@/lib/utils"

/**
 * Text that is still arriving. Shows a caret while `streaming`, and announces
 * politely so screen readers hear the finished text rather than every token.
 */
function StreamingText({
  text,
  streaming = false,
  className,
}: {
  /** The text so far. */
  text: string
  /** Show a caret while more is arriving; announced once when it stops. */
  streaming?: boolean
  className?: string
}) {
  return (
    <div
      data-slot="streaming-text"
      aria-live="polite"
      aria-busy={streaming}
      className={cn("whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-foreground", className)}
    >
      {text}
      {streaming && (
        <span
          aria-hidden
          className="ms-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-primary animate-caret"
        />
      )}
    </div>
  )
}

/** A label that shimmers while an agent is working ("Thinking", "Reading the docs"). */
function ShimmerLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn("shimmer-text text-sm font-medium", className)}>{children}</span>
}

export { StreamingText, ShimmerLabel }
