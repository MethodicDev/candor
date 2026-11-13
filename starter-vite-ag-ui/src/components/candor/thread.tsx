import * as React from "react"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStrings } from "@/components/candor/locale"
import { useVirtualList } from "@/lib/candor/use-virtual-list"
import { motion, useMotionAllowed } from "@/lib/candor/motion"

/**
 * @motion move:scroll When the person presses Jump to latest, the thread glides down to the newest message. Under
 * reduced motion it jumps. Opening the thread and following new messages while the person is at the bottom are never
 * smooth scrolls.
 */
const scrollMotion = motion("thread", "scroll", "move")
/** How long the animations running on `el` take in all, in milliseconds (the longest of duration × iteration count, capped at 6 s); undefined when it can't be read. */
function animationMs(el: Element | null): number | undefined {
  if (!el || typeof getComputedStyle === "undefined") return undefined
  const style = getComputedStyle(el)
  const durations = style.animationDuration.split(",").map((t) => (t.trim().endsWith("ms") ? Number.parseFloat(t) : Number.parseFloat(t) * 1000))
  const counts = style.animationIterationCount.split(",").map((c) => (c.trim() === "infinite" ? Number.POSITIVE_INFINITY : Number.parseFloat(c)))
  const totals = durations.map((d, i) => d * (counts[i % counts.length] || 1)).filter((n) => Number.isFinite(n) || n === Number.POSITIVE_INFINITY)
  return totals.length ? Math.min(6000, Math.max(...totals)) : undefined
}

/**
 * @motion arrive:jump The Jump to latest control fades in when the person scrolls up from the bottom, or when the view
 * is left short of it, and goes when they return. It is not shown for a thread that has no messages.
 */
const jumpMotion = motion("thread", "jump", "arrive", { dur: 150 })
/**
 * @motion attention:arrival While the person is scrolled up, Jump to latest pulses once each time a new message
 * arrives, then is still. Nothing pulses at the bottom, where the new message is already in view.
 */
const arrivalMotion = motion("thread", "arrival", "attention")

/** How close to the bottom counts as at it, in pixels. */
const AT_BOTTOM_PX = 48
/** How long a reader's input stays theirs: a scroll upward within this long of it is the reader's, in milliseconds. */
const READER_INPUT_MS = 1000
/** Whether the scroller shows its last pixels, give or take AT_BOTTOM_PX. */
function atBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_PX
}
/** What the scroll rule compares between one scroll or resize and the next. */
interface View {
  top: number
  height: number
  client: number
  /** Where the column's last element starts in it: it moves when content above it changes size, not when the view scrolls. */
  newest: number
}
function viewOf(el: HTMLElement, column: HTMLElement | null): View {
  const last = column?.lastElementChild
  const newest = column && last ? last.getBoundingClientRect().top - column.getBoundingClientRect().top : 0
  return { top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight, newest }
}
/** A field that takes the keys itself, so ArrowUp or Home there moves a caret, not the thread. */
function editable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.matches("input, textarea, select")
}

/** Thread's fixed words; override them under `thread` in LocaleProvider's `strings`. */
export const threadStrings = {
  messages: "Messages",
  jumpToLatest: "Jump to latest",
}

/**
 * The scrolling message column. It follows new content while you're at the
 * bottom and stops following the moment the view moves up by anything but
 * layout (a wheel, a touch, a key, the scrollbar, find in page, a screen
 * reader, or your app scrolling `scrollerRef`), offering a "Jump to latest"
 * button instead; content that grows, shrinks or moves on its own never stops it. The button shows whenever the view is
 * short of the bottom. Pass `empty` for the first-run state and
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
  /** The scrolling element, for your own scroll handling. Scrolling it up stops the thread following, as the reader scrolling does; scrolling it to the bottom starts it again. */
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

  // A smooth jump only when nothing asks for stillness: the OS setting (the calm level), data-motion="calm" or "none"
  // around the thread, or a brand that turned the scroll off.
  const smooth = useMotionAllowed(scroller, scrollMotion)
  const toBottom = React.useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = scroller.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: smooth() ? behavior : "auto" })
    },
    [smooth]
  )

  // Following turns the browser's scroll anchoring off on the scroller (overflow-anchor: none), and leaving turns it
  // back on, so an unpinned reader keeps their place as content above them changes. Set here as well as in the render,
  // so it holds from the moment the thread pins, not from its next commit.
  const follow = React.useCallback((on: boolean) => {
    pinnedRef.current = on
    setPinned(on)
    scroller.current?.style.setProperty("overflow-anchor", on ? "none" : "")
  }, [])

  // A new message while the reader is scrolled up: the Jump to latest control pulses once for each arrival, even when
  // the messages sit inside a wrapper component or a fragment. A second arrival while it still pulses restarts it.
  const [arrived, setArrived] = React.useState(false)
  const arrivedRef = React.useRef(false)
  const frame = React.useRef(0)
  const jump = React.useRef<HTMLButtonElement>(null)
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
      const arrivals = added.filter((node) => survivors.every((old) => old.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))
      // A message that arrived after the thread first drew rises in (Message reads data-arrived); loaded history is still.
      for (const node of arrivals) node.setAttribute("data-arrived", "")
      if (arrivals.length) arrive()
    })
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [virtualize, arrive])
  React.useEffect(() => {
    if (!arrived) return
    // The ring ends when its animation does (onAnimationEnd on the button). This timer is only the fallback for when
    // no animation runs (motion off, or no Candor CSS), set from the duration and count the page resolved, so a brand's
    // longer ring isn't cut short.
    const timer = window.setTimeout(() => setArrived(false), (animationMs(jump.current) ?? 1200) + 100)
    return () => window.clearTimeout(timer)
  }, [arrived])

  // Open at the anchor once, when it first appears.
  const anchored = React.useRef(false)
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs after every render on purpose: it waits for the thread's content to exist, then does its work once (anchored)
  React.useLayoutEffect(() => {
    if (!anchoring || anchored.current || !content.current?.childElementCount) return
    anchored.current = true
    const target = content.current.querySelector<HTMLElement>(`#${CSS.escape(anchor!)}`)
    if (target) {
      target.scrollIntoView?.({ block: "start" })
      return
    }
    // The anchor isn't in the thread: open at the bottom and follow, as without one.
    follow(true)
    toBottom()
  })

  // Whether the view is short of the bottom, decided only after a resize or a scroll has been handled (so after a
  // resize's own toBottom), so Jump to latest never flashes while content streams in at the bottom.
  const [short, setShort] = React.useState(false)
  // After Jump to latest, until the glide reaches the bottom: the view is on its way down, so the control goes at once.
  const gliding = React.useRef(false)
  const settle = React.useCallback(() => {
    const el = scroller.current
    if (!el) return
    const away = !atBottom(el)
    if (!away) gliding.current = false
    setShort(away && !gliding.current)
  }, [])

  // Only someone scrolling leaves the bottom; layout never does. Each scroll event and each resize compares the view
  // with the last one seen. While the thread follows, anchoring is off, so layout can lower scrollTop only by
  // clamping it: the content getting shorter or the view taller, never by more than the sizes changed. So a fall is
  // layout only up to what the content's own change since the last look explains (how much the content's height, the
  // view's height and where the newest element sits in the column moved, in either direction; A-61's trace, recorded
  // with anchoring on, falls 25 px as the content grows 32). A larger fall is a scroll, whatever made it: a wheel, a
  // key with focus anywhere, find in page, a screen reader, autoscroll, or the app through scrollerRef, during
  // streaming or not. It unpins. A fall that is layout keeps the thread pinned and takes it back down, in whichever
  // order the scroll event and the resize come. The reader's own input (a wheel or a touch moving up, a key that
  // scrolls up, a drag on the scrollbar, focus moving above the view) makes even a small fall theirs. Scrolling to the
  // bottom by any means pins again.
  const readerAt = React.useRef(Number.NEGATIVE_INFINITY)
  const dragging = React.useRef(false)
  const seen = React.useRef<View | null>(null)
  const judge = React.useCallback(
    (scrolled: boolean) => {
      const el = scroller.current
      if (!el) return
      const now = viewOf(el, content.current)
      const before = seen.current
      seen.current = now
      if (scrolled && atBottom(el)) {
        follow(true)
        return
      }
      if (!before || !pinnedRef.current) return
      const fall = before.top - now.top
      if (fall <= 2) return
      const explained = Math.abs(now.height - before.height) + Math.abs(now.client - before.client) + Math.abs(now.newest - before.newest)
      if (fall > explained + 2 || dragging.current || Date.now() - readerAt.current < READER_INPUT_MS) {
        follow(false)
        return
      }
      // Layout left the view short: back to the bottom now, not at the next resize, which may not come.
      toBottom()
      seen.current = viewOf(el, content.current)
    },
    [follow, toBottom]
  )

  React.useEffect(() => {
    const el = content.current
    const view = scroller.current
    if (!el) return
    // The column growing or shrinking, or the scroller itself changing height (a composer that grows below it).
    const observer = new ResizeObserver(() => {
      judge(false)
      if (pinnedRef.current && scroller.current) {
        toBottom()
        seen.current = viewOf(scroller.current, content.current)
      }
      settle()
    })
    observer.observe(el)
    if (view) observer.observe(view)
    return () => observer.disconnect()
  }, [toBottom, settle, judge])

  React.useEffect(() => {
    const el = scroller.current
    if (!el) return
    const moved = () => {
      readerAt.current = Date.now()
      gliding.current = false
    }
    // Whether the last press on the page was in the thread: keys pressed with focus nowhere (on body) then scroll it.
    let pressedIn = false
    let touchY: number | null = null
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) moved()
    }
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (y === undefined) return
      // A finger moving down drags the content down: the view moves up.
      if (touchY !== null && y > touchY) moved()
      touchY = y
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || editable(e.target)) return
      const target = e.target
      const ours = target instanceof Node && el.contains(target)
      const nowhere = target === document.body || target === document.documentElement
      if (!ours && !(nowhere && pressedIn)) return
      if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home" || (e.key === " " && e.shiftKey)) moved()
    }
    const onPress = (e: PointerEvent) => {
      pressedIn = e.target instanceof Node && el.contains(e.target)
      // On the scroller itself, outside the column: its scrollbar, or the margin beside the messages. Any other press
      // ends a drag whose release the page never got.
      dragging.current = e.target === el
    }
    const release = () => {
      dragging.current = false
    }
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target
      if (!(target instanceof Element) || target === el) return
      // Focus on something above the view: the browser scrolls up to it, for the reader.
      if (target.getBoundingClientRect().top < el.getBoundingClientRect().top) moved()
    }
    const passive = { passive: true }
    el.addEventListener("wheel", onWheel, passive)
    el.addEventListener("touchstart", onTouchStart, passive)
    el.addEventListener("touchmove", onTouchMove, passive)
    el.addEventListener("focusin", onFocusIn)
    // A drag on the scrollbar ends with a release, or at the latest when its scroll does.
    el.addEventListener("scrollend", release)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPress, true)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    return () => {
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("focusin", onFocusIn)
      el.removeEventListener("scrollend", release)
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPress, true)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
  }, [])
  const onScroll = () => {
    judge(true)
    settle()
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
          style={pinned ? { overflowAnchor: "none" } : undefined}
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
        {(!pinned || short) && hasMessages && (
          // The entrance is the wrapper's, so the pulse on the button never replays it.
          <span style={jumpMotion} className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 cd-arrive">
            <button
              type="button"
              ref={jump}
              data-slot="thread-jump"
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && e.animationName.startsWith("cd-")) setArrived(false)
              }}
              data-arrived={arrived ? "" : undefined}
              onClick={() => {
                follow(true)
                gliding.current = true
                setShort(false)
                toBottom("smooth")
              }}
              style={arrivalMotion}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border bg-popover px-(--cd-control-px,0.75rem) py-(--cd-item-py,0.375rem) text-xs font-medium shadow-float [--cd-attention-color:var(--primary)]",
                arrived && "cd-attention"
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
