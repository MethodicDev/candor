"use client"

import * as React from "react"
import { CircleAlert, Inbox, LockKeyhole, SearchX, WifiOff, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CopyField } from "@/registry/parts/copy-field"
import { useStrings } from "@/registry/foundation/locale"
import { Skeleton } from "@/registry/ui/skeleton"
import { Button } from "@/registry/ui/button"

/** PageState's fixed words; override them under `pageState` in LocaleProvider's `strings`. */
export const pageStateStrings = {
  requestId: "Request id",
  loading: "Loading",
  /** A list's error state, when the app passes `onRetry`. */
  retry: "Try again",
}

export type PageStateKind = "empty" | "no-match" | "error" | "unavailable" | "offline"

const kindIcon: Record<PageStateKind, LucideIcon> = { empty: Inbox, "no-match": SearchX, error: CircleAlert, unavailable: LockKeyhole, offline: WifiOff }

/**
 * What a page shows instead of its content: nothing here yet (empty), nothing
 * matches the filters (no-match), something broke (error), it can't be
 * shown to you (unavailable), or the service can't be reached from here
 * (offline). The words are the caller's, since they are the
 * product's. An error carries the request id to quote; "unavailable" is for
 * both "doesn't exist" and "not yours", so it never reveals which.
 *
 * @keywords 404
 * @job 404
 * @job not found
 * @job error page/screen
 * @job page/screen error
 */
function PageState({
  kind,
  title,
  detail,
  action,
  secondary,
  requestId,
  Icon,
  className,
}: {
  /** empty, no-match, error, unavailable or offline; sets the icon, and an error or offline is announced. */
  kind: PageStateKind
  /** What's going on, in the product's words. */
  title: string
  /** More on why, or what to do, under the title. */
  detail?: React.ReactNode | undefined
  /** The one thing to do next. */
  action?: { label: string; onClick: () => void } | undefined
  /** A quieter second option, e.g. clear filters. */
  secondary?: { label: string; onClick: () => void } | undefined
  /** For errors: the id support needs. */
  requestId?: string | undefined
  /** Replaces the kind's icon. */
  Icon?: LucideIcon | undefined
  className?: string | undefined
}) {
  const t = useStrings("pageState", pageStateStrings)
  const Glyph = Icon ?? kindIcon[kind]
  return (
    <div data-slot="page-state" data-kind={kind} role={kind === "error" || kind === "offline" ? "alert" : undefined} className={cn("flex flex-1 flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <span className={cn("mb-4 flex size-11 items-center justify-center rounded-xl", kind === "error" || kind === "offline" ? "bg-destructive-weak text-destructive-text" : "bg-muted text-muted-foreground")}>
        <Glyph aria-hidden className="size-5" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {detail && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{detail}</p>}
      {requestId && (
        <div className="mt-4 w-full max-w-xs text-start">
          <CopyField label={t("requestId")} value={requestId} />
        </div>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {action && (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondary && (
            <Button size="sm" variant="ghost" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** A page that's loading: the shape of what's coming, announced once. */
function PageSkeleton({ variant = "list", label, className }: {
  /** The shape to sketch: rows of a list (the default) or one item's detail. */
  variant?: "list" | "detail" | undefined
  /** What's loading, announced to screen readers. Defaults to "Loading". */
  label?: string | undefined
  className?: string | undefined
}) {
  const t = useStrings("pageState", pageStateStrings)
  return (
    <div data-slot="page-skeleton" role="status" aria-label={label ?? t("loading")} className={cn("flex flex-1 flex-col gap-3 px-4 py-6 sm:px-6", className)}>
      {variant === "list" ? (
        Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))
      ) : (
        <>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-4 h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </>
      )}
    </div>
  )
}

/**
 * What a list or table is showing: its rows (ready), the shape of rows still coming
 * (loading), nothing and why (empty), the rows it has with a note on what's missing (partial), or why it couldn't
 * load (error). Lists without a `state` show their rows.
 */
export type ListState =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "empty"; reason: string }
  | { kind: "partial"; note: string }
  | { kind: "error"; reason: string }

/** The words a list shows for its `state`: what's loading, the empty title and the error title, in the list's own terms. */
export type ListStateWords = { loading: string; empty: string; error: string }

/**
 * A list's body for its `state`. Ready (or no state) shows the rows; partial shows them under its note; loading
 * sketches rows with PageSkeleton; empty and error say so with PageState in the list's own words, the state's reason
 * underneath. An error offers Try again only when the list was given `onRetry`. Every list with a `state` prop draws
 * it through this, so they all look and read the same.
 */
function ListStateView({ state, words, emptyAction, onRetry, children, className }: {
  /** The list's state; undefined shows the rows. */
  state?: ListState | undefined
  /** The list's own words for loading, empty and error. */
  words: ListStateWords
  /** The one thing to do when the list is empty, e.g. create the first one. */
  emptyAction?: { label: string; onClick: () => void } | undefined
  /** Shows Try again under an error; called when it's pressed. Pass it only when it loads the list again. */
  onRetry?: (() => void) | undefined
  /** The rows. */
  children?: React.ReactNode | undefined
  className?: string | undefined
}) {
  const t = useStrings("pageState", pageStateStrings)
  if (!state || state.kind === "ready") return children
  if (state.kind === "partial")
    return (
      <>
        <p data-slot="list-state-note" className="border-b px-4 py-2 text-xs text-warning-text">{state.note}</p>
        {children}
      </>
    )
  if (state.kind === "loading") return <PageSkeleton label={words.loading} className={cn("flex-none", className)} />
  return (
    <PageState
      kind={state.kind}
      title={state.kind === "error" ? words.error : words.empty}
      detail={state.reason}
      action={state.kind === "empty" ? emptyAction : onRetry && { label: t("retry"), onClick: onRetry }}
      className={cn("flex-none py-10", className)}
    />
  )
}

export { PageState, PageSkeleton, ListStateView }
