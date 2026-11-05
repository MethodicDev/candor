"use client"

import * as React from "react"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStrings } from "@/registry/blocks/locale"

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
 */
function Thread({
  children,
  empty,
  footer,
  className,
  contentClassName,
}: {
  children?: React.ReactNode
  /** Shown before the first message. */
  empty?: React.ReactNode
  /** Below the messages, usually the composer. */
  footer?: React.ReactNode
  className?: string
  /** Classes for the message column. */
  contentClassName?: string
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

  return (
    <div data-slot="thread" className={cn("flex min-h-0 flex-col", className)}>
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain">
          <div ref={content} role="log" aria-label={t("messages")} className={cn("mx-auto flex w-full max-w-(--cd-thread-width) flex-col gap-7 px-4 py-6", contentClassName)}>
            {hasMessages ? children : empty}
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
