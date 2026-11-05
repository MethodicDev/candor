import * as React from "react"
import { Check, CircleSlash, Hand, LoaderCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { statusLabel, type RunStatus } from "@/lib/status"

export type Step = {
  id: string
  title: React.ReactNode
  status: RunStatus
  detail?: React.ReactNode
  meta?: React.ReactNode
}

function StepMark({
  status,
}: {
  /** The step's status, which picks its mark. */
  status: RunStatus
}) {
  const base = "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full"
  switch (status) {
    case "succeeded":
      return (
        <span className={cn(base, "bg-success text-on-success")}>
          <Check className="size-3" strokeWidth={3} />
        </span>
      )
    case "failed":
      return (
        <span className={cn(base, "bg-destructive text-on-destructive")}>
          <X className="size-3" strokeWidth={3} />
        </span>
      )
    case "running":
      return (
        <span className={cn(base, "bg-accent-weak text-accent-text")}>
          <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.5} />
        </span>
      )
    case "waiting":
      return (
        <span className={cn(base, "bg-warning-weak text-warning-text")}>
          <Hand className="size-3" strokeWidth={2.5} />
        </span>
      )
    case "blocked":
      return (
        <span className={cn(base, "border-[1.5px] border-dashed border-faint-foreground bg-card")} />
      )
    case "cancelled":
    case "skipped":
      return (
        <span className={cn(base, "bg-muted text-faint-foreground")}>
          <CircleSlash className="size-3" strokeWidth={2.5} />
        </span>
      )
    default:
      return (
        <span className={cn(base, "bg-background")}>
          <span className="size-2 rounded-full border-[1.5px] border-faint-foreground/70" />
        </span>
      )
  }
}

/**
 * An ordered list of steps joined by a rail: an agent's plan, its reasoning,
 * a run's stages. The rail fills as steps finish.
 */
function StepList({
  steps,
  className,
}: {
  /** The steps in order, each with a status, and optional detail and meta. */
  steps: Step[]
  className?: string
}) {
  return (
    <ol data-slot="step-list" className={cn("flex flex-col", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        const done = step.status === "succeeded"
        return (
          <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0 animate-rise-in" style={{ animationDelay: `${i * 40}ms` }}>
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-5 bottom-0 left-[9.5px] w-px transition-colors duration-500",
                  done ? "bg-success/50" : "bg-input"
                )}
              />
            )}
            <StepMark status={step.status} />
            <div className="min-w-0 flex-1 pt-px">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.status === "idle" && "text-muted-foreground",
                    (step.status === "skipped" || step.status === "cancelled") && "text-faint-foreground line-through"
                  )}
                >
                  {step.title}
                  <span className="sr-only"> — {statusLabel[step.status]}</span>
                </p>
                {step.meta && <span className="shrink-0 text-xs tabular-nums text-faint-foreground">{step.meta}</span>}
              </div>
              {step.detail && <div className="mt-1 text-[0.8125rem] text-muted-foreground">{step.detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export { StepList, StepMark }
