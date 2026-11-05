import * as React from "react"

/** What to render, in order: an item by its index, or a spacer standing in for the items between. */
export type VirtualRow = { index: number } | { spacer: number; key: string }

export type VirtualList = {
  /** The items to render and the spacers between them, in order. */
  rows: VirtualRow[]
  /** The ref for every rendered item, which also carries `data-virtual-key={key}`, so its real height is measured and kept. */
  measure: (el: HTMLElement | null) => void | (() => void)
}

const keyAttr = "data-virtual-key"

/**
 * Render only the items of a long list that are in or near view, for Thread's and SessionList's `virtualize`.
 * Items keep their measured heights by key, so a list that grows or reorders keeps its place; unmeasured items count
 * as `estimate`. Spacers stand in for the rest. `pin` (an item's key) keeps that item rendered (the one holding
 * focus), on its own if it's far from view, so focus is never lost to an item scrolling away. Until the scroller is
 * measured (on the server, on the first render in the browser, and while it's hidden) the first or last `initial`
 * items render, by `anchor`, so server and browser agree.
 *
 * Give each rendered item `ref={list.measure}` and `data-virtual-key={key}`.
 */
export function useVirtualList({
  enabled,
  count,
  keyOf,
  scroller,
  estimate = 96,
  overscan = 800,
  initial = 20,
  anchor = "end",
  gap = () => 0,
  pin,
}: {
  enabled: boolean
  count: number
  keyOf: (index: number) => React.Key
  scroller: React.RefObject<HTMLElement | null>
  estimate?: number
  overscan?: number
  initial?: number
  /** Which end to show before the scroller is measured: "end" for a thread (newest last), "start" for a list. Defaults to "end". */
  anchor?: "start" | "end"
  /** The gap between items, in pixels, read once the scroller is measured (e.g. from the list's computed `row-gap`). */
  gap?: () => number
  /** The key of an item to keep rendered, such as the one holding focus. */
  pin?: string | null
}): VirtualList {
  const [heights, setHeights] = React.useState<ReadonlyMap<string, number>>(() => new Map())
  const [viewport, setViewport] = React.useState<{ top: number; height: number; gap: number } | null>(null)
  const gapOf = React.useRef(gap)
  React.useLayoutEffect(() => {
    gapOf.current = gap
  })

  // One observer for the rendered items, made when the first one mounts; a changed height re-renders.
  const observer = React.useRef<ResizeObserver | null>(null)
  React.useEffect(
    () => () => {
      observer.current?.disconnect()
      observer.current = null
    },
    []
  )
  const measure = React.useCallback((el: HTMLElement | null) => {
    if (!el) return
    if (typeof ResizeObserver !== "undefined")
      observer.current ??= new ResizeObserver((entries) => {
        const found = entries.flatMap((e) => {
          const key = e.target.getAttribute(keyAttr)
          const h = (e.target as HTMLElement).offsetHeight
          return key !== null && h > 0 ? [[key, h] as const] : []
        })
        if (found.length) setHeights((prev) => (found.every(([k, h]) => prev.get(k) === h) ? prev : new Map([...prev, ...found])))
      })
    const ro = observer.current
    ro?.observe(el)
    const key = el.getAttribute(keyAttr)
    const h = el.offsetHeight
    if (key !== null && h > 0) setHeights((prev) => (prev.get(key) === h ? prev : new Map(prev).set(key, h)))
    // An item that unmounts stops being observed, so it can be collected.
    return () => ro?.unobserve(el)
  }, [])

  React.useLayoutEffect(() => {
    const el = scroller.current
    if (!enabled || !el) return
    const pending = { frame: 0 }
    const read = () => {
      pending.frame = 0
      const g = gapOf.current()
      setViewport((v) => (v && v.top === el.scrollTop && v.height === el.clientHeight && v.gap === g ? v : { top: el.scrollTop, height: el.clientHeight, gap: g }))
    }
    const later = () => {
      if (!pending.frame) pending.frame = requestAnimationFrame(read)
    }
    read()
    el.addEventListener("scroll", later, { passive: true })
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later)
    ro?.observe(el)
    return () => {
      el.removeEventListener("scroll", later)
      ro?.disconnect()
      cancelAnimationFrame(pending.frame)
    }
  }, [enabled, scroller])

  if (!enabled) return { rows: Array.from({ length: count }, (_, index) => ({ index })), measure }

  const g = viewport?.gap ?? 0
  const size = (i: number) => heights.get(String(keyOf(i))) ?? estimate
  const tops: number[] = []
  let y = 0
  for (let i = 0; i < count; i++) {
    tops.push(y)
    y += size(i) + g
  }
  const total = Math.max(0, y - g)

  let start: number
  let end: number
  if (!viewport || viewport.height === 0) {
    start = anchor === "end" ? Math.max(0, count - initial) : 0
    end = anchor === "end" ? count : Math.min(count, initial)
  } else {
    const lo = viewport.top - overscan
    const hi = viewport.top + viewport.height + overscan
    start = 0
    while (start < count - 1 && tops[start]! + size(start) < lo) start++
    end = start
    while (end < count && tops[end]! <= hi) end++
    end = Math.max(end, Math.min(count, start + 1))
  }
  // The pinned item and its neighbours (so Tab and Shift+Tab reach the next and previous item) render with the window,
  // or on their own between spacers when they're far from it.
  let ranges: [number, number][] = [[start, end]]
  const p = pin == null ? -1 : Array.from({ length: count }, (_, i) => i).find((i) => String(keyOf(i)) === pin) ?? -1
  if (p >= 0) {
    const island: [number, number] = [Math.max(0, p - 1), Math.min(count, p + 2)]
    ranges = island[1] < start ? [island, [start, end]] : island[0] > end ? [[start, end], island] : [[Math.min(start, island[0]), Math.max(end, island[1])]]
  }

  // A spacer stands where its items were; the gaps the layout puts beside it account for theirs.
  const rows: VirtualRow[] = []
  let prevEnd = 0
  for (const [a, b] of ranges) {
    if (a > 0) {
      const height = prevEnd === 0 ? tops[a]! - g : tops[a]! - (tops[prevEnd - 1]! + size(prevEnd - 1)) - 2 * g
      if (a > prevEnd) rows.push({ spacer: Math.max(0, height), key: `spacer-${prevEnd}` })
    }
    for (let i = a; i < b; i++) rows.push({ index: i })
    prevEnd = b
  }
  if (prevEnd < count) rows.push({ spacer: Math.max(0, total - tops[prevEnd]!), key: `spacer-${prevEnd}` })
  return { rows, measure }
}
