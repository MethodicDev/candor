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
import type { EntityRef } from "@/lib/chat"
import { useStrings } from "@/components/locale"

/** EntityChip's fixed words; override them under `entityChip` in LocaleProvider's `strings`. */
export const entityChipStrings = {
  record: "Record",
  document: "Document",
  file: "File",
  table: "Table",
  field: "Field",
  person: "Person",
  link: "Link",
  code: "Code",
  workflow: "Workflow",
  report: "Report",
  dashboard: "Dashboard",
  /** An unregistered kind. */
  item: "Item",
  title: "{noun}: {name}",
  titleIn: "{noun}: {name} in {location}",
  remove: "Remove {name}",
}

type BaseKind = keyof typeof baseKindNames
const baseKindNames = {
  record: 1, document: 1, file: 1, table: 1, field: 1, person: 1, link: 1, code: 1, workflow: 1, report: 1, dashboard: 1,
} as const
const isBaseKind = (kind: string): kind is BaseKind => Object.hasOwn(baseKindNames, kind)

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
  const t = useStrings("entityChip", entityChipStrings)
  return React.useCallback(
    (kind: string): EntityKindInfo => {
      const info = kinds[kind]
      if (!info) return { ...unknownKind, noun: t("item") }
      // Built-in kinds take their noun from the strings table; an app's own kinds keep theirs.
      return isBaseKind(kind) && info === baseKinds[kind] ? { ...info, noun: t(kind) } : info
    },
    [kinds, t]
  )
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
  onOpen?: ((entity: EntityRef) => void) | undefined
  /** Adds a remove button, e.g. in the composer. */
  onRemove?: ((entity: EntityRef) => void) | undefined
  className?: string | undefined
}) {
  const { Icon, noun } = useEntityKinds()(entity.kind)
  const t = useStrings("entityChip", entityChipStrings)
  const shown = entity.label ?? entity.name
  const title = entity.location
    ? t("titleIn", { noun, name: entity.name, location: entity.location })
    : t("title", { noun, name: entity.name })
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
          className={cn(base, "cursor-pointer transition-colors duration-150 hover:border-border-strong hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/80 outline-none")}
        >
          {body}
        </button>
      ) : (
        <span className={base}>{body}</span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={t("remove", { name: shown })}
          onClick={() => onRemove(entity)}
          className="relative after:absolute after:-inset-1 -ms-px rounded-e-sm border border-s-0 bg-card px-1 py-px text-faint-foreground hover:text-foreground"
        >
          ×
        </button>
      )}
    </span>
  )
}

export { EntityChip, EntityKindsProvider, useEntityKinds }
