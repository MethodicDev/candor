import { cn } from "@/lib/utils"
import { motion } from "@/registry/lib/motion"

/** Pulses while the content it stands in for is being fetched; still at level 0 and under calm. */
const loadingMotion = motion("skeleton", "loading", "live", { dur: 2000 })

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
