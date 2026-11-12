import { cn } from "@/lib/utils"
import { motion } from "@/lib/candor/motion"

/**
 * @motion live:loading The placeholder pulses softly for as long as it is on screen, which should be only while the
 * content it stands in for is being fetched. Under reduced motion it is still.
 */
const loadingMotion = motion("skeleton", "loading", "live", { dur: 2000 })

/** A grey placeholder shaped like the content that is loading, which pulses while it waits. */
function Skeleton({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      style={{ ...loadingMotion, ...style }}
      className={cn("cd-live-pulse rounded-md bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
