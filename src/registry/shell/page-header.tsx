"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { neutralizeBidi } from "@/registry/foundation/bidi"
import { useFormat, useStrings } from "@/registry/foundation/locale"
import type { HeadingLevel } from "@/registry/foundation/heading-level"

/** PageHeader's fixed words; override them under `pageHeader` in LocaleProvider's `strings`. */
export const pageHeaderStrings = {
  breadcrumb: "Breadcrumb",
  views: "{title} views",
  /**
   * What a screen reader hears after a tab's words when it has a `count`: "Open, 3". `{count}` is the number in the
   * locale; give plural forms (`{ one: …, other: … }`) where your words need them.
   */
  tabCount: ", {count}",
  /**
   * What a screen reader hears after the title when the header has a `count`: "Approvals, 12". `{count}` is the number
   * in the locale; give plural forms where your words need them.
   */
  count: ", {count}",
}

export type Crumb = { label: string; onClick?: (() => void) | undefined }
/** One view `PageHeader`'s tabs offer. */
export type PageTab = {
  /** Which view it is; compared with `activeTab`. */
  id: string
  /** The words for it. Drawn as text, whatever they hold. */
  label: string
  /**
   * How many things the view holds, drawn after its words in the locale's digits and read in the tab's name ("Open,
   * 3"). `null` or left out: no count, for a number the app doesn't know, so it is never shown as 0. A negative, NaN or
   * infinite number isn't a count of things, and isn't drawn.
   */
  count?: number | null | undefined
}

/** Whether a count is a number to draw: a known, finite one, not below 0, as a count of things can't be. */
const counted = (count: number | null | undefined): count is number => typeof count === "number" && Number.isFinite(count) && count >= 0

/**
 * The top of every page that isn't a thread: where you are (breadcrumb), what
 * the page is, what you can do here (actions), and its views (tabs). Tabs are
 * a nav of views over the same page, marked with aria-current; counts appear
 * only when the service gave one, in the locale's digits, and are read after the tab's words ("Open, 3"). A
 * `count` beside the title says how many things the page holds, drawn and read the same way.
 *
 * @motion tint:tint A tab's text colour changes when the pointer is over it or it has focus, and its underline
 * changes for the current tab. The tab that is current when the header first appears is drawn current at once.
 *
 * @keywords title large
 */
function PageHeader({
  title,
  count,
  description,
  breadcrumb,
  actions,
  tabs,
  activeTab,
  onTabChange,
  headingLevel = 1,
  size = "default",
  className,
}: {
  /** What the page is, as its heading, isolated in its own direction. */
  title: string
  /**
   * How many things the page holds, drawn after the title in its heading, quieter and in the locale's digits, and read
   * as part of the heading ("Approvals, 12"). `null` or left out: no count, for a number the app doesn't know, so it is
   * never shown as 0. A negative, NaN or infinite number isn't drawn either. Left out, the header is drawn as it was
   * without it.
   */
  count?: number | null | undefined
  /** A line under the title saying what the page is for. */
  description?: React.ReactNode | undefined
  /** Where the page sits, from the top; a crumb with onClick is a link back. */
  breadcrumb?: Crumb[] | undefined
  /** Buttons for what you can do here, right of the title. */
  actions?: React.ReactNode | undefined
  /** Views of the page, shown under the title; a count shows only when given. */
  tabs?: PageTab[] | undefined
  /** The id of the current view, marked with aria-current. */
  activeTab?: string | undefined
  /** Called with a view's id when its tab is chosen. */
  onTabChange?: ((id: string) => void) | undefined
  /**
   * The level of the title's heading. Defaults to 1, inside a `HeadingScope` too: the title is the page's. PageHeader
   * draws none of the page's content, so it sets no scope round it; the content sits under the `<h1>` already, since
   * every Candor heading outside a scope is an `<h2>`. Pass 2 where the app draws its own `<h1>` above (a product name
   * in the banner, say), and wrap the page's content in `<HeadingScope level={2}>` so its headings sit under this one.
   */
  headingLevel?: HeadingLevel | undefined
  /**
   * The title's size. `default` is the `lg` step, semibold, on one line. `large` is a page's title as a large step:
   * `--cd-page-title-lg` (the 3xl step unless a brand sets it) at `--cd-page-title-lg-weight` (700) and
   * `--cd-page-title-lg-leading`, and it wraps to two lines before it is cut, so it still reads on a phone. The
   * heading's level is the same at either size.
   */
  size?: "default" | "large" | undefined
  /** Classes for the header, merged with Candor's. */
  className?: string | undefined
}) {
  const t = useStrings("pageHeader", pageHeaderStrings)
  const format = useFormat()
  const Heading = `h${headingLevel}` as const
  const hasCount = counted(count)
  const headingClass =
    size === "large"
      ? "text-[length:var(--cd-page-title-lg,var(--cd-text-3xl))] leading-[var(--cd-page-title-lg-leading,var(--cd-leading-3xl))] font-[number:var(--cd-page-title-lg-weight,700)] tracking-tight break-words"
      : "text-lg font-semibold tracking-tight"
  const titleClass = size === "large" ? "line-clamp-2 w-fit max-w-full" : "block w-fit max-w-full truncate"
  return (
    <header data-slot="page-header" className={cn("shrink-0 border-b px-4 sm:px-6", tabs ? "pt-4" : "py-4", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label={t("breadcrumb")} className="mb-1.5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.onClick ? (
                  <button type="button" onClick={c.onClick} className="relative after:absolute after:inset-x-0 after:-inset-y-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80">
                    <bdi>{neutralizeBidi(c.label)}</bdi>
                  </button>
                ) : (
                  <span><bdi>{neutralizeBidi(c.label)}</bdi></span>
                )}
                <ChevronRight aria-hidden className="rtl:-scale-x-100 size-3 text-faint-foreground" />
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          {/* Without a count the classes are exactly as before, so the markup is too. */}
          <Heading className={hasCount ? `${headingClass} flex items-baseline gap-2` : headingClass}>
            {/*
              The title in its own direction: on a page of the other direction its full stop and its ellipsis stay at its
              end. As wide as its words (w-fit), it sits at the heading's start edge, the page's, whatever its own
              direction; at most the heading's width (max-w-full), it is cut or clamped there.
            */}
            <bdi className={hasCount ? `${titleClass} min-w-0` : titleClass}>{neutralizeBidi(title)}</bdi>
            {hasCount && (
              <>
                <span aria-hidden data-slot="page-header-count" className="shrink-0 font-normal text-muted-foreground tabular-nums">
                  {format.number(count)}
                </span>
                <span className="sr-only">{t("count", { count })}</span>
              </>
            )}
          </Heading>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{typeof description === "string" ? neutralizeBidi(description) : description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <nav aria-label={t("views", { title: neutralizeBidi(title) })} className="-mb-px mt-3 flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => onTabChange?.(tab.id)}
              className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pb-2.5 text-sm text-muted-foreground outline-none cd-tint hover:text-foreground focus-visible:text-foreground aria-[current=page]:border-[var(--cd-primary-mark,var(--primary))] aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              <bdi>{neutralizeBidi(tab.label)}</bdi>
              {counted(tab.count) && (
                <>
                  <span aria-hidden className="rounded-full bg-muted px-1.5 text-2xs tabular-nums text-muted-foreground">{format.number(tab.count)}</span>
                  <span className="sr-only">{t("tabCount", { count: tab.count })}</span>
                </>
              )}
            </button>
          ))}
        </nav>
      )}
    </header>
  )
}

export { PageHeader }
