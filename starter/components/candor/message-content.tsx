"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { DegradedPanel } from "@/components/candor/degraded-panel"
import type { Attachment, EntityRef, InlineNode, MessageBlock, MessageSource } from "@/lib/candor/chat"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/candor/ui/tooltip"
import { Citation } from "@/components/candor/citation"
import { EntityChip } from "@/components/candor/entity-chip"
import { RegistryCard } from "@/components/candor/card-registry"
import { Payload } from "@/components/candor/payload"
import { AttachmentList } from "@/components/candor/attachment-preview"
import { ToolCallGroup } from "@/components/candor/tool-call"
import { useStrings } from "@/components/candor/locale"
import { neutralizeBidi } from "@/lib/candor/bidi"

/** MessageContent's fixed words; override them under `messageContent` in LocaleProvider's `strings`. */
export const messageContentStrings = {
  measured: "From the {environment}",
  measuredFrom: "From the {environment}: {source}",
  notVerified: " (not verified)",
  provisional: "The agent hasn’t verified this against the {environment}.",
}

type Ctx = {
  sources: Map<string, MessageSource>
  onOpenEntity?: ((entity: EntityRef) => void) | undefined
  onNavigate?: ((to: string) => void) | undefined
  onOpenAttachment?: ((attachment: Attachment) => void) | undefined
  bareCode?: boolean | undefined
}

const ContentContext = React.createContext<Ctx>({ sources: new Map() })

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

function AttachmentBlock({ files }: { files: Attachment[] }) {
  const ctx = React.useContext(ContentContext)
  return <AttachmentList attachments={files} onOpen={ctx.onOpenAttachment} />
}

function Block({
  block,
}: {
  block: MessageBlock
}) {
  const { bareCode } = React.useContext(ContentContext)
  switch (block.kind) {
    case "paragraph":
      return (
        <p>
          <Inline nodes={block.nodes} />
        </p>
      )
    case "plain":
      return <p className="whitespace-pre-wrap break-words">{neutralizeBidi(block.text)}</p>
    case "heading": {
      // Levels are relative to the message: the thread page owns h1 and h2.
      // Blocks can arrive as JSON, so an out-of-range level is clamped rather than trusted.
      const level = Math.min(Math.max(Math.round(block.level) || 1, 1), 3) as 1 | 2 | 3
      const H = (["h3", "h4", "h5"] as const)[level - 1]!
      return (
        <H className={cn("font-semibold tracking-tight text-foreground", level === 1 ? "mt-1 text-lg" : level === 2 ? "mt-1 text-base" : "text-sm")}>
          <Inline nodes={block.nodes} />
        </H>
      )
    }
    case "list": {
      const List = block.ordered ? "ol" : "ul"
      return (
        <List className={cn("flex flex-col gap-1 ps-5", block.ordered ? "list-decimal" : "list-disc marker:text-faint-foreground")}>
          {block.items.map((item, i) => (
            <li key={i} className="ps-0.5">
              <Inline nodes={item} />
            </li>
          ))}
        </List>
      )
    }
    case "payload":
      return <Payload language={block.language} text={block.text} title={block.title} bare={bareCode} />
    case "tools":
      return <ToolCallGroup calls={block.calls} />
    case "degraded":
      return <DegradedPanel reason={neutralizeBidi(block.reason)} missing={neutralizeBidi(block.missing)} />
    case "card":
      return <RegistryCard name={block.card} props={block.props} summary={block.summary} />
    case "attachments":
      return <AttachmentBlock files={block.files} />
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
  className,
}: {
  /** The reply as typed blocks: paragraphs, lists, payloads, tool calls, cards, attachments. */
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
  className?: string | undefined
}) {
  const ctx = React.useMemo(
    () => ({ sources: new Map(sources.map((s) => [s.id, s])), onOpenEntity, onNavigate, onOpenAttachment, bareCode }),
    [sources, onOpenEntity, onNavigate, onOpenAttachment, bareCode]
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
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "paragraph":
        case "heading":
          return inline(b.nodes)
        case "plain":
          return b.text
        case "list":
          return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : "-"} ${inline(it)}`).join("\n")
        case "payload":
          return b.text
        case "degraded":
          return b.reason
        case "card":
          return b.summary
        case "attachments":
          return b.files.map((f) => f.name).join("\n")
        case "tools":
          return ""
      }
    })
    .filter(Boolean)
    .join("\n\n")
}

export { MessageContent, Inline }
