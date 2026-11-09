import * as React from "react"
import { CircleSlash, Hand, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, useArrived, useSettled } from "@/lib/motion"
import { useStatusLabel, type RunStatus } from "@/lib/status"

/**
 * @motion mark:mark A step's tick or cross is drawn along its path when the step settles while the list is on screen.
 * Steps that were already settled when the list appeared show their mark at once.
 */
const markMotion = motion("step-list", "mark", "mark")
/**
 * @motion fill:rail The line leading to a step fills in when that step finishes while the list is on screen, never
 * ahead of it. Lines for steps that were already finished when the list appeared are full at once.
 */
const railMotion = motion("step-list", "rail", "fill")
/**
 * @motion arrive:arrive A step rises in when the app adds it after the list first drew. The steps the list was drawn
 * with appear still.
 */
const arriveMotion = motion("step-list", "arrive", "arrive")
/**
 * @motion live:working A step that is running shows a spinner that turns until the app reports it finished or failed.
 * Under reduced motion the spinner is still, and the step's status is still written in words.
 */
const workingMotion = motion("step-list", "working", "live", { dur: 1000 })

export type Step = {
  id: string
  title: React.ReactNode
  status: RunStatus
  detail?: React.ReactNode | undefined
  meta?: React.ReactNode | undefined
}

/** A tick, drawn along its path when `draw` is above zero (and again each time it changes). */
function Tick({ draw }: { draw: number }) {
  return (
    <svg key={draw} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3">
      <path d="M20 6 9 17l-5-5" pathLength={1} style={markMotion} className={cn(draw > 0 && "cd-mark")} />
    </svg>
  )
}

/** A cross, its two strokes drawn one after the other when `draw` is above zero. */
function Cross({ draw }: { draw: number }) {
  const drawn = draw > 0 && "cd-mark"
  return (
    <svg key={draw} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3">
      <path d="M18 6 6 18" pathLength={1} style={markMotion} className={cn(drawn)} />
      <path d="m6 6 12 12" pathLength={1} style={markMotion} className={cn(drawn, drawn && "[--cd-mark-step:1]")} />
    </svg>
  )
}

/**
 * A step's status as a mark. When the status reaches done or failed while the mark is on screen, the spinner
 * becomes a tick or cross drawn along its path; a mark that mounts already finished is drawn still.
 */
function StepMark({
  status,
}: {
  /** The step's status, which picks its mark. */
  status: RunStatus
}) {
  const settled = useSettled(status)
  const base = "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full cd-tint"
  switch (status) {
    case "succeeded":
      return (
        <span className={cn(base, "bg-success text-on-success")} data-settled={settled > 0 ? "" : undefined}>
          <Tick draw={settled} />
        </span>
      )
    case "failed":
      return (
        <span className={cn(base, "bg-destructive text-on-destructive")} data-settled={settled > 0 ? "" : undefined}>
          <Cross draw={settled} />
        </span>
      )
    case "running":
      return (
        <span className={cn(base, "bg-accent-weak text-accent-text")}>
          <LoaderCircle style={workingMotion} className="size-3.5 cd-live-spin" strokeWidth={2.5} />
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

function StepRow({
  step,
  arrived,
  last,
}: {
  step: Step
  arrived: boolean
  last: boolean
}) {
  const statusLabel = useStatusLabel()
  const done = step.status === "succeeded"
  const settled = useSettled(step.status)
  return (
    <li style={arriveMotion} className={cn("relative flex gap-3 pb-4 last:pb-0", arrived && "cd-arrive")}>
      {!last && (
        <span aria-hidden className="absolute top-5 bottom-0 start-[9.5px] w-px bg-input">
          {/* The rail fills from a step the moment it is done, grown into place when that was seen; never ahead of it. */}
          {done && (
            <span
              key={settled}
              data-slot="step-rail-fill"
              style={railMotion}
              className={cn("absolute inset-0 origin-top bg-success/50", settled > 0 && "cd-fill-grow [--cd-fill-from:1_0]")}
            />
          )}
        </span>
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
            <span className="sr-only"> — {statusLabel(step.status)}</span>
          </p>
          {step.meta && <span className="shrink-0 text-xs tabular-nums text-faint-foreground">{step.meta}</span>}
        </div>
        {step.detail && <div className="mt-1 text-[0.8125rem] text-muted-foreground">{step.detail}</div>}
      </div>
    </li>
  )
}

/**
 * An ordered list of steps joined by a rail: an agent's plan, its reasoning,
 * a run's stages. The rail fills to each step as it finishes, never ahead of
 * it, and a step that finishes while on screen draws its mark. A step added
 * after the list first drew rises in; the steps it loaded with are still.
 */
function StepList({
  steps,
  className,
}: {
  /** The steps in order, each with a status, and optional detail and meta. */
  steps: Step[]
  className?: string | undefined
}) {
  const arrived = useArrived(React.useMemo(() => steps.map((s) => s.id), [steps]))
  return (
    <ol data-slot="step-list" className={cn("flex flex-col", className)}>
      {steps.map((step, i) => (
        <StepRow key={step.id} step={step} arrived={arrived(step.id)} last={i === steps.length - 1} />
      ))}
    </ol>
  )
}

export { StepList, StepMark }
