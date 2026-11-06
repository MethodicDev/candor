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
 *
 * It opens at the bottom, or at `anchor` (the `id` of something in it, such as
 * a chapter divider or the card that needs the reader), and then waits for the
 * reader instead of following.
 */
function Thread({
  children,
  empty,
  footer,
  className,
  contentClassName,
  virtualize = false,
  anchor,
  scrollerRef,
  onDrop,
  fade = true,
}: {
  children?: React.ReactNode | undefined
  /** Shown before the first message. */
  empty?: React.ReactNode | undefined
  /** Below the messages, usually the composer. */
  footer?: React.ReactNode | undefined
  className?: string | undefined
  /** Classes for the message column. */
  contentClassName?: string | undefined
  /** Render only the messages in or near view, for histories of hundreds of messages. Give each child a `key`. Defaults to false. */
  virtualize?: boolean | undefined
  /**
   * The `id` of an element in the thread to open at, instead of the bottom: a chapter divider, or the card that needs
   * the reader. Read once, when the messages first appear; if it isn't among them, the thread opens at the bottom.
   * Ignored with `virtualize`, where it may not be rendered yet.
   */
  anchor?: string | undefined
  /** The scrolling element, for your own scroll handling. */
  scrollerRef?: React.Ref<HTMLDivElement> | undefined
  /** Files or other data dropped on the thread. Dragging over it is allowed only when this is given. */
  onDrop?: ((event: React.DragEvent<HTMLDivElement>) => void) | undefined
  /** The soft fade at the bottom of the column. Defaults to true. */
  fade?: boolean | undefined
}) {
  const t = useStrings("thread", threadStrings)
  const scroller = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  // Opening at an anchor means not following the bottom until the reader gets there.
  const anchoring = Boolean(anchor) && !virtualize
  const pinnedRef = React.useRef(!anchoring)
  const [pinned, setPinned] = React.useState(!anchoring)
  React.useImperativeHandle(scrollerRef, () => scroller.current as HTMLDivElement, [])

  const toBottom = React.useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // Open at the anchor once, when it first appears.
  const anchored = React.useRef(false)
  React.useLayoutEffect(() => {
    if (!anchoring || anchored.current || !content.current?.childElementCount) return
    anchored.current = true
    const target = content.current.querySelector<HTMLElement>(`#${CSS.escape(anchor!)}`)
    if (target) {
      target.scrollIntoView?.({ block: "start" })
      return
    }
    // The anchor isn't in the thread: open at the bottom and follow, as without one.
    pinnedRef.current = true
    setPinned(true)
    toBottom()
  })

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
          onDragOver={onDrop ? (e) => e.preventDefault() : undefined}
          onDrop={onDrop}
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
        {fade && <div aria-hidden data-slot="thread-fade" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />}
      </div>
      {footer && <div className="mx-auto w-full max-w-(--cd-thread-width) px-4 pb-4">{footer}</div>}
    </div>
  )
}

export { Thread }
