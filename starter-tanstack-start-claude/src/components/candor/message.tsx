import type * as React from "react"
import { CircleDashed, CircleStop, UserCheck, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { DegradedPanel } from "@/components/candor/degraded-panel"
import { RelativeTime } from "@/components/candor/relative-time"
import { ShimmerLabel } from "@/components/candor/streaming-text"
import type { DateStyle } from "@/components/candor/locale"
import type { Attachment, EntityRef, Message as MessageData } from "@/lib/candor/chat"
import { AgentAvatar, useAgentRoles } from "@/components/candor/agent-avatar"
import { SourceList } from "@/components/candor/citation"
import { blocksToText, MessageContent } from "@/components/candor/message-content"
import { MessageActions, type Rating } from "@/components/candor/message-actions"
import { Reasoning } from "@/components/candor/reasoning"
import { ThreadEvent } from "@/components/candor/thread-event"
import { useStrings } from "@/components/candor/locale"
import { motion } from "@/lib/candor/motion"

/**
 * @motion arrive:arrive A message rises in when it is added to a Thread after the thread first drew, whether it is
 * the person's or the agent's. Messages loaded with the thread, and a Message outside a Thread, are drawn still.
 */
const arriveMotion = motion("message", "arrive", "arrive")
/**
 * @motion live:caret While a reply is still streaming, a caret blinks at the end of its text. It goes when the reply
 * finishes or is interrupted, and under reduced motion it is a still bar.
 */
const caretMotion = motion("message", "caret", "live", { dur: 1000 })

/** Message's fixed words; override them under `message` in LocaleProvider's `strings`. */
export const messageStrings = {
  you: "You",
  personLabel: "{name}, {team}",
  agentLabel: "{name} ({noun})",
  interrupted: "Stopped before it finished. What arrived is kept.",
  continue: "Continue",
  failed: "The agent couldn’t finish this reply.",
  failedMissing: "The rest of the answer",
  checkedBy: "Checked by {name} before sending",
  editedBy: "Edited by {name} before sending",
  /** The line a streaming reply shows before anything of it has arrived. Not "Thinking": nothing says the model is yet. */
  working: "Working",
  /** Between the parts of a meta line: a name and its time, a model and its cost. */
  metaSeparator: " · ",
}

/**
 * One message in a thread.
 *
 * - A person's message sits right, on the user surface, with their name and
 *   time under it (`meta` hides or replaces that line).
 * - An agent's sits left, under its avatar, name and role, with reasoning above
 *   the answer, sources and actions below. While streaming, a caret follows the
 *   last block; an interrupted reply keeps what arrived and says it stopped.
 * - A person on the team (support, say) sits left like an agent, under a
 *   neutral avatar with their name and team, so they never read as the agent.
 * - A system line is centred and quiet.
 * - A reply a person checked (or edited) before it went out can say so in a
 *   caption under it, so a reader knows a person stood behind it.
 * - Times are relative ("5 minutes ago") unless `timeFormat` asks for an
 *   absolute "time", "date" or "datetime" in the locale.
 *
 * Build `blocks` with `plainBlocks(text)` for a person's words and
 * `markdownBlocks(text)` for an agent's, from `safe-markdown`.
 */
function Message({
  message,
  onOpenEntity,
  onNavigate,
  onOpenAttachment,
  onRetry,
  onContinue,
  rating,
  onRate,
  reviewedBy,
  footer,
  actions,
  meta,
  timeFormat,
  density = "default",
  bareCode,
  nameShownAbove,
  className,
}: {
  /** The message: author, status, blocks, and optional reasoning, sources and attribution. */
  message: MessageData
  /** Makes entity chips open their thing. */
  onOpenEntity?: ((entity: EntityRef) => void) | undefined
  /** Follows in-app links. */
  onNavigate?: ((to: string) => void) | undefined
  /** Makes attachment tiles buttons that open their file. */
  onOpenAttachment?: ((attachment: Attachment) => void) | undefined
  /** Shows Retry on a failed or finished reply. */
  onRetry?: (() => void) | undefined
  /** Shows Continue on an interrupted reply. */
  onContinue?: (() => void) | undefined
  /** The current rating of an agent reply. */
  rating?: Rating | undefined
  /** Shows thumbs up and down under agent replies. */
  onRate?: ((rating: Rating) => void) | undefined
  /** A person who checked this agent reply before it was sent: "Checked by Sam", or "Edited by Sam" when they changed it. */
  reviewedBy?: { name: string; at?: string | undefined; edited?: boolean | undefined } | undefined
  /** More lines under an agent reply, after who checked it and above the actions row: e.g. MemoryUsed. */
  footer?: React.ReactNode | undefined
  /**
   * The row under an agent reply (copy, retry, rating). `false` hides it; a node replaces it, e.g. your own buttons.
   * Model and cost still show, on their own line. To rebuild a message, use MessageHeader, MessageBody and
   * MessageFooter.
   */
  actions?: false | React.ReactNode | undefined
  /** The line under a person's own message: their name and when they sent it. `false` hides it; a node replaces it. */
  meta?: false | React.ReactNode | undefined
  /** How times show: "relative" (the default, "5 minutes ago") or an absolute "time", "date" or "datetime" in the locale. */
  timeFormat?: "relative" | DateStyle | undefined
  /** "compact" draws the header row smaller: a 12px name in a 24px row, for dense layouts. Defaults to "default". */
  density?: "default" | "compact" | undefined
  /** Code and other payload blocks without their frame (Payload's `bare`). */
  bareCode?: boolean | undefined
  /**
   * The agent's or teammate's name is already shown above the thread (a panel titled with the agent, a one-to-one
   * chat), so the header leaves it out of sight: screen readers still hear it, and the specialty or team and the time
   * stay. A header left with nothing to show isn't drawn. A person's own messages are unchanged. Set it only on the
   * messages of the one agent or teammate the panel names, never in a thread with several agents or across a hand-off,
   * where the name is how a reader tells who wrote each message.
   */
  nameShownAbove?: boolean | undefined
  /** Classes, merged with Candor's. */
  className?: string | undefined
}) {
  const { author } = message
  const roleOf = useAgentRoles()
  const t = useStrings("message", messageStrings)

  if (author.role === "system") {
    return (
      <ThreadEvent data-slot="message" data-role="system" className={className}>
        <MessageContent blocks={message.blocks} className="text-xs leading-normal" />
      </ThreadEvent>
    )
  }

  if (author.role === "user") {
    return (
      <div data-slot="message" data-role="user" style={arriveMotion} className={cn("flex justify-end ps-10 sm:ps-24 data-[arrived]:cd-arrive", className)}>
        <div className="flex max-w-full flex-col items-end gap-1">
          <div className="rounded-xl rounded-ee-sm bg-surface-user px-3.5 py-2.5">
            <MessageContent blocks={message.blocks} onOpenEntity={onOpenEntity} onNavigate={onNavigate} onOpenAttachment={onOpenAttachment} bareCode={bareCode} className="gap-2" />
          </div>
          {meta === undefined ? (
            <span data-slot="message-meta" className="px-1 text-2xs text-faint-foreground">
              {author.name ?? t("you")}
              {message.createdAt && (
                <>
                  {t("metaSeparator")}
                  <RelativeTime date={message.createdAt} format={timeFormat} />
                </>
              )}
            </span>
          ) : (
            meta
          )}
        </div>
      </div>
    )
  }

  if (author.role === "person") {
    return (
      <article
        data-slot="message"
        data-role="person"
        aria-label={author.team ? t("personLabel", { name: author.name, team: author.team }) : author.name}
        style={arriveMotion}
        className={cn("flex gap-3 data-[arrived]:cd-arrive", className)}
      >
        <span aria-hidden className="mt-px flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <MessageHeader name={author.name} detail={author.team} createdAt={message.createdAt} timeFormat={timeFormat} density={density} nameShownAbove={nameShownAbove} />
          <MessageContent blocks={message.blocks} sources={message.sources} onOpenEntity={onOpenEntity} onNavigate={onNavigate} onOpenAttachment={onOpenAttachment} bareCode={bareCode} className="mt-1" />
        </div>
      </article>
    )
  }

  const { agent } = author
  const streaming = message.status === "streaming"

  return (
    <article
      data-slot="message"
      data-role="agent"
      data-status={message.status}
      aria-busy={streaming}
      aria-label={t("agentLabel", { name: agent.name, noun: roleOf(agent.role).noun })}
      style={arriveMotion}
      className={cn("group/message flex gap-3 data-[arrived]:cd-arrive", className)}
    >
      <AgentAvatar agent={agent} className="mt-px" />
      <div className="min-w-0 flex-1">
        <MessageHeader name={agent.name} detail={agent.specialty} createdAt={message.createdAt} timeFormat={timeFormat} density={density} nameShownAbove={nameShownAbove} />
        <div className="mt-1 flex flex-col gap-3">
          <MessageBody message={message} onOpenEntity={onOpenEntity} onNavigate={onNavigate} onOpenAttachment={onOpenAttachment} bareCode={bareCode} />
          <MessageFooter
            message={message}
            onRetry={onRetry}
            onContinue={onContinue}
            rating={rating}
            onRate={onRate}
            reviewedBy={reviewedBy}
            footer={footer}
            actions={actions}
            timeFormat={timeFormat}
          />
        </div>
      </div>
    </article>
  )
}

/** The row above a reply: who sent it, a detail (their specialty or team), and when. */
function MessageHeader({
  name,
  detail,
  createdAt,
  timeFormat,
  density = "default",
  nameShownAbove = false,
  children,
  className,
}: {
  /** The sender's displayed name. */
  name: string
  /** A quieter detail after the name: an agent's specialty, a person's team. */
  detail?: string | undefined
  /** When it was sent; shown as a relative time unless `timeFormat` says otherwise. */
  createdAt?: string | undefined
  /** "relative" (the default) or an absolute "time", "date" or "datetime" in the locale. */
  timeFormat?: "relative" | DateStyle | undefined
  /** "compact": a 12px name in a 24px row. Defaults to "default" (14px in 28px). */
  density?: "default" | "compact" | undefined
  /**
   * The name is already shown above the thread: it leaves the row but stays for screen readers. With no detail, time
   * or children either, no row is drawn, only the name for screen readers.
   */
  nameShownAbove?: boolean | undefined
  /** Anything else for the row, after the time (a badge, a menu). */
  children?: React.ReactNode | undefined
  /** Classes, merged with Candor's. */
  className?: string | undefined
}) {
  if (nameShownAbove && !detail && !createdAt && (children === undefined || children === null || children === false)) {
    return (
      <span data-slot="message-header" data-name-shown-above="" className="sr-only">
        {name}
      </span>
    )
  }
  return (
    <header
      data-slot="message-header"
      data-density={density}
      data-name-shown-above={nameShownAbove ? "" : undefined}
      className={cn("flex items-center gap-2", density === "compact" ? "h-6" : "h-7", className)}
    >
      <span className={cn(nameShownAbove ? "sr-only" : "font-semibold", !nameShownAbove && (density === "compact" ? "text-xs" : "text-sm"))}>{name}</span>
      {detail && <span className={cn("truncate text-muted-foreground", density === "compact" ? "text-2xs" : "text-xs")}>{detail}</span>}
      {createdAt && (
        <span className={cn("text-faint-foreground", density === "compact" ? "text-2xs" : "text-xs")}>
          <RelativeTime date={createdAt} format={timeFormat} />
        </span>
      )}
      {children}
    </header>
  )
}

/**
 * A reply's content: its reasoning, then its blocks, with a caret after the last one while it streams. Until anything
 * of a streaming reply arrives it shows a working line, "Working", which counts the time since the message's
 * `startedAt` when it has one ("Working · 4.2s"). It says "Working", not "Thinking": the request may still be queued
 * or on its way, and nothing yet says the model is reasoning. Reasoning, once it arrives, says "Thinking".
 */
function MessageBody({
  message,
  onOpenEntity,
  onNavigate,
  onOpenAttachment,
  bareCode,
  className,
}: {
  /** The message whose reasoning and blocks to show. */
  message: MessageData
  /** Makes entity chips open their thing. */
  onOpenEntity?: ((entity: EntityRef) => void) | undefined
  /** Follows in-app links. */
  onNavigate?: ((to: string) => void) | undefined
  /** Makes attachment tiles buttons that open their file. */
  onOpenAttachment?: ((attachment: Attachment) => void) | undefined
  /** Code and other payload blocks without their frame. */
  bareCode?: boolean | undefined
  /** Classes, merged with Candor's. */
  className?: string | undefined
}) {
  const t = useStrings("message", messageStrings)
  const streaming = message.status === "streaming"
  const thinking = streaming && message.blocks.length === 0
  const hasReasoning = message.reasoning !== undefined && message.reasoning.length > 0
  const started = message.startedAt === undefined ? undefined : typeof message.startedAt === "number" ? message.startedAt : Date.parse(message.startedAt)
  const startedAt = started !== undefined && Number.isFinite(started) ? started : undefined
  return (
    <div data-slot="message-body" className={cn("flex flex-col gap-3", className)}>
      {thinking && !hasReasoning && (
        <p data-slot="message-working" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleDashed aria-hidden className="size-3.5 text-accent-text" />
          <ShimmerLabel className="text-xs" startedAt={startedAt}>
            {t("working")}
          </ShimmerLabel>
        </p>
      )}
      {message.reasoning && hasReasoning && <Reasoning entries={message.reasoning} thinking={thinking} thoughtFor={message.thoughtFor} startedAt={startedAt} />}
      {message.blocks.length > 0 && (
        <div className="relative">
          <MessageContent blocks={message.blocks} sources={message.sources} onOpenEntity={onOpenEntity} onNavigate={onNavigate} onOpenAttachment={onOpenAttachment} bareCode={bareCode} />
          {streaming && <span aria-hidden style={caretMotion} className="ms-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-primary cd-live-caret" />}
        </div>
      )}
    </div>
  )
}

/** Model and cost, on a line of their own: what the actions row shows, for when it's hidden or replaced. */
function MessageAttribution({
  attribution,
  className,
}: {
  /** The service's measured values; nothing shows when both are absent. */
  attribution?: MessageData["attribution"] | undefined
  /** Classes, merged with Candor's. */
  className?: string | undefined
}) {
  const t = useStrings("message", messageStrings)
  const meta = [attribution?.model, attribution?.cost].filter(Boolean).join(t("metaSeparator"))
  if (!meta) return null
  return (
    <p data-slot="message-attribution" className={cn("text-xs text-faint-foreground", className)}>
      {meta}
    </p>
  )
}

/**
 * What sits under a reply: that it stopped or failed, its sources, who checked it, then the actions row with model
 * and cost. `actions={false}` hides the row and a node replaces it; either way the model and cost stay, on their own
 * line, because a reader should always see what produced the answer.
 */
function MessageFooter({
  message,
  onRetry,
  onContinue,
  rating,
  onRate,
  reviewedBy,
  footer,
  actions,
  timeFormat,
  className,
}: {
  /** The message the footer belongs to. */
  message: MessageData
  /** Shows Retry on a failed or finished reply. */
  onRetry?: (() => void) | undefined
  /** Shows Continue on an interrupted reply. */
  onContinue?: (() => void) | undefined
  /** The current rating. */
  rating?: Rating | undefined
  /** Shows thumbs up and down. */
  onRate?: ((rating: Rating) => void) | undefined
  /** A person who checked the reply before it was sent. */
  reviewedBy?: { name: string; at?: string | undefined; edited?: boolean | undefined } | undefined
  /** More lines after who checked it and above the actions row: e.g. MemoryUsed. */
  footer?: React.ReactNode | undefined
  /** `false` hides the actions row, a node replaces it; model and cost still show. */
  actions?: false | React.ReactNode | undefined
  /** How the reviewer's time shows: "relative" (the default) or an absolute "time", "date" or "datetime". */
  timeFormat?: "relative" | DateStyle | undefined
  /** Classes, merged with Candor's. */
  className?: string | undefined
}) {
  const t = useStrings("message", messageStrings)
  const streaming = message.status === "streaming"
  const settled = !streaming && message.status !== "failed"
  const meta = [message.attribution?.model, message.attribution?.cost].filter(Boolean).join(t("metaSeparator"))
  return (
    <div data-slot="message-footer" className={cn("flex flex-col gap-3 empty:hidden", className)}>
      {message.status === "interrupted" && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <CircleStop aria-hidden className="size-3.5" />
          {t("interrupted")}
          {onContinue && (
            <button type="button" onClick={onContinue} className="relative after:absolute after:inset-x-0 after:-inset-y-1 font-medium text-accent-text hover:underline">
              {t("continue")}
            </button>
          )}
        </div>
      )}

      {message.status === "failed" && <DegradedPanel reason={t("failed")} missing={t("failedMissing")} onRetry={onRetry} />}

      {!streaming && message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}

      {reviewedBy && (
        <p data-slot="message-reviewed" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserCheck aria-hidden className="size-3.5" />
          {t(reviewedBy.edited ? "editedBy" : "checkedBy", { name: reviewedBy.name })}
          {reviewedBy.at && (
            <>
              {t("metaSeparator")}
              <RelativeTime date={reviewedBy.at} format={timeFormat} />
            </>
          )}
        </p>
      )}

      {footer}

      {settled && actions === undefined && (
        <MessageActions
          text={blocksToText(message.blocks, message.sources)}
          onRetry={onRetry}
          rating={rating}
          onRate={onRate}
          meta={meta || undefined}
          className="-ms-1.5 opacity-100 cd-tint sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100"
        />
      )}
      {settled && actions !== undefined && actions !== false && actions}
      {settled && actions !== undefined && <MessageAttribution attribution={message.attribution} />}
    </div>
  )
}

export { Message, MessageHeader, MessageBody, MessageFooter, MessageAttribution }
