"use client"

import * as React from "react"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStrings } from "@/registry/blocks/locale"
import { useVirtualList } from "@/registry/lib/use-virtual-list"

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
 *
 * While the reader is scrolled up, "Jump to latest" pulses once each time a
 * new message arrives (a child of the thread, or any element marked `data-slot="message"` inside it), then stays still; the jump itself scrolls smoothly
 * unless the OS asks for reduced motion or data-motion is "none".
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
    if (!el) return
    // A smooth jump only when nothing asks for stillness: the OS setting, or data-motion="none" around the thread.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || el.closest('[data-motion="none"]') !== null
    el.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : behavior })
  }, [])

  // A new message while the reader is scrolled up: the Jump to latest control pulses once for each arrival, even when
  // the messages sit inside a wrapper component or a fragment. A second arrival while it still pulses restarts it.
  const [arrived, setArrived] = React.useState(false)
  const arrivedRef = React.useRef(false)
  const frame = React.useRef(0)
  React.useEffect(() => {
    arrivedRef.current = arrived
  }, [arrived])
  React.useEffect(() => () => cancelAnimationFrame(frame.current), [])
  const arrive = React.useCallback(() => {
    if (pinnedRef.current) return
    if (!arrivedRef.current) {
      arrivedRef.current = true
      setArrived(true)
      return
    }
    // Already pulsing: switch it off and on again next frame, so the ring plays again.
    arrivedRef.current = false
    setArrived(false)
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      arrivedRef.current = true
      setArrived(true)
    })
  }, [])
  // Virtualized, every child is one message and the rows come and go as the reader scrolls, so the children are counted.
  const count = React.Children.count(children)
  const lastCount = React.useRef(count)
  React.useEffect(() => {
    const grew = count > lastCount.current
    lastCount.current = count
    if (grew && virtualize) arrive()
  }, [count, virtualize, arrive])
  // Otherwise the list itself is watched. A message is an element marked data-slot="message" anywhere inside the log, or a
  // direct child of it that holds none. It is an arrival only when there are more messages than before and an added one
  // comes after every message that was already there: unfolding earlier turns inserts in the middle, and swapping a
  // reply for another version (a keyed remount) doesn't change the count. Text streaming into a message adds neither.
  React.useEffect(() => {
    const el = content.current
    if (virtualize || !el || typeof MutationObserver === "undefined") return
    const messages = () =>
      Array.from(el.querySelectorAll<HTMLElement>("*")).filter((node) => node.matches('[data-slot="message"]') || (node.parentElement === el && node.querySelector('[data-slot="message"]') === null))
    const seen = { messages: messages() }
    const observer = new MutationObserver(() => {
      const before = seen.messages
      const known = (seen.messages = messages())
      if (known.length <= before.length) return
      const had = new Set(before)
      const survivors = before.filter((node) => node.isConnected)
      const added = known.filter((node) => !had.has(node))
      const atTheEnd = added.some((node) => survivors.every((old) => old.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))
      if (atTheEnd) arrive()
    })
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [virtualize, arrive])
  React.useEffect(() => {
    if (!arrived) return
    const timer = window.setTimeout(() => setArrived(false), 1000)
    return () => window.clearTimeout(timer)
  }, [arrived])

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
          // The entrance is the wrapper's, so the pulse on the button never replays it.
          <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-1">
            <button
              type="button"
              data-slot="thread-jump"
              data-arrived={arrived ? "" : undefined}
              onClick={() => {
                pinnedRef.current = true
                setPinned(true)
                toBottom("smooth")
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border bg-popover px-3 py-1.5 text-xs font-medium shadow-float [--cd-attention-color:var(--primary)]",
                arrived && "animate-attention"
              )}
            >
              <ArrowDown aria-hidden className="size-3" /> {t("jumpToLatest")}
            </button>
          </span>
        )}
        {fade && <div aria-hidden data-slot="thread-fade" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />}
      </div>
      {footer && <div className="mx-auto w-full max-w-(--cd-thread-width) px-4 pb-4">{footer}</div>}
    </div>
  )
}

export { Thread }
