const unit = (raw: string): number | undefined => {
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined
}

/** The five things the app may make a sound for. A closed list: `reply` and `silent` have no `AttentionKind` until 3.0. */
export type SoundEvent = "needs-you" | "finished" | "failed" | "reply" | "silent"

/**
 * The names and the reading half of Candor's sound layer. A brand file names a sound per event
 * (`--cd-sound-needs-you: "/sounds/needs-you.mp3"`); this file knows the five events, reads that token from the
 * page's computed style, and holds the small arithmetic the Pro hooks share. It plays nothing: nothing is fetched
 * until `useAttention` or `sound-setting` plays a sound, and a sound is always off until the person turns it on.
 *
 * Tokens, all optional, all read when a sound is about to play:
 * - `--cd-sound-<event>`: a string, the path of an MP3 hosted by the app. No token, no sound, silently.
 * - `--cd-sound-<event>-ogg`: a string, an Ogg/Opus alternative the browser may prefer.
 * - `--cd-sound-volume`: 0 to 1, how loud every sound is. `--cd-sound-<event>-volume`: 0 to 1, scales that for one event.
 *
 * Safe to import on the server: the document is touched only inside `readSoundToken`.
 */

/** Every event, in the order the settings control lists them. */
export const soundEvents: readonly SoundEvent[] = ["needs-you", "finished", "failed", "reply", "silent"]

/** The events a sound is offered for once the person turns sound on; `reply` and `silent` stay off until they pick them. */
export const defaultSoundEvents: readonly SoundEvent[] = ["needs-you", "finished", "failed"]

/** A sound as the brand names it: where the file is, an optional Ogg alternative, and how loud (0 to 1). */
export type SoundToken = { src: string; ogg?: string | undefined; volume: number }

/** The longest a sound may be, in seconds. `theme check` measures what it can read. */
export const maxSoundSeconds = 1.5

/** The least time between two plays of the same event, in milliseconds. A burst plays once. */
export const soundCoalesceMs = 3000

/** A CSS custom property's value as the text it names: quotes removed, or the inside of `url(…)`. Empty when unset. */
export function soundString(raw: string): string {
  const v = raw.trim()
  const url = /^url\(\s*(['"]?)(.*?)\1\s*\)$/.exec(v)
  const text = url ? (url[2] ?? "") : v
  return text.replace(/^(['"])(.*)\1$/, "$2").trim()
}

const styleOf = (element?: Element | undefined) =>
  typeof document === "undefined" || typeof getComputedStyle === "undefined" ? undefined : getComputedStyle(element ?? document.documentElement)

/** How loud `event` is, 0 to 1: the global `--cd-sound-volume` times the event's own, each 1 when unset. 1 on the server. */
export function readSoundVolume(event: SoundEvent, element?: Element | undefined): number {
  const style = styleOf(element)
  if (!style) return 1
  return (unit(style.getPropertyValue("--cd-sound-volume")) ?? 1) * (unit(style.getPropertyValue(`--cd-sound-${event}-volume`)) ?? 1)
}

/**
 * The brand's sound for `event`, read from the computed style of `element` (the document's root when left out), or
 * `undefined` when the brand names none, or on the server.
 */
export function readSoundToken(event: SoundEvent, element?: Element | undefined): SoundToken | undefined {
  const style = styleOf(element)
  const src = style && soundString(style.getPropertyValue(`--cd-sound-${event}`))
  if (!style || !src) return undefined
  const ogg = soundString(style.getPropertyValue(`--cd-sound-${event}-ogg`))
  return { src, ...(ogg && { ogg }), volume: readSoundVolume(event, element) }
}

/**
 * Whether a play at `now` is allowed, given when each event last played and when anything last played: the same event
 * waits `soundCoalesceMs` after it played, and any sound in the same instant (a burst) is the one already playing.
 * Pure; the caller keeps the clock.
 */
export function mayPlay(event: SoundEvent, last: Partial<Record<SoundEvent, number>>, now: number, burstMs = 400): boolean {
  const before = last[event]
  if (before !== undefined && now - before < soundCoalesceMs) return false
  return !soundEvents.some((e) => (last[e] ?? -Infinity) > now - burstMs)
}
