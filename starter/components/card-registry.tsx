"use client"

import * as React from "react"
import { ChevronRight, LayoutTemplate } from "lucide-react"
import { DegradedPanel } from "@/components/degraded-panel"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useStrings } from "@/components/locale"
import { motion } from "@/lib/motion"

/**
 * @motion reveal:open The text view opens to its full height when the person asks to see the card as text, and the
 * chevron turns with it; closing reverses both. Under reduced motion it snaps open or shut.
 */
const turnMotion = motion("card-registry", "open", "reveal")

/** CardRegistry's fixed words; override them under `cardRegistry` in LocaleProvider's `strings`. */
export const cardRegistryStrings = {
  showAsText: "Show it as text",
  unknown: "This reply includes a “{name}” card this app can’t show.",
  invalid: "The {label} couldn’t be shown: {problem}",
  failed: "The {label} failed while drawing.",
}

/**
 * A card an agent's reply can carry. `check` decides whether the props are
 * the shape `render` needs: it returns null when they are, or a sentence
 * saying what's wrong. Cards are data from a model; nothing renders until the
 * check passes.
 */
export type CardDefinition<P = unknown> = {
  /** What it is, in a few words, for fallbacks: "Query results". */
  label: string
  check: (props: unknown) => string | null
  render: (props: P) => React.ReactNode
}

// The registry holds cards of different prop types; each pairs its own check and render.
// oxlint-disable-next-line typescript/no-explicit-any
type AnyCard = CardDefinition<any>

/** Define a card with typed props; the check is what makes the cast safe. */
export function defineCard<P>(card: CardDefinition<P>): CardDefinition<P> {
  return card
}

const Registry = React.createContext<Record<string, AnyCard>>({})

/** Makes cards available to every message below it. Cards not listed here fall back to their summary. */
function CardRegistryProvider({
  cards,
  children,
}: {
  /** Your app's cards by name, made with defineCard. Left out, the cards of a provider above still apply. */
  cards?: Record<string, AnyCard> | undefined
  children: React.ReactNode
}) {
  const parent = React.useContext(Registry)
  return <Registry.Provider value={cards ?? parent}>{children}</Registry.Provider>
}

class CardBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Summary({
  text,
}: {
  text: string
}) {
  const t = useStrings("cardRegistry", cardRegistryStrings)
  return (
    <Collapsible className="group/summary">
      <CollapsibleTrigger className="relative after:absolute after:inset-x-0 after:-inset-y-1 inline-flex items-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80 rounded-sm">
        <ChevronRight aria-hidden style={turnMotion} className="rtl:-scale-x-100 size-3 cd-reveal-turn group-data-[state=open]/summary:[transform:rotate(90deg)]" /> {t("showAsText")}
      </CollapsibleTrigger>
      <CollapsibleContent style={turnMotion}>
        <p className="mt-1.5 rounded-md bg-sunken px-3 py-2 text-sm whitespace-pre-wrap">{text}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Renders one card from the registry. Three honest fallbacks, each with the
 * service's text summary: the app doesn't know this card; its data doesn't
 * fit (and how); or it failed while drawing.
 */
function RegistryCard({
  name,
  props,
  summary,
}: {
  /** Which card to draw, from the registry. */
  name: string
  /** The card's data, checked before it draws. */
  props: unknown
  /** The plain-text version, shown when the card can't be. */
  summary: string
}) {
  const t = useStrings("cardRegistry", cardRegistryStrings)
  const cards = React.useContext(Registry)
  const def = cards[name]
  if (!def) {
    return (
      <div data-slot="card-registry" data-card={name} data-state="unknown" className="flex flex-col gap-1.5 rounded-lg border border-dashed px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LayoutTemplate aria-hidden className="size-3.5" /> {t("unknown", { name })}
        </p>
        <Summary text={summary} />
      </div>
    )
  }
  const problem = def.check(props)
  if (problem) {
    return (
      <div data-slot="card-registry" data-card={name} data-state="invalid" className="flex flex-col gap-1.5">
        <DegradedPanel reason={t("invalid", { label: def.label.toLowerCase(), problem })} />
        <Summary text={summary} />
      </div>
    )
  }
  return (
    <div data-slot="card-registry" data-card={name} data-state="ready">
      <CardBoundary
        fallback={
          <div className="flex flex-col gap-1.5">
            <DegradedPanel reason={t("failed", { label: def.label.toLowerCase() })} />
            <Summary text={summary} />
          </div>
        }
      >
        {def.render(props)}
      </CardBoundary>
    </div>
  )
}

/* ---------------------------------------------------------------- small checking helpers */

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
export const isArrayOf = <T,>(v: unknown, item: (x: unknown) => x is T): v is T[] => Array.isArray(v) && v.every(item)
export const isString = (v: unknown): v is string => typeof v === "string"

/**
 * The same component as `RegistryCard`, under the name it was first exported with.
 *
 * @deprecated `Card` is also the name of the shadcn Card in `@/components/ui/card`, and a file that imports both has to
 * rename one. Import `RegistryCard` instead. This name is removed in 3.0.
 */
const Card = RegistryCard

export { RegistryCard, Card, CardRegistryProvider }
