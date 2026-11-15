"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { DegradedPanel } from "@/registry/parts/degraded-panel"
import type { Attachment, EntityRef, InlineNode, ListBlock, ListItemBlock, MessageBlock, MessageSource } from "@/registry/foundation/chat"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/ui/tooltip"
import { Citation } from "@/registry/chat/citation"
import { EntityChip } from "@/registry/chat/entity-chip"
import { RegistryCard } from "@/registry/chat/card-registry"
import { Payload } from "@/registry/chat/payload"
import { AttachmentList } from "@/registry/chat/attachment-preview"
import { ToolCallGroup } from "@/registry/chat/tool-call"
import { useStrings } from "@/registry/foundation/locale"
import { neutralizeBidi } from "@/registry/foundation/bidi"
import type { HeadingLevel } from "@/registry/foundation/heading-level"
import { belowLevel, useHeadingScope } from "@/registry/foundation/heading-scope"

/** MessageContent's fixed words; override them under `messageContent` in LocaleProvider's `strings`. */
export const messageContentStrings = {
  measured: "From the {environment}",
  measuredFrom: "From the {environment}: {source}",
  notVerified: " (not verified)",
  provisional: "The agent hasn’t verified this against the {environment}.",
  /** The name of the area a table from the model scrolls sideways in. */
  table: "Table",
}

type Ctx = {
  sources: Map<string, MessageSource>
  onOpenEntity?: ((entity: EntityRef) => void) | undefined
  onNavigate?: ((to: string) => void) | undefined
  onOpenAttachment?: ((attachment: Attachment) => void) | undefined
  bareCode?: boolean | undefined
  /** The level a model's top heading (`#`) is drawn at; deeper ones go one level down each, to 6. */
  headingLevel: HeadingLevel
}

const ContentContext = React.createContext<Ctx>({ sources: new Map(), headingLevel: 3 })

/**
 * A claim the agent hasn't verified. Its reason shows in a tooltip, and describes the claim to screen readers whether
 * the tooltip is open or not (a hidden copy the claim points at), as `Locked` gives its reason.
 */
function Provisional({ nodes, reason, notVerified }: { nodes: InlineNode[]; reason: string; notVerified: string }) {
  const id = React.useId()
  return (
    <>
      <Tooltip describes={false}>
        <TooltipTrigger
          render={
            <button
              type="button"
              data-provisional
              aria-describedby={id}
              className="inline rounded-xs text-start text-provisional underline decoration-provisional/50 decoration-dotted underline-offset-[3px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80"
            >
              <Inline nodes={nodes} />
              <span className="sr-only">{notVerified}</span>
            </button>
          }
        />
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <span id={id} hidden>
        {reason}
      </span>
    </>
  )
}

/**
 * Inline nodes. Every string here may come from a model or the user's system, so it is
 * only ever rendered as a React text child: no markdown parsing, no HTML, and no bidi control characters
 * (`neutralizeBidi` marks them).
 */
function Inline({
  nodes,
}: {
  /** Inline nodes: text, strong, code, entities, citations. */
  nodes: InlineNode[]
}) {
  const t = useStrings("messageContent", messageContentStrings)
  const ctx = React.useContext(ContentContext)
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case "text":
            return <React.Fragment key={i}>{neutralizeBidi(n.text)}</React.Fragment>
          case "strong":
            return <strong key={i} className="font-semibold">{neutralizeBidi(n.text)}</strong>
          case "em":
            return <em key={i}>{neutralizeBidi(n.text)}</em>
          case "code":
            return (
              <code key={i} className="rounded-xs bg-muted px-1 py-px font-mono text-[0.88em]">
                <bdi>{neutralizeBidi(n.text)}</bdi>
              </code>
            )
          case "measured":
            return (
              <bdi key={i} title={n.source ? t("measuredFrom", { source: neutralizeBidi(n.source) }) : t("measured")} className="font-medium tabular-nums text-foreground">
                {neutralizeBidi(n.text)}
              </bdi>
            )
          case "provisional":
            return <Provisional key={i} nodes={n.nodes} reason={neutralizeBidi(n.reason) ?? t("provisional")} notVerified={t("notVerified")} />
          case "citation":
            return <Citation key={i} source={ctx.sources.get(n.sourceId)} />
          case "entity":
            return <EntityChip key={i} entity={n.entity} onOpen={ctx.onOpenEntity} />
          case "link":
            return (
              <a
                key={i}
                href={n.to}
                onClick={(e) => {
                  if (ctx.onNavigate) {
                    e.preventDefault()
                    ctx.onNavigate(n.to)
                  }
                }}
                className="font-medium text-accent-text underline-offset-2 hover:underline"
              >
                {neutralizeBidi(n.text)}
              </a>
            )
        }
      })}
    </>
  )
}

const alignClass = { start: "text-start", center: "text-center", end: "text-end" } as const

/** A cell's alignment class, from a column's alignment that may have come as JSON: anything else is the default. */
const cellAlign = (align: readonly unknown[] | undefined, column: number) => {
  const a = align?.[column]
  return a === "start" || a === "center" || a === "end" ? alignClass[a] : "text-start"
}

/**
 * A table from model text. It scrolls sideways inside its own area when it is wider than the message, so that area
 * takes focus (keyboard users can scroll it) and has a name. Alignment is start, centre or end, so it mirrors in a
 * right-to-left reply.
 */
function TableBlock({ block }: { block: Extract<MessageBlock, { kind: "table" }> }) {
  const t = useStrings("messageContent", messageContentStrings)
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div data-slot="message-table" role="group" aria-label={t("table")} tabIndex={0} className="max-w-full overflow-x-auto rounded-md border outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/80">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {block.header.map((cell, c) => (
              <th key={c} scope="col" className={cn("px-(--cd-cell-px,0.5rem) py-(--cd-row-py,0.5rem) font-semibold text-foreground", cellAlign(block.align, c))}>
                <Inline nodes={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="border-b last:border-b-0">
              {row.map((cell, c) => (
                <td key={c} className={cn("px-(--cd-cell-px,0.5rem) py-(--cd-row-py,0.5rem) align-top", cellAlign(block.align, c))}>
                  <Inline nodes={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** How many levels of list are drawn nested; a list deeper than this, in blocks sent as JSON, is drawn as its items' text. */
const LIST_DEPTH = 4

/**
 * A list, with what sits under each item drawn inside it: paragraphs, and lists one level in. A nested unordered list
 * has hollow markers. Its indent is on the start side, so a right-to-left reply mirrors it.
 */
function ListView({ block, depth = 1 }: { block: ListBlock; depth?: number | undefined }) {
  const List = block.ordered ? "ol" : "ul"
  const nested = Array.isArray(block.nested) ? block.nested : undefined
  return (
    <List
      className={cn(
        "flex flex-col gap-1 ps-5",
        block.ordered ? "list-decimal" : depth > 1 ? "list-[circle] marker:text-faint-foreground" : "list-disc marker:text-faint-foreground"
      )}
    >
      {block.items.map((item, i) => {
        const under = nested?.[i]
        return (
          <li key={i} className="ps-0.5 whitespace-pre-line">
            <Inline nodes={item} />
            {Array.isArray(under) && under.length > 0 && (
              <div className="mt-1 flex flex-col gap-1">
                {under.map((b, j) => (
                  <ListItemPart key={j} block={b} depth={depth} />
                ))}
              </div>
            )}
          </li>
        )
      })}
    </List>
  )
}

/** A block under a list item: a paragraph, or a list one level in (its items' text, past the deepest level drawn). */
function ListItemPart({ block, depth }: { block: ListItemBlock; depth: number }) {
  if (block?.kind === "paragraph")
    return (
      <p className={block.breaks ? "whitespace-pre-line" : undefined}>
        <Inline nodes={block.nodes} />
      </p>
    )
  if (block?.kind !== "list") return null
  if (depth < LIST_DEPTH) return <ListView block={block} depth={depth + 1} />
  return (
    <>
      {flatItems(block).map((nodes, i) => (
        <p key={i}>
          <Inline nodes={nodes} />
        </p>
      ))}
    </>
  )
}

/** Every item's text in a list and the lists under it, in reading order. Walks without recursing, so any depth is safe. */
function flatItems(block: ListBlock): InlineNode[][] {
  const out: InlineNode[][] = []
  const stack: (ListItemBlock | InlineNode[])[] = [block]
  while (stack.length) {
    const top = stack.pop()
    if (Array.isArray(top)) out.push(top)
    else if (top?.kind === "paragraph") {
      if (Array.isArray(top.nodes)) out.push(top.nodes)
    } else if (top?.kind === "list" && Array.isArray(top.items)) {
      const parts: (ListItemBlock | InlineNode[])[] = []
      top.items.forEach((item, i) => {
        parts.push(item)
        const under = top.nested?.[i]
        if (Array.isArray(under)) parts.push(...under)
      })
      for (let k = parts.length - 1; k >= 0; k--) stack.push(parts[k]!)
    }
  }
  return out
}

function AttachmentBlock({ files }: { files: Attachment[] }) {
  const ctx = React.useContext(ContentContext)
  return <AttachmentList attachments={files} onOpen={ctx.onOpenAttachment} />
}

function Block({
  block,
}: {
  block: MessageBlock
}) {
  const { bareCode, headingLevel } = React.useContext(ContentContext)
  switch (block.kind) {
    case "paragraph":
      return (
        <p className={block.breaks ? "whitespace-pre-line" : undefined}>
          <Inline nodes={block.nodes} />
        </p>
      )
    case "plain":
      return <p className="whitespace-pre-wrap break-words">{neutralizeBidi(block.text)}</p>
    case "heading": {
      // Levels are relative to the content: a `#` is drawn at `headingLevel` (h3 in a thread, whose page owns h1 and
      // h2), and each deeper one a level below, to h6. Blocks can arrive as JSON, so an out-of-range level is clamped
      // rather than trusted.
      const level = Math.min(Math.max(Math.round(block.level) || 1, 1), 3) as 1 | 2 | 3
      const H = `h${Math.min(headingLevel + level - 1, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
      return (
        <H className={cn("font-semibold tracking-tight text-foreground", level === 1 ? "mt-1 text-lg" : level === 2 ? "mt-1 text-base" : "text-sm")}>
          <Inline nodes={block.nodes} />
        </H>
      )
    }
    case "list":
      return <ListView block={block} />
    case "payload":
      return <Payload language={block.language} text={block.text} title={block.title} bare={bareCode} />
    case "table":
      return <TableBlock block={block} />
    case "quote":
      return (
        <blockquote data-slot="message-quote" className="flex flex-col gap-2 border-s-2 ps-3 text-muted-foreground">
          {block.paragraphs.map((nodes, i) => {
            const list = block.lists?.[i]
            return list?.kind === "list" ? (
              <ListView key={i} block={list} />
            ) : (
              <p key={i} className={block.breaks ? "whitespace-pre-line" : undefined}>
                <Inline nodes={nodes} />
              </p>
            )
          })}
        </blockquote>
      )
    case "tools":
      return <ToolCallGroup calls={block.calls} />
    case "degraded":
      return <DegradedPanel reason={neutralizeBidi(block.reason)} missing={neutralizeBidi(block.missing)} />
    case "card":
      return <RegistryCard name={block.card} props={block.props} summary={block.summary} />
    case "attachments":
      return <AttachmentBlock files={block.files} />
    // A kind from a later version, in blocks stored or sent as JSON: nothing is drawn for it.
    default:
      return null
  }
}

/**
 * A message's blocks, in order. Build them from text with `plainBlocks(text)` for a person's words (newlines kept, no
 * markdown) and `markdownBlocks(text)` for an agent's answer, both from `safe-markdown`, which installs with this item. Import them from there: they run on the server too. A
 * model's links show as text, never as clickable links.
 */
function MessageContent({
  blocks,
  sources = [],
  onOpenEntity,
  onNavigate,
  onOpenAttachment,
  bareCode,
  headingLevel,
  className,
}: {
  /** The reply as typed blocks: paragraphs, lists, tables, quotes, payloads, tool calls, cards, attachments. */
  blocks: MessageBlock[]
  /** Sources the blocks cite by marker. */
  sources?: MessageSource[] | undefined
  /** Makes entity chips open their thing. */
  onOpenEntity?: ((entity: EntityRef) => void) | undefined
  /** Follows in-app links; links from a model are never rendered. */
  onNavigate?: ((to: string) => void) | undefined
  /** Makes attachment tiles buttons that open their file. */
  onOpenAttachment?: ((attachment: Attachment) => void) | undefined
  /** Code and other payload blocks without their frame and title bar (Payload's `bare`). */
  bareCode?: boolean | undefined
  /**
   * The level a model's top heading (`#`) is drawn at, to fit the page's outline; `##` and `###` go one and two levels
   * below it, to 6. Left out, it is one below the nearest `HeadingScope` (since 6.0.0), else 3, under a thread page's
   * `<h1>` and `<h2>`.
   */
  headingLevel?: HeadingLevel | undefined
  className?: string | undefined
}) {
  const scope = useHeadingScope()
  const level = headingLevel !== undefined ? belowLevel(headingLevel, 0) : scope !== undefined ? belowLevel(scope) : 3
  const ctx = React.useMemo(
    () => ({ sources: new Map(sources.map((s) => [s.id, s])), onOpenEntity, onNavigate, onOpenAttachment, bareCode, headingLevel: level }),
    [sources, onOpenEntity, onNavigate, onOpenAttachment, bareCode, level]
  )
  return (
    <ContentContext.Provider value={ctx}>
      <div data-slot="message-content" className={cn("flex flex-col gap-3 text-prose leading-relaxed", className)}>
        {blocks.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </div>
    </ContentContext.Provider>
  )
}

/** Plain text of a message, for copy. Citations become [n]; entities their API name. Bidi controls are marked, as on screen. */
export function blocksToText(blocks: MessageBlock[], sources: MessageSource[] = []): string {
  return neutralizeBidi(rawText(blocks, sources))
}

const delimiters = { start: ":--", center: ":-:", end: "--:" } as const
const delimiterOf = (a: unknown) => (a === "start" || a === "center" || a === "end" ? delimiters[a] : "---")

function rawText(blocks: MessageBlock[], sources: MessageSource[]): string {
  const marker = new Map(sources.map((s) => [s.id, s.marker]))
  const inline = (nodes: InlineNode[]): string =>
    nodes
      .map((n) => {
        switch (n.kind) {
          case "provisional":
            return inline(n.nodes)
          case "citation":
            return `[${marker.get(n.sourceId) ?? "?"}]`
          case "entity":
            return n.entity.name
          default:
            return n.text
        }
      })
      .join("")
  // A list as `-` and `1.` lines, what is under an item indented by its marker's width (`- ` is 2, `1. ` is 3), which
  // CommonMark reads back at the same levels; a paragraph under an item has a blank line before it. Past the depth
  // drawn, the items' text stays as flat lines.
  const listText = (list: ListBlock, indent = "", depth = 1): string =>
    list.items
      .map((it, i) => {
        const bullet = list.ordered ? `${i + 1}. ` : "- "
        const inner = indent + " ".repeat(bullet.length)
        const nested = list.nested?.[i]
        const under = (Array.isArray(nested) ? nested : []).map((b) => {
          if (b?.kind === "list") return depth < LIST_DEPTH ? listText(b, inner, depth + 1) : flatItems(b).map((nodes) => `${inner}- ${inline(nodes)}`).join("\n")
          if (b?.kind === "paragraph") return `\n${inline(b.nodes).split("\n").map((line) => `${inner}${line}`).join("\n")}`
          return ""
        })
        return [`${indent}${bullet}${inline(it)}`, ...under.filter(Boolean)].join("\n")
      })
      .join("\n")
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "paragraph":
        case "heading":
          return inline(b.nodes)
        case "plain":
          return b.text
        case "list":
          return listText(b)
        case "payload":
          return b.text
        case "quote":
          // Each line of a paragraph its own `>` line, so a quote with line breaks copies as one quote.
          return b.paragraphs
            .map((p, i) => {
              const list = b.lists?.[i]
              return (list?.kind === "list" ? listText(list) : inline(p)).split("\n").map((line) => `> ${line}`).join("\n")
            })
            .join("\n>\n")
        case "table": {
          // As a pipe table, which reads as one in plain text and reads back as one.
          const row = (cells: InlineNode[][]) => `| ${cells.map((c) => inline(c).replace(/\|/g, "\\|")).join(" | ")} |`
          const rule = `| ${b.header.map((_, i) => delimiterOf(b.align?.[i])).join(" | ")} |`
          return [row(b.header), rule, ...b.rows.map(row)].join("\n")
        }
        case "degraded":
          return b.reason
        case "card":
          return b.summary
        case "attachments":
          return b.files.map((f) => f.name).join("\n")
        case "tools":
          return ""
        // A kind from a later version: no text for it.
        default:
          return ""
      }
    })
    .filter(Boolean)
    .join("\n\n")
}

export { MessageContent, Inline }
