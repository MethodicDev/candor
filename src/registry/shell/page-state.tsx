"use client"

import * as React from "react"
import { CircleAlert, Inbox, LockKeyhole, SearchX, WifiOff, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CopyField } from "@/registry/parts/copy-field"
import { neutralizeBidi } from "@/registry/foundation/bidi"
import { useStrings } from "@/registry/foundation/locale"
import { Skeleton } from "@/registry/ui/skeleton"
import { Button } from "@/registry/ui/button"
import type { HeadingLevel } from "@/registry/foundation/heading-level"
import { useHeadingLevel } from "@/registry/foundation/heading-scope"
import type { ListState } from "@/registry/foundation/status"

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
 * Children go under the actions as a wider block, for a first-time home: an inline Composer and an ordered list of the
 * steps, say. Nothing in it takes focus on its own; a page with one task can move focus there itself.
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
  headingLevel,
  children,
  className,
}: {
  /** empty, no-match, error, unavailable or offline; sets the icon, and an error or offline is announced. */
  kind: PageStateKind
  /** What's going on, in the product's words. */
  title: string
  /** More on why, or what to do, under the title. Text is a paragraph; anything else (a list, a link) sits in a block of its own. */
  detail?: React.ReactNode | undefined
  /** The one thing to do next. */
  action?: { label: string; onClick: () => void } | undefined
  /** A quieter second option, e.g. clear filters. */
  secondary?: { label: string; onClick: () => void } | undefined
  /** For errors: the id support needs. */
  requestId?: string | undefined
  /** Replaces the kind's icon. */
  Icon?: LucideIcon | undefined
  /**
   * The level of the title's heading, to fit the page's outline. Left out, it is one below the nearest `HeadingScope`
   * (since 6.0.0), else 2, right below the page's `<h1>`; pass 3 where the state stands in for a section under an
   * `<h2>` with no scope round it. The size stays the same at any level.
   */
  headingLevel?: HeadingLevel | undefined
  /** A wider block under the actions, read from the start edge: a composer, the steps of how it works. */
  children?: React.ReactNode | undefined
  /** Classes for the state, merged with Candor's. */
  className?: string | undefined
}) {
  const t = useStrings("pageState", pageStateStrings)
  const Glyph = Icon ?? kindIcon[kind]
  const Heading = `h${useHeadingLevel(headingLevel)}` as const
  return (
    <div data-slot="page-state" data-kind={kind} role={kind === "error" || kind === "offline" ? "alert" : undefined} className={cn("flex flex-1 flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <span className={cn("mb-4 flex size-11 items-center justify-center rounded-xl", kind === "error" || kind === "offline" ? "bg-destructive-weak text-destructive-text" : "bg-muted text-muted-foreground")}>
        <Glyph aria-hidden className="size-5" />
      </span>
      <Heading className="text-base font-semibold">{neutralizeBidi(title)}</Heading>
      {detail &&
        (typeof detail === "string" || typeof detail === "number" ? (
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{typeof detail === "string" ? neutralizeBidi(detail) : detail}</p>
        ) : (
          <div className="mt-1 max-w-sm text-sm text-muted-foreground">{detail}</div>
        ))}
      {requestId && (
        <div className="mt-4 w-full max-w-xs text-start">
          <CopyField label={t("requestId")} value={requestId} />
        </div>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {action && (
            <Button size="sm" onClick={action.onClick}>
              <bdi>{neutralizeBidi(action.label)}</bdi>
            </Button>
          )}
          {secondary && (
            <Button size="sm" variant="ghost" onClick={secondary.onClick}>
              <bdi>{neutralizeBidi(secondary.label)}</bdi>
            </Button>
          )}
        </div>
      )}
      {children !== undefined && children !== null && children !== false && (
        <div data-slot="page-state-body" className="mt-8 w-full max-w-xl text-start">
          {children}
        </div>
      )}
    </div>
  )
}

/** A count of outlines to sketch: a whole number from 0 to `max`; anything else is the default. */
const outlines = (n: number | undefined, fallback: number, max: number) => (n !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : fallback)
/** The most tile and card outlines a dashboard skeleton draws: enough for the shape, never a page of them. */
const MAX_TILES = 12
const MAX_CARDS = 6

/** A page that's loading: the shape of what's coming, announced once. */
function PageSkeleton({ variant = "list", tiles, cards, label, className }: {
  /**
   * The shape to sketch: rows of a list (the default), one item's detail, or a dashboard: a row of figure tiles
   * (two to a row on a phone) over cards.
   */
  variant?: "list" | "detail" | "dashboard" | undefined
  /** With "dashboard": how many tile outlines in the first row, up to 12. Default 4. Other variants ignore it. */
  tiles?: number | undefined
  /** With "dashboard": how many card outlines under the tiles, up to 6. Default 2. Other variants ignore it. */
  cards?: number | undefined
  /** What's loading, announced to screen readers. Defaults to "Loading". */
  label?: string | undefined
  /** Classes for the skeleton, merged with Candor's. */
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
      ) : variant === "dashboard" ? (
        <>
          {outlines(tiles, 4, MAX_TILES) > 0 && (
            <div
              data-part="tiles"
              className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(var(--cd-skeleton-tiles),minmax(0,1fr))]"
              style={{ "--cd-skeleton-tiles": outlines(tiles, 4, MAX_TILES) } as React.CSSProperties}
            >
              {Array.from({ length: outlines(tiles, 4, MAX_TILES) }, (_, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              ))}
            </div>
          )}
          {outlines(cards, 2, MAX_CARDS) > 0 && (
            <div data-part="cards" className={cn("grid gap-3", outlines(cards, 2, MAX_CARDS) > 1 && "sm:grid-cols-2")}>
              {Array.from({ length: outlines(cards, 2, MAX_CARDS) }, (_, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-xl border p-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              ))}
            </div>
          )}
        </>
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

/** The words a list shows for its `state`: what's loading, the empty title and the error title, in the list's own terms. */
export type ListStateWords = { loading: string; empty: string; error: string }

/**
 * A list's body for its `state`. Ready (or no state) shows the rows; partial shows them under its note; loading
 * sketches rows with PageSkeleton; empty and error say so with PageState in the list's own words, the state's reason
 * underneath. An error offers Try again only when the list was given `onRetry`. Every list with a `state` prop draws
 * it through this, so they all look and read the same.
 */
function ListStateView({ state, words, emptyAction, onRetry, headingLevel, children, className }: {
  /** The list's state; undefined shows the rows. */
  state?: ListState | undefined
  /** The list's own words for loading, empty and error. */
  words: ListStateWords
  /** The one thing to do when the list is empty, e.g. create the first one. */
  emptyAction?: { label: string; onClick: () => void } | undefined
  /** Shows Try again under an error; called when it's pressed. Pass it only when it loads the list again. */
  onRetry?: (() => void) | undefined
  /**
   * The level of the empty or error title's heading, passed to PageState. Left out, it is one below the nearest
   * `HeadingScope`, else 2. A list under its own heading with no scope round it passes one below that heading.
   */
  headingLevel?: HeadingLevel | undefined
  /** The rows. */
  children?: React.ReactNode | undefined
  /** Classes for the state, merged with Candor's. */
  className?: string | undefined
}) {
  const t = useStrings("pageState", pageStateStrings)
  if (!state || state.kind === "ready") return children
  if (state.kind === "partial")
    return (
      <>
        <p data-slot="list-state-note" className="border-b px-4 py-2 text-xs text-warning-text">{neutralizeBidi(state.note)}</p>
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
      headingLevel={headingLevel}
      className={cn("flex-none py-10", className)}
    />
  )
}

export { PageState, PageSkeleton, ListStateView }
/** What a list or table is showing; the status module's `ListState`, exported here too as in 5.x. */
export type { ListState }
