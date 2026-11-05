"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useTerms } from "@/registry/blocks/terms"
import { DegradedPanel } from "@/registry/blocks/degraded-panel"
import type { Attachment, EntityRef, InlineNode, MessageBlock, MessageSource } from "@/registry/lib/chat"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/ui/tooltip"
import { Citation } from "@/registry/chat/citation"
import { EntityChip } from "@/registry/chat/entity-chip"
import { Card } from "@/registry/chat/card-registry"
import { Payload } from "@/registry/chat/payload"
import { AttachmentList } from "@/registry/chat/attachment-preview"
import { ToolCallGroup } from "@/registry/chat/tool-call"
import { useStrings } from "@/registry/blocks/locale"

/** MessageContent's fixed words; override them under `messageContent` in LocaleProvider's `strings`. */
export const messageContentStrings = {
  measured: "From the {environment}",
  measuredFrom: "From the {environment}: {source}",
  notVerified: " (not verified)",
  provisional: "The agent hasn’t verified this against the {environment}.",
}

type Ctx = {
  sources: Map<string, MessageSource>
  onOpenEntity?: (entity: EntityRef) => void
  onNavigate?: (to: string) => void
  onOpenAttachment?: (attachment: Attachment) => void
}

const ContentContext = React.createContext<Ctx>({ sources: new Map() })

/**
 * Inline nodes. Every string here may come from a model or the user's system, so it is
 * only ever rendered as a React text child: no markdown parsing, no HTML.
 */
function Inline({
  nodes,
}: {
  /** Inline nodes: text, strong, code, entities, citations. */
  nodes: InlineNode[]
}) {
  const terms = useTerms()
  const t = useStrings("messageContent", messageContentStrings)
  const ctx = React.useContext(ContentContext)
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case "text":
            return <React.Fragment key={i}>{n.text}</React.Fragment>
          case "strong":
            return <strong key={i} className="font-semibold">{n.text}</strong>
          case "em":
            return <em key={i}>{n.text}</em>
          case "code":
            return (
              <code key={i} className="rounded-xs bg-muted px-1 py-px font-mono text-[0.88em]">
                {n.text}
              </code>
            )
          case "measured":
          case "orgData":
            return (
              <span key={i} title={n.source ? t("measuredFrom", { environment: terms.environment, source: n.source }) : t("measured", { environment: terms.environment })} className="font-medium tabular-nums text-foreground">
                {n.text}
              </span>
            )
          case "provisional":
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-provisional
                    className="inline rounded-xs text-start text-provisional underline decoration-provisional/50 decoration-dotted underline-offset-[3px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  >
                    <Inline nodes={n.nodes} />
                    <span className="sr-only">{t("notVerified")}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{n.reason ?? t("provisional", { environment: terms.environment })}</TooltipContent>
              </Tooltip>
            )
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
                {n.text}
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
  switch (block.kind) {
    case "paragraph":
      return (
        <p>
          <Inline nodes={block.nodes} />
        </p>
      )
    case "plain":
      return <p className="whitespace-pre-wrap break-words">{block.text}</p>
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
      return <Payload language={block.language} text={block.text} title={block.title} />
    case "tools":
      return <ToolCallGroup calls={block.calls} />
    case "degraded":
      return <DegradedPanel reason={block.reason} missing={block.missing} />
    case "card":
      return <Card name={block.card} props={block.props} summary={block.summary} />
    case "attachments":
      return <AttachmentBlock files={block.files} />
  }
}

/** A message's blocks, in order. */
function MessageContent({
  blocks,
  sources = [],
  onOpenEntity,
  onNavigate,
  onOpenAttachment,
  className,
}: {
  /** The reply as typed blocks: paragraphs, lists, payloads, tool calls, cards, attachments. */
  blocks: MessageBlock[]
  /** Sources the blocks cite by marker. */
  sources?: MessageSource[]
  /** Makes entity chips open their thing. */
  onOpenEntity?: (entity: EntityRef) => void
  /** Follows in-app links; links from a model are never rendered. */
  onNavigate?: (to: string) => void
  /** Makes attachment tiles buttons that open their file. */
  onOpenAttachment?: (attachment: Attachment) => void
  className?: string
}) {
  const ctx = React.useMemo(
    () => ({ sources: new Map(sources.map((s) => [s.id, s])), onOpenEntity, onNavigate, onOpenAttachment }),
    [sources, onOpenEntity, onNavigate, onOpenAttachment]
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

/** Plain text of a message, for copy. Citations become [n]; entities their API name. */
export function blocksToText(blocks: MessageBlock[], sources: MessageSource[] = []): string {
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
