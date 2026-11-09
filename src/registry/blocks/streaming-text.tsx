import { cn } from "@/lib/utils"
import { motion } from "@/registry/lib/motion"

/**
 * @motion live:caret While the text is still streaming in, a caret blinks at its end. It goes when streaming stops,
 * and under reduced motion it is a still bar.
 */
const caretMotion = motion("streaming-text", "caret", "live", { dur: 1000 })

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
  streaming?: boolean | undefined
  className?: string | undefined
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
          style={caretMotion}
          className="ms-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-primary cd-live-caret"
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
  className?: string | undefined
}) {
  return <span className={cn("shimmer-text text-sm font-medium", className)}>{children}</span>
}

export { StreamingText, ShimmerLabel }
