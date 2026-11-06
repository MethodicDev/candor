"use client"

import * as React from "react"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStrings } from "@/components/locale"
import { useVirtualList } from "@/lib/use-virtual-list"

/** Thread's fixed words; override them under `thread` in LocaleProvider's `strings`. */
export const threadStrings = {
  messages: "Messages",
  jumpToLatest: "Jump to latest",
}

/**
 * The scrolling message column. It follows new content while you're at the
 * bottom and stops following the moment you scroll up to read, offering a
 * "Jump to latest" button instead. Pass `empty` for the first-run state and
 * the composer as `footer`.
 *
 * For long histories, `virtualize` renders only the messages in or near view
 * (each child is one item, keyed by its `key`). The column stays a `log`, the
 * message holding focus stays rendered, and Jump to latest works the same.
 */
function Thread({
  children,
  empty,
  footer,
  className,
  contentClassName,
  virtualize = false,
}: {
  children?: React.ReactNode
  /** Shown before the first message. */
  empty?: React.ReactNode
  /** Below the messages, usually the composer. */
  footer?: React.ReactNode
  className?: string
  /** Classes for the message column. */
  contentClassName?: string
  /** Render only the messages in or near view, for histories of hundreds of messages. Give each child a `key`. Defaults to false. */
  virtualize?: boolean
}) {
  const t = useStrings("thread", threadStrings)
  const scroller = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const pinnedRef = React.useRef(true)
  const [pinned, setPinned] = React.useState(true)

  const toBottom = React.useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  React.useEffect(() => {
    const el = content.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) toBottom()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [toBottom])

  // Scroll events arrive a frame late, after streaming content may already have
  // grown the column, so distance from the bottom alone would read growth as
  // the reader scrolling away. Only an actual move up unpins.
  const lastTop = React.useRef(0)
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const top = el.scrollTop
    const atBottom = el.scrollHeight - top - el.clientHeight < 48
    if (atBottom) {
      pinnedRef.current = true
      setPinned(true)
    } else if (top < lastTop.current - 2) {
      pinnedRef.current = false
      setPinned(false)
    }
    lastTop.current = top
  }

  const hasMessages = React.Children.count(children) > 0
  const items = virtualize ? React.Children.toArray(children) : []
  const keyOf = (i: number) => (React.isValidElement(items[i]) ? (items[i].key ?? i) : i)
  // The message holding focus stays rendered, so focus isn't lost when it scrolls out of view.
  const [focused, setFocused] = React.useState<string | null>(null)
  const list = useVirtualList({
    enabled: virtualize,
    count: items.length,
    keyOf,
    scroller,
    pin: focused,
    gap: () => (content.current ? Number.parseFloat(getComputedStyle(content.current).rowGap) || 0 : 0),
  })

  return (
    <div data-slot="thread" className={cn("flex min-h-0 flex-col", className)}>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          onFocus={
            virtualize
              ? (e) => {
                  setFocused((e.target as HTMLElement).closest("[data-virtual-key]")?.getAttribute("data-virtual-key") ?? null)
                }
              : undefined
          }
          onBlur={virtualize ? (e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(null) : undefined}
          className="h-full scroll-pb-14 overflow-y-auto overscroll-contain"
        >
          <div
            ref={content}
            role="log"
            aria-label={t("messages")}
            className={cn("mx-auto flex w-full max-w-(--cd-thread-width) flex-col gap-7 px-4 py-6", contentClassName)}
          >
            {!hasMessages ? (
              empty
            ) : virtualize ? (
              <>
                {list.rows.map((row) =>
                  "spacer" in row ? (
                    <div key={row.key} aria-hidden style={{ height: row.spacer }} />
                  ) : (
                    <div key={keyOf(row.index)} ref={list.measure} data-virtual-key={String(keyOf(row.index))} className="flex flex-col">
                      {items[row.index]}
                    </div>
                  )
                )}
              </>
            ) : (
              children
            )}
          </div>
        </div>
        {!pinned && hasMessages && (
          <button
            type="button"
            onClick={() => {
              pinnedRef.current = true
              setPinned(true)
              toBottom("smooth")
            }}
            className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-popover px-3 py-1.5 text-xs font-medium shadow-float animate-in fade-in-0 slide-in-from-bottom-1"
          >
            <ArrowDown aria-hidden className="size-3" /> {t("jumpToLatest")}
          </button>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />
      </div>
      {footer && <div className="mx-auto w-full max-w-(--cd-thread-width) px-4 pb-4">{footer}</div>}
    </div>
  )
}

export { Thread }
