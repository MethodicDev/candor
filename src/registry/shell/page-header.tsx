"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStrings } from "@/registry/foundation/locale"

/** PageHeader's fixed words; override them under `pageHeader` in LocaleProvider's `strings`. */
export const pageHeaderStrings = {
  breadcrumb: "Breadcrumb",
  views: "{title} views",
}

export type Crumb = { label: string; onClick?: (() => void) | undefined }
export type PageTab = { id: string; label: string; count?: number | undefined }

/**
 * The top of every page that isn't a thread: where you are (breadcrumb), what
 * the page is, what you can do here (actions), and its views (tabs). Tabs are
 * a nav of views over the same page, marked with aria-current; counts appear
 * only when the service gave one.
 *
 * @motion tint:tint A tab's text colour changes when the pointer is over it or it has focus, and its underline
 * changes for the current tab. The tab that is current when the header first appears is drawn current at once.
 */
function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  tabs,
  activeTab,
  onTabChange,
  className,
}: {
  /** What the page is, as its heading. */
  title: string
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
  className?: string | undefined
}) {
  const t = useStrings("pageHeader", pageHeaderStrings)
  return (
    <header data-slot="page-header" className={cn("shrink-0 border-b px-4 sm:px-6", tabs ? "pt-4" : "py-4", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label={t("breadcrumb")} className="mb-1.5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.onClick ? (
                  <button type="button" onClick={c.onClick} className="relative after:absolute after:inset-x-0 after:-inset-y-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80">
                    {c.label}
                  </button>
                ) : (
                  <span>{c.label}</span>
                )}
                <ChevronRight aria-hidden className="rtl:-scale-x-100 size-3 text-faint-foreground" />
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <nav aria-label={t("views", { title })} className="-mb-px mt-3 flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => onTabChange?.(tab.id)}
              className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pb-2.5 text-sm text-muted-foreground outline-none cd-tint hover:text-foreground focus-visible:text-foreground aria-[current=page]:border-primary aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {tab.label}
              {tab.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-2xs tabular-nums text-muted-foreground">{tab.count}</span>}
            </button>
          ))}
        </nav>
      )}
    </header>
  )
}

export { PageHeader }
