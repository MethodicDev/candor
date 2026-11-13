import * as React from "react"
import type { RunStatus } from "@/lib/candor/status"

/**
 * Candor's motion layer, the part that runs in components. Motion is organised by fourteen families, one per kind of
 * change; each component moment (copy-field's tick, the dialog opening) belongs to one family and can be tuned on its
 * own by a brand file. The rule the layer keeps: **a theme tunes how a change looks, never when it happens**. The
 * trigger stays in the component (a class added at an honest moment); this file only builds the chain of CSS
 * variables the family utility in `candor.css` reads, and the two hooks that decide "seen settling" and "arrived after
 * the first draw". `arrive` also covers content arriving as the page draws, when that is motion for show.
 *
 * Precedence, highest first: the OS's reduced-motion setting (the calm level), then the app's `data-motion`
 * (`none`, `calm`, `subtle`, `expressive`), then the brand file's `--cd-motion-*` values, then the defaults below.
 *
 * `motion()` is pure and safe to call at module level, so server components can use it; the hooks need a client
 * component.
 */

/** The fourteen families: one per kind of change a person can see. */
export type MotionFamily =
  | "reveal"
  | "arrive"
  | "pop"
  | "mark"
  | "fill"
  | "value"
  | "move"
  | "overlay"
  | "press"
  | "tint"
  | "refuse"
  | "attention"
  | "live"
  | "clock"

/** A motion level: 0 off (the end state appears, events still fire), 1 subtle, 2 expressive. */
export type MotionLevel = 0 | 1 | 2

/** The easings a family may allow. Spring overshoots, so only spatial families accept it. */
export type MotionEase = "standard" | "inout" | "spring" | "linear"

/** The CSS each easing name stands for, as a brand file writes it. */
export const motionEases: Readonly<Record<MotionEase, string>> = {
  standard: "var(--cd-ease)",
  inout: "var(--cd-ease-inout)",
  spring: "var(--cd-ease-spring)",
  linear: "linear",
}

/** A family's amplitude: what its expressive level moves by. */
export type MotionAmplitude = {
  /** The token suffix: `--cd-motion-<family>-<name>`. */
  readonly name: "distance" | "scale" | "count"
  /** The value at the expressive level, as CSS. */
  readonly default: string
  /** The lowest value `theme check` accepts. */
  readonly min: number
  /** The highest value `theme check` accepts. */
  readonly max: number
  /** The unit `min` and `max` are in ("" for a plain number). */
  readonly unit: "px" | "" | "%"
  /** How much of the amplitude the subtle level uses: 0 none, 1 all of it. */
  readonly subtle: number
}

/** A duration with the range `theme check` accepts, in milliseconds. */
export type MotionDuration = { readonly default: number; readonly min: number; readonly max: number }

/** Everything Candor knows about one family. `check:motion` checks `candor.css` against these. */
export type MotionFamilySpec = {
  /** What the family reports, in words, for the docs and the theme builder. */
  readonly reports: string
  /** Moves things in space (scale, translate, size). Spring easing is accepted only here. */
  readonly spatial: boolean
  /** The information itself (a hold, a deadline): a brand can't turn it below subtle. */
  readonly essential: boolean
  /** How long one play takes; `null` when the clock decides. */
  readonly dur: MotionDuration | null
  /** How long leaving takes, for families with an out moment (`-out-dur`). */
  readonly outDur: MotionDuration | null
  /** The easing used when nothing sets one. */
  readonly ease: MotionEase
  /** The easings a brand may choose. */
  readonly eases: readonly MotionEase[]
  /** The amplitude token, when the family has one. */
  readonly amp: MotionAmplitude | null
  /** The closed set of variants: how the change is drawn, never when. The first is the default. */
  readonly variants: readonly [string, ...string[]]
  /** What the calm level (reduced motion) does with it, in words. */
  readonly calm: string
  /**
   * Its utility plays a keyframe a brand can swap for a Pro drawing, though the family has one free word (attention's
   * ring, from 4.4). Its chain carries a `-variant` that falls back to that word, so nothing changes without a brand
   * value; it stays fixed in the free kit.
   */
  readonly drawable?: boolean | undefined
}

/** The family defaults. Durations, easings and amplitudes are 2.2's, so an app with no brand file looks the same. */
export const motionFamilies = {
  reveal: {
    reports: "Content opened or closed to its measured size; a chevron turns.",
    spatial: true,
    essential: false,
    dur: { default: 200, min: 150, max: 300 },
    outDur: null,
    ease: "standard",
    eases: ["standard", "inout"],
    amp: null,
    variants: ["size", "fade"],
    calm: "Snaps to its measured size.",
  },
  arrive: {
    reports: "Something new, added after the first draw, or arriving as the page draws when it is motion for show.",
    spatial: true,
    essential: false,
    dur: { default: 240, min: 150, max: 300 },
    outDur: null,
    ease: "standard",
    eases: ["standard", "spring"],
    amp: { name: "distance", default: "8px", min: 0, max: 16, unit: "px", subtle: 0.5 },
    variants: ["rise", "fade", "pop"],
    calm: "Fades in, up to 150 ms.",
  },
  pop: {
    reports: "Added, removed, or a small mark appearing.",
    spatial: true,
    essential: false,
    dur: { default: 200, min: 100, max: 300 },
    outDur: { default: 120, min: 80, max: 300 },
    ease: "standard",
    eases: ["standard", "spring"],
    amp: { name: "scale", default: "0.85", min: 0.8, max: 1, unit: "", subtle: 0 },
    variants: ["scale", "fade"],
    calm: "Fades, up to 150 ms.",
  },
  mark: {
    reports: "A tick or cross drawn when a result settles.",
    spatial: true,
    essential: false,
    dur: { default: 360, min: 200, max: 500 },
    outDur: null,
    ease: "standard",
    eases: ["standard"],
    amp: null,
    variants: ["draw", "pop", "drop"],
    calm: "The finished mark fades in, up to 150 ms.",
  },
  fill: {
    reports: "A bar or ring moving between measured values.",
    spatial: true,
    essential: false,
    dur: { default: 360, min: 200, max: 600 },
    outDur: null,
    ease: "standard",
    eases: ["standard", "inout"],
    amp: null,
    variants: ["grow"],
    calm: "Snaps to the new value; its colour may fade.",
  },
  value: {
    reports: "A number or word changed in place.",
    spatial: false,
    essential: false,
    dur: { default: 120, min: 80, max: 200 },
    outDur: null,
    ease: "standard",
    eases: ["standard"],
    amp: { name: "distance", default: "2px", min: 0, max: 4, unit: "px", subtle: 0 },
    variants: ["fade", "slide"],
    calm: "Crossfades, up to 150 ms.",
  },
  move: {
    reports: "A thing changed place: a reorder, a tab indicator, a toast restacking, a scroll.",
    spatial: true,
    essential: false,
    dur: { default: 200, min: 150, max: 300 },
    outDur: null,
    ease: "standard",
    eases: ["standard", "spring"],
    amp: null,
    variants: ["slide"],
    calm: "Jumps to its new place.",
  },
  overlay: {
    reports: "A dialog, sheet, popover, menu or tooltip opened or closed.",
    spatial: true,
    essential: false,
    dur: { default: 150, min: 100, max: 500 },
    outDur: { default: 150, min: 80, max: 300 },
    ease: "standard",
    eases: ["standard", "inout", "spring"],
    amp: { name: "scale", default: "0.95", min: 0.9, max: 1, unit: "", subtle: 1 },
    variants: ["scale", "slide", "fade"],
    calm: "Fades, up to 150 ms.",
  },
  press: {
    reports: "A press registered.",
    spatial: true,
    essential: false,
    dur: { default: 150, min: 80, max: 200 },
    outDur: null,
    ease: "standard",
    eases: ["standard"],
    amp: { name: "scale", default: "0.96", min: 0.9, max: 1, unit: "", subtle: 0.5 },
    variants: ["scale"],
    calm: "Doesn't scale; the colour still answers.",
  },
  tint: {
    reports: "Hover, focus, selected, a drop target: a colour or opacity change.",
    spatial: false,
    essential: false,
    dur: { default: 150, min: 0, max: 200 },
    outDur: null,
    ease: "standard",
    eases: ["standard", "inout"],
    amp: null,
    variants: ["fade"],
    calm: "Colour and opacity only, up to 150 ms.",
  },
  refuse: {
    reports: "A locked control was pressed: the reason is shown, and under expressive it shakes.",
    spatial: true,
    essential: false,
    dur: { default: 360, min: 200, max: 500 },
    outDur: null,
    ease: "standard",
    eases: ["standard"],
    amp: { name: "distance", default: "3px", min: 0, max: 6, unit: "px", subtle: 0 },
    variants: ["shake"],
    calm: "No shake; the reason's colour still changes.",
  },
  attention: {
    reports: "Something new waits on the person: a ring that grows and fades.",
    spatial: false,
    essential: false,
    dur: { default: 900, min: 600, max: 1600 },
    outDur: null,
    ease: "standard",
    eases: ["standard"],
    amp: { name: "count", default: "1", min: 1, max: 3, unit: "", subtle: 1 },
    variants: ["ring"],
    calm: "One ring that fades without growing, up to 150 ms.",
    drawable: true,
  },
  live: {
    reports: "Work that is being heard from: a dot's pulse, a caret, a spinner, a shimmer, a skeleton.",
    spatial: false,
    essential: false,
    dur: { default: 1600, min: 1000, max: 3000 },
    outDur: null,
    ease: "standard",
    eases: ["standard", "inout", "linear"],
    amp: null,
    variants: ["pulse"],
    calm: "Still, with its word.",
  },
  clock: {
    reports: "Real time passing: a hold, a deadline, a replay. Painted from the clock.",
    spatial: true,
    essential: true,
    dur: null,
    outDur: null,
    ease: "linear",
    eases: ["linear"],
    amp: null,
    variants: ["glide"],
    calm: "Steps instead of gliding; never off.",
  },
} as const satisfies Record<MotionFamily, MotionFamilySpec>

/** The family names, in the order the docs and the theme builder list them. */
export const motionFamilyNames = Object.keys(motionFamilies) as MotionFamily[]

/** A family's variants, by name: `MotionVariant<"mark">` is `"draw" | "pop" | "drop"`. */
export type MotionVariant<F extends MotionFamily> = (typeof motionFamilies)[F]["variants"][number]

/**
 * True when a family has one way of drawing its change (fill, move, press, tint, refuse, attention, live and clock).
 * Its single variant is fixed: there is no `-variant` token to set, and `motion()` writes none, because the family's
 * utility has nothing to choose between. The docs mark such a family "(fixed)" instead of listing a value that does
 * nothing. A later release that adds a second word turns the token on without a new name.
 */
export const motionVariantIsFixed = (family: MotionFamily): boolean => motionFamilies[family].variants.length < 2

/**
 * True when a family's chain carries a `-variant`: it chooses between drawings, or (4.4, `drawable`) its one free word
 * can be swapped for a drawing from the Pro motion-drawings item. Attention is both fixed and drawable: the free kit
 * has only its ring, and `--cd-motion-attention-variant` falls back to `cd-ring`.
 */
export const motionHasVariant = (family: MotionFamily): boolean => !motionVariantIsFixed(family) || (motionFamilies[family] as MotionFamilySpec).drawable === true

/**
 * The CSS value a variant is written as. CSS can only choose a drawing by keyframe name, so a variant's value is its
 * keyframe's: the word with Candor's prefix, which keeps an app's own `@keyframes rise` from taking over.
 */
export const motionVariantValue = (variant: string): string => `cd-${variant}`

/** What a moment may set as its own default, where it differs from its family's. */
export type MomentDefaults<F extends MotionFamily> = {
  /** The moment's duration, in milliseconds, within its family's range. */
  dur?: number | undefined
  /** How long leaving takes, for families with an out moment. */
  outDur?: number | undefined
  /** The moment's easing, from its family's allowed set. */
  ease?: (typeof motionFamilies)[F]["eases"][number] | undefined
  /** The amplitude at the expressive level, as CSS (`"0.9"`, `"0.25rem"`, `"3"`). */
  amp?: string | undefined
  /** The moment's variant, from its family's set. */
  variant?: MotionVariant<F> | undefined
}

/** The moment a chain belongs to, kept on the style object (not enumerable, so it never reaches the DOM). */
export type MotionMoment = { readonly item: string; readonly moment: string; readonly family: MotionFamily }

const momentKey: unique symbol = Symbol.for("candor.motion.moment")

/**
 * A moment's chain: CSS variables to spread into the moving element's `style`. Each resolves the moment's own token,
 * then its family's, then the default, on that element, so a `data-motion` container anywhere above it still applies.
 */
export type MotionStyle = React.CSSProperties & { readonly [momentKey]?: MotionMoment | undefined }

const ms = (n: number) => `${n}ms`

/**
 * Builds a moment's chain. Call it once at module level and spread the result into the element's `style`, beside the
 * family utility that the component adds at the honest moment:
 *
 * ```tsx
 * const tick = motion("copy-field", "tick", "pop")
 * <Check style={tick} className={cn(copied && "cd-pop")} />
 * ```
 *
 * The brand reaches the moment with `--cd-motion-copy-field-tick` (its level), `-dur`, `-ease`, the family's amplitude
 * suffix and `-variant`; anything it doesn't set falls back to the family (`--cd-motion-pop-*`), then to `defaults`,
 * then to Candor's. Two families on one element compose: `style={{ ...press, ...tint }}`.
 */
export function motion<F extends MotionFamily>(item: string, moment: string, family: F, defaults: MomentDefaults<F> = {}): MotionStyle {
  const spec: MotionFamilySpec = motionFamilies[family]
  const own = `--cd-motion-${item}-${moment}`
  const fam = `--cd-motion-${family}`
  const local = `--cd-m-${family}`
  const style: Record<string, string> = {
    [local]: `var(${own}, var(${fam}, var(--cd-motion-preset)))`,
  }
  if (spec.dur) style[`${local}-dur`] = `var(${own}-dur, var(${fam}-dur, ${ms(defaults.dur ?? spec.dur.default)}))`
  if (spec.outDur) style[`${local}-out-dur`] = `var(${own}-out-dur, var(${fam}-out-dur, ${ms(defaults.outDur ?? spec.outDur.default)}))`
  if (spec.dur) style[`${local}-ease`] = `var(${own}-ease, var(${fam}-ease, ${motionEases[defaults.ease ?? spec.ease]}))`
  if (spec.amp) style[`${local}-amp`] = `var(${own}-${spec.amp.name}, var(${fam}-${spec.amp.name}, ${defaults.amp ?? spec.amp.default}))`
  if (motionHasVariant(family)) {
    const variant = motionVariantValue(defaults.variant ?? spec.variants[0])
    style[`${local}-variant`] = `var(${own}-variant, var(${fam}-variant, ${variant}))`
  }
  Object.defineProperty(style, momentKey, { value: { item, moment, family } satisfies MotionMoment, enumerable: false })
  return style as MotionStyle
}

/** The moment a chain was built for, or `undefined` for a plain style object. */
export const motionMomentOf = (style: MotionStyle | undefined): MotionMoment | undefined => style?.[momentKey]

/* ---------------------------------------------------------------- mount still */

const isFinished = (status: RunStatus) => status === "succeeded" || status === "failed"
const isOver = (status: RunStatus) => isFinished(status) || status === "cancelled" || status === "skipped"

/** How `useSettled` tells a finished value from an unfinished one; Candor's run statuses when left out. */
export type SettledTest<T> = {
  /** Reached an outcome worth showing settling (done or failed). */
  settled: (value: T) => boolean
  /** Over in any way, including ones that don't animate (cancelled, skipped); `settled` when left out. */
  over?: ((value: T) => boolean) | undefined
}

const runTest: SettledTest<RunStatus> = { settled: isFinished, over: isOver }

/**
 * How many times `value` reached a settled outcome from an unfinished one while the component was on screen. Zero
 * for something that mounted already settled, so its mark is drawn still: motion reports a change that was seen,
 * never one that happened before the reader arrived. Key the moving element on the count to replay it.
 */
export function useSettled(value: RunStatus): number
export function useSettled<T>(value: T, test: SettledTest<T>): number
export function useSettled<T>(value: T, test?: SettledTest<T>): number {
  const { settled: done, over = done } = (test ?? runTest) as SettledTest<T>
  const [settled, setSettled] = React.useState(0)
  const previous = React.useRef(value)
  React.useLayoutEffect(() => {
    const was = previous.current
    previous.current = value
    if (was !== value && !over(was) && done(value)) setSettled((n) => n + 1)
  }, [value, done, over])
  return settled
}

/**
 * Which keys were added after the component first drew. Keys present at the first render answer false, so a list
 * that loads with fifty entries draws them still; a key added later answers true until it leaves (and true again if
 * it comes back).
 */
export function useArrived(keys: readonly string[]): (key: string) => boolean {
  const [arrived, setArrived] = React.useState<ReadonlySet<string>>(() => new Set())
  const previous = React.useRef<readonly string[] | null>(null)
  React.useLayoutEffect(() => {
    const before = previous.current
    previous.current = keys
    if (!before) return
    const was = new Set(before)
    const now = new Set(keys)
    const added = keys.filter((key) => !was.has(key))
    const gone = before.filter((key) => !now.has(key))
    if (!added.length && !gone.length) return
    setArrived((set) => {
      const next = new Set(set)
      for (const key of gone) next.delete(key)
      for (const key of added) next.add(key)
      return next
    })
  }, [keys])
  return React.useCallback((key: string) => arrived.has(key), [arrived])
}

/**
 * Items that just left, kept as inert ghosts for the length of their out moment. Each ghost goes when `left(item)` is
 * called (from its `onAnimationEnd`), or after `fallbackMs` when nothing animated. The default, 600 ms, is longer than
 * the longest out moment a brand can set (pop's 300 ms at the slowest speed, 1.5×, is 450 ms). An item that comes back while its
 * ghost is still leaving takes the ghost's place.
 */
export function useLeaving<T>(items: readonly T[], keyOf: (item: T) => string, fallbackMs = 600): { leaving: readonly T[]; left: (item: T) => void } {
  const [leaving, setLeaving] = React.useState<readonly T[]>([])
  const previous = React.useRef<readonly T[] | null>(null)
  React.useLayoutEffect(() => {
    const before = previous.current
    previous.current = items
    if (!before) return
    const now = new Set(items.map(keyOf))
    const gone = before.filter((item) => !now.has(keyOf(item)))
    setLeaving((list) => {
      const kept = list.filter((item) => !now.has(keyOf(item)))
      return kept.length === list.length && gone.length === 0 ? list : [...kept, ...gone]
    })
  }, [items, keyOf])
  React.useEffect(() => {
    if (leaving.length === 0) return
    const timer = window.setTimeout(() => setLeaving([]), fallbackMs)
    return () => window.clearTimeout(timer)
  }, [leaving, fallbackMs])
  const left = React.useCallback((item: T) => setLeaving((list) => list.filter((x) => x !== item)), [])
  return { leaving, left }
}

/* ---------------------------------------------------------------- JavaScript-driven motion */

/** What the person allows here: everything, the calm level (reduced motion), or nothing. */
export type MotionMode = "full" | "calm" | "none"

/**
 * The person's setting where `el` is: `none` under `data-motion="none"`, `calm` under the OS's reduced-motion setting
 * or `data-motion="calm"`, else `full`. `none` or `calm` anywhere above wins (the same reach as the CSS variants), the
 * OS setting can't be raised by the app, and values that aren't Candor's are ignored (an app's own Radix menus, beside
 * Candor's Base UI ones, write `data-motion` on their panels for the direction they opened from).
 */
export function motionMode(el: Element | null | undefined): MotionMode {
  if (el?.closest('[data-motion="none"]')) return "none"
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "calm"
  if (el?.closest('[data-motion="calm"]')) return "calm"
  return "full"
}

/**
 * `motionMode` for a component that has to react to it: the person's setting where `ref`'s element is, read after
 * mount and again whenever the app changes `data-motion` or the OS setting changes. It starts as `full` for the first
 * render, since there is nothing to read until the element exists. Use it for behaviour (a timer that must stop),
 * not for styling, which the CSS variants already answer.
 */
export function useMotionMode(ref: React.RefObject<Element | null>): MotionMode {
  const [mode, setMode] = React.useState<MotionMode>("full")
  React.useEffect(() => {
    const read = () => setMode(motionMode(ref.current))
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"], subtree: true })
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    query?.addEventListener("change", read)
    return () => {
      observer.disconnect()
      query?.removeEventListener("change", read)
    }
  }, [ref])
  return mode
}

const number = (value: string) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * The level a moment resolves to on `el`, read from its computed style: the moment's token, its family's, the preset,
 * then capped by `data-motion`. A page without Candor's CSS reads as subtle.
 */
export function motionLevel(el: Element | null | undefined, moment: MotionMoment | MotionFamily): MotionLevel {
  if (!el || typeof getComputedStyle === "undefined") return 1
  const style = getComputedStyle(el)
  const read = (name: string) => number(style.getPropertyValue(name))
  const { item, moment: name, family } = typeof moment === "string" ? { item: undefined, moment: undefined, family: moment } : moment
  const level = (item ? read(`--cd-motion-${item}-${name}`) : undefined) ?? read(`--cd-motion-${family}`) ?? read("--cd-motion-preset") ?? 1
  const cap = read("--cd-motion-cap") ?? 2
  const resolved = Math.max(0, Math.min(2, Math.round(Math.min(level, cap))))
  return (motionFamilies[family].essential ? Math.max(1, resolved) : resolved) as MotionLevel
}

/**
 * For motion that CSS can't stop (smooth scrolling, the Web Animations API, a bar painted from the clock): a stable
 * function that answers, at the moment of the motion, whether it may play on `ref`'s element. False under
 * `data-motion="none"`, under the calm level (reduced motion), and when the moment's resolved level is 0. Pass the
 * moment's chain from `motion()`, or a family name for the family's level.
 */
export function useMotionAllowed(ref: React.RefObject<Element | null>, moment: MotionStyle | MotionFamily): () => boolean {
  const target = typeof moment === "string" ? moment : motionMomentOf(moment)
  return React.useCallback(() => {
    const el = ref.current
    if (motionMode(el) !== "full") return false
    return target ? motionLevel(el, target) > 0 : true
  }, [ref, target])
}
