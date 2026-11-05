"use client"

import * as React from "react"
import {
  Box,
  Braces,
  ChartColumn,
  File,
  FileText,
  Gauge,
  Link,
  Table2,
  TextCursorInput,
  UserRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { EntityRef } from "@/registry/lib/chat"

export type EntityKindInfo = { Icon: LucideIcon; noun: string }

/** Kinds most apps have. Add your own (or a preset) with EntityKindsProvider. */
export const baseKinds: Record<string, EntityKindInfo> = {
  record: { Icon: FileText, noun: "Record" },
  document: { Icon: FileText, noun: "Document" },
  file: { Icon: File, noun: "File" },
  table: { Icon: Table2, noun: "Table" },
  field: { Icon: TextCursorInput, noun: "Field" },
  person: { Icon: UserRound, noun: "Person" },
  link: { Icon: Link, noun: "Link" },
  code: { Icon: Braces, noun: "Code" },
  workflow: { Icon: Waypoints, noun: "Workflow" },
  report: { Icon: ChartColumn, noun: "Report" },
  dashboard: { Icon: Gauge, noun: "Dashboard" },
}

/** What an unregistered kind shows: still labelled, never a crash or a blank. */
const unknownKind: EntityKindInfo = { Icon: Box, noun: "Item" }

const KindsContext = React.createContext<Record<string, EntityKindInfo>>(baseKinds)

/**
 * The kinds of thing your app's entities can be: an icon and a noun each.
 * Nested providers add to (and can override) the kinds above them.
 */
function EntityKindsProvider({
  kinds,
  children,
}: {
  /** Kind ids mapped to an icon and a noun. */
  kinds: Record<string, EntityKindInfo>
  children: React.ReactNode
}) {
  const parent = React.useContext(KindsContext)
  const value = React.useMemo(() => ({ ...parent, ...kinds }), [parent, kinds])
  return <KindsContext.Provider value={value}>{children}</KindsContext.Provider>
}

/** Look up a kind's icon and noun; unknown kinds read as "Item". */
function useEntityKinds() {
  const kinds = React.useContext(KindsContext)
  return React.useCallback((kind: string) => kinds[kind] ?? unknownKind, [kinds])
}

/**
 * A thing in the user's system (a record, a table, a field, a workflow…) named
 * in a message or the composer. The kind's icon and noun are always present,
 * so "Account" the table and "Account" the report never read alike. The
 * identifier is the label unless a friendlier one is given; then the
 * identifier is on hover and for screen readers.
 */
function EntityChip({
  entity,
  onOpen,
  onRemove,
  className,
}: {
  /** The thing to show: its kind, identifier and optional label. */
  entity: EntityRef
  /** Makes the chip a button that opens the thing. */
  onOpen?: (entity: EntityRef) => void
  /** Adds a remove button, e.g. in the composer. */
  onRemove?: (entity: EntityRef) => void
  className?: string
}) {
  const { Icon, noun } = useEntityKinds()(entity.kind)
  const shown = entity.label ?? entity.name
  const title = `${noun}: ${entity.name}${entity.location ? ` in ${entity.location}` : ""}`
  const body = (
    <>
      <Icon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{shown}</span>
      <span className="sr-only"> ({title})</span>
    </>
  )
  const base =
    "inline-flex max-w-full items-center gap-1 rounded-sm border bg-card px-1.5 py-px align-baseline font-mono text-[0.92em] leading-[1.35] text-foreground"
  return (
    <span data-slot="entity-chip" data-kind={entity.kind} title={title} className={cn("inline-flex max-w-full min-w-0 items-center sm:max-w-64", className)}>
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(entity)}
          className={cn(base, "cursor-pointer transition-colors duration-150 hover:border-border-strong hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none")}
        >
          {body}
        </button>
      ) : (
        <span className={base}>{body}</span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${shown}`}
          onClick={() => onRemove(entity)}
          className="-ml-px rounded-r-sm border border-l-0 bg-card px-1 py-px text-faint-foreground hover:text-foreground"
        >
          ×
        </button>
      )}
    </span>
  )
}

export { EntityChip, EntityKindsProvider, useEntityKinds }
