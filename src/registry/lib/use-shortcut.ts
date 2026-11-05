import * as React from "react"

/** True on Apple platforms, where "mod" is ⌘ rather than Ctrl. */
export function isApple() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

/**
 * The keys of a combo as they should be printed: "mod+k" → ["⌘", "K"] on a
 * Mac and ["Ctrl", "K"] elsewhere.
 */
export function comboKeys(combo: string) {
  const apple = isApple()
  const names: Record<string, string> = {
    mod: apple ? "⌘" : "Ctrl",
    shift: apple ? "⇧" : "Shift",
    alt: apple ? "⌥" : "Alt",
    enter: "↵",
    escape: "Esc",
    up: "↑",
    down: "↓",
  }
  return combo.split("+").map((k) => names[k] ?? (k.length === 1 ? k.toUpperCase() : k))
}

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

/**
 * Run `handler` when a key combo is pressed anywhere on the page: "mod+k",
 * "mod+shift+o", "?", "escape". A combo without mod or alt is ignored while
 * the person is typing in a field, so "?" still types a question mark.
 */
export function useShortcut(combo: string, handler: (e: KeyboardEvent) => void, { enabled = true }: { enabled?: boolean } = {}) {
  const latest = React.useRef(handler)
  React.useEffect(() => {
    latest.current = handler
  })

  React.useEffect(() => {
    if (!enabled) return
    const parts = combo.toLowerCase().split("+")
    const key = parts[parts.length - 1]!
    const mod = parts.includes("mod")
    const shift = parts.includes("shift")
    const alt = parts.includes("alt")
    const onKey = (e: KeyboardEvent) => {
      const modDown = isApple() ? e.metaKey : e.ctrlKey
      if (mod !== modDown || alt !== e.altKey) return
      // "?" arrives with shift held; only compare shift when the combo names it.
      if (shift && !e.shiftKey) return
      if (e.key.toLowerCase() !== key) return
      if (!mod && !alt && typing(e.target)) return
      e.preventDefault()
      latest.current(e)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [combo, enabled])
}
