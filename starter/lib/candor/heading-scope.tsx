"use client"

import * as React from "react"
import type { HeadingLevel } from "@/lib/candor/heading-level"

/*
 * One rule for where a Candor heading sits in the page's outline (5.0.0, KIT-226). An item's heading is:
 *
 *   1. its `headingLevel` prop, when the app passes one;
 *   2. else one below the nearest `HeadingScope` round it;
 *   3. else 2, since a page's content sits under the page's `<h1>`.
 *
 * Never deeper than 6. An item's own nested headings sit below its top heading with `belowLevel`.
 */

const HeadingScopeContext = React.createContext<HeadingLevel | undefined>(undefined)

/** The deepest level HTML has; a level below it stays at it. */
const deepest: HeadingLevel = 6

const capped = (level: number): HeadingLevel => (Math.min(Math.max(Math.trunc(level), 1), deepest) as HeadingLevel)

/**
 * Says the content inside sits under a heading of `level`, so each Candor item in it draws its heading one level
 * below (`level + 1`) unless it is given `headingLevel`. Put it round a section the app titles itself:
 *
 * ```tsx
 * <section aria-labelledby="usage">
 *   <h2 id="usage">Usage</h2>
 *   <HeadingScope level={2}>
 *     <DetailsList … />   // draws its title as <h3>
 *   </HeadingScope>
 * </section>
 * ```
 *
 * Candor's dialogs, sheets, drawers, settings sections and dashboard tiles set one round their content themselves.
 * A scope inside another replaces it; it doesn't add to it.
 */
function HeadingScope({ level, children }: {
  /** The level of the heading the content sits under: `2` when the section's own heading is an `<h2>`. */
  level: HeadingLevel
  /** The content under that heading. */
  children?: React.ReactNode | undefined
}) {
  return <HeadingScopeContext.Provider value={capped(level)}>{children}</HeadingScopeContext.Provider>
}

/**
 * The level an item draws its top heading at: `headingLevel` when given; else one below the nearest `HeadingScope`;
 * else 2. Never deeper than 6.
 *
 * ```tsx
 * function Summary({ title, headingLevel }: { title: string; headingLevel?: HeadingLevel | undefined }) {
 *   const level = useHeadingLevel(headingLevel)
 *   const Tag = `h${level}` as const
 *   return <Tag className="text-base font-semibold">{title}</Tag>
 * }
 * ```
 */
function useHeadingLevel(headingLevel?: HeadingLevel | undefined): HeadingLevel {
  const scope = React.useContext(HeadingScopeContext)
  if (headingLevel !== undefined) return capped(headingLevel)
  return scope === undefined ? 2 : capped(scope + 1)
}

/**
 * The level of the nearest `HeadingScope`, or `undefined` outside any. For an item that drew no heading in a release
 * before it read the scope, and so becomes a heading only inside one (or when given `headingLevel`), keeping what it
 * drew outside.
 */
function useHeadingScope(): HeadingLevel | undefined {
  return React.useContext(HeadingScopeContext)
}

/**
 * The level `n` steps below `level` (one by default), for the headings an item draws under its own top heading.
 * Never deeper than 6. `belowLevel(useHeadingLevel(headingLevel))` is the level of a card's title inside a list.
 */
function belowLevel(level: HeadingLevel, n: number = 1): HeadingLevel {
  return capped(level + n)
}

export { HeadingScope, useHeadingLevel, useHeadingScope, belowLevel }
