import * as React from "react"

export type CopyState = "idle" | "copying" | "copied" | "failed"

/**
 * Copy text and report what actually happened. "copied" only after the
 * clipboard write resolves; a refused write reports "failed" (Candor's honest
 * copy control: no success signal without a settled outcome).
 */
export function useCopy(resetAfter = 1600) {
  const [state, setState] = React.useState<CopyState>("idle")
  const timer = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = React.useCallback(
    async (text: string) => {
      setState("copying")
      try {
        await navigator.clipboard.writeText(text)
        setState("copied")
      } catch {
        setState("failed")
      }
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setState("idle"), resetAfter)
    },
    [resetAfter]
  )

  return { state, copy }
}
