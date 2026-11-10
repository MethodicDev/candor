"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { motion } from "@/registry/foundation/motion"

const enterMotion = motion("alert", "enter", "arrive")

// Set one frame after this file loads in the browser, which is when the page's first draw is done; an Alert that mounts
// after that has arrived. It is per page load, not per route: after a client-side route change, an Alert on the new route
// rises in, because it arrived after the page drew. An Alert in the first render, or on the server, is simply there.
let pageDrawn = false
if (typeof window !== "undefined") {
  const frame = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : (cb: () => void) => window.setTimeout(cb, 0)
  frame(() => {
    pageDrawn = true
  })
}

const subscribeNever = () => () => {}

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        success: "border-success/40 bg-success-weak/60 text-foreground [&>svg]:text-success-text",
        warning: "border-warning/40 bg-warning-weak/60 text-foreground [&>svg]:text-warning-text",
        attention: "border-attention/40 bg-attention-weak/60 text-foreground [&>svg]:text-attention-text",
        destructive: "border-destructive/40 bg-destructive-weak/60 text-foreground [&>svg]:text-destructive-text",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

/**
 * A message about the page or the work that stays where it is until it no longer applies: a warning before a
 * change, a note that something failed, a fact the person should know. Put an icon first, then `AlertTitle` and
 * `AlertDescription`. Its text is plain text from the app, never HTML. An `Alert` is read out when it appears if
 * its variant is `destructive` (role "alert"); the other variants are polite (role "status"). Pass `role` to change that.
 * For a short notice that goes away by itself use a toast; an Alert doesn't dismiss itself.
 *
 * @motion arrive:enter An Alert that appears after the page has drawn rises in over a quarter of a second. One that is
 * there when the page first draws, or that the server rendered, is simply there; after a client-side navigation, an
 * Alert on the new route rises in.
 */
function Alert({
  className,
  variant,
  role,
  style,
  ...props
}: React.ComponentProps<"div"> & {
    /** The kind of message. `destructive` is for a failure or something that can't be undone; `warning` for care before acting; `attention` for something waiting on the person; `success` for a confirmed result. Defaults to a plain card. */
    variant?: "default" | "success" | "warning" | "attention" | "destructive" | null | undefined
}) {
  // Whether this Alert mounted after the page's first draw. The server and the hydrating render answer no, so what
  // the server sent is what hydrates; an Alert the browser creates later answers from the page. Decided once, so a
  // re-render doesn't replay it.
  const drawn = React.useSyncExternalStore(subscribeNever, () => pageDrawn, () => false)
  const [arrived] = React.useState(drawn)
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? "default"}
      role={role ?? (variant === "destructive" ? "alert" : "status")}
      style={{ ...enterMotion, ...style }}
      className={cn(alertVariants({ variant }), arrived && "cd-arrive", className)}
      {...props}
    />
  )
}

/** The alert's headline: what happened or what to know, in a few words. */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)} {...props} />
}

/** The detail under the title: what it affects and what the person can do. Plain text or any elements; links and buttons keep their own styles. */
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
