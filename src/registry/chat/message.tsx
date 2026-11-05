"use client"

import { CircleStop, Info, UserCheck, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { DegradedPanel } from "@/registry/blocks/degraded-panel"
import { RelativeTime } from "@/registry/blocks/relative-time"
import type { EntityRef, Message as MessageData } from "@/registry/lib/chat"
import { AgentAvatar, useAgentRoles } from "@/registry/chat/agent-avatar"
import { SourceList } from "@/registry/chat/citation"
import { blocksToText, MessageContent } from "@/registry/chat/message-content"
import { MessageActions, type Rating } from "@/registry/chat/message-actions"
import { Reasoning } from "@/registry/chat/reasoning"

/**
 * One message in a thread.
 *
 * - A person's message sits right, on the user surface.
 * - An agent's sits left, under its avatar, name and role, with reasoning above
 *   the answer, sources and actions below. While streaming, a caret follows the
 *   last block; an interrupted reply keeps what arrived and says it stopped.
 * - A person on the team (support, say) sits left like an agent, under a
 *   neutral avatar with their name and team, so they never read as the agent.
 * - A system line is centred and quiet.
 * - A reply a person checked (or edited) before it went out can say so in a
 *   caption under it, so a reader knows a person stood behind it.
 */
function Message({
  message,
  onOpenEntity,
  onNavigate,
  onRetry,
  onContinue,
  rating,
  onRate,
  reviewedBy,
  className,
}: {
  /** The message: author, status, blocks, and optional reasoning, sources and attribution. */
  message: MessageData
  /** Makes entity chips open their thing. */
  onOpenEntity?: (entity: EntityRef) => void
  /** Follows in-app links. */
  onNavigate?: (to: string) => void
  /** Shows Retry on a failed or finished reply. */
  onRetry?: () => void
  /** Shows Continue on an interrupted reply. */
  onContinue?: () => void
  /** The current rating of an agent reply. */
  rating?: Rating
  /** Shows thumbs up and down under agent replies. */
  onRate?: (rating: Rating) => void
  /** A person who checked this agent reply before it was sent: "Checked by Sam", or "Edited by Sam" when they changed it. */
  reviewedBy?: { name: string; at?: string; edited?: boolean }
  className?: string
}) {
  const { author } = message
  const roleOf = useAgentRoles()

  if (author.role === "system") {
    return (
      <div data-slot="message" data-role="system" className={cn("flex items-center justify-center gap-1.5 py-1 text-xs text-faint-foreground", className)}>
        <Info aria-hidden className="size-3" />
        <MessageContent blocks={message.blocks} className="text-xs leading-normal" />
      </div>
    )
  }

  if (author.role === "user") {
    return (
      <div data-slot="message" data-role="user" className={cn("flex justify-end pl-10 sm:pl-24 animate-rise-in", className)}>
        <div className="flex max-w-full flex-col items-end gap-1">
          <div className="rounded-xl rounded-br-sm bg-surface-user px-3.5 py-2.5">
            <MessageContent blocks={message.blocks} onOpenEntity={onOpenEntity} onNavigate={onNavigate} className="gap-2" />
          </div>
          <span className="px-1 text-2xs text-faint-foreground">
            {author.name ?? "You"}
            {message.createdAt && (
              <>
                {" · "}
                <RelativeTime date={message.createdAt} />
              </>
            )}
          </span>
        </div>
      </div>
    )
  }

  if (author.role === "person") {
    return (
      <article
        data-slot="message"
        data-role="person"
        aria-label={author.team ? `${author.name}, ${author.team}` : author.name}
        className={cn("flex gap-3 animate-rise-in", className)}
      >
        <span aria-hidden className="mt-px flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <header className="flex h-7 items-center gap-2">
            <span className="text-sm font-semibold">{author.name}</span>
            {author.team && <span className="truncate text-xs text-muted-foreground">{author.team}</span>}
            {message.createdAt && (
              <span className="text-xs text-faint-foreground">
                <RelativeTime date={message.createdAt} />
              </span>
            )}
          </header>
          <MessageContent blocks={message.blocks} sources={message.sources} onOpenEntity={onOpenEntity} onNavigate={onNavigate} className="mt-1" />
        </div>
      </article>
    )
  }

  const { agent } = author
  const streaming = message.status === "streaming"
  const thinking = streaming && message.blocks.length === 0
  const text = blocksToText(message.blocks, message.sources)
  const meta = [message.attribution?.model, message.attribution?.cost].filter(Boolean).join(" · ")

  return (
    <article
      data-slot="message"
      data-role="agent"
      data-status={message.status}
      aria-busy={streaming}
      aria-label={`${agent.name}, ${roleOf(agent.role).noun} agent`}
      className={cn("group/message flex gap-3 animate-rise-in", className)}
    >
      <AgentAvatar agent={agent} className="mt-px" />
      <div className="min-w-0 flex-1">
        <header className="flex h-7 items-center gap-2">
          <span className="text-sm font-semibold">{agent.name}</span>
          {agent.specialty && <span className="truncate text-xs text-muted-foreground">{agent.specialty}</span>}
          {message.createdAt && (
            <span className="text-xs text-faint-foreground">
              <RelativeTime date={message.createdAt} />
            </span>
          )}
        </header>

        <div className="mt-1 flex flex-col gap-3">
          {message.reasoning && message.reasoning.length > 0 && (
            <Reasoning entries={message.reasoning} thinking={thinking} thoughtFor={message.thoughtFor} />
          )}

          {message.blocks.length > 0 && (
            <div className="relative">
              <MessageContent blocks={message.blocks} sources={message.sources} onOpenEntity={onOpenEntity} onNavigate={onNavigate} />
              {streaming && (
                <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-primary animate-caret" />
              )}
            </div>
          )}

          {message.status === "interrupted" && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CircleStop aria-hidden className="size-3.5" />
              Stopped before it finished. What arrived is kept.
              {onContinue && (
                <button type="button" onClick={onContinue} className="font-medium text-accent-text hover:underline">
                  Continue
                </button>
              )}
            </div>
          )}

          {message.status === "failed" && (
            <DegradedPanel reason="The agent couldn’t finish this reply." missing="The rest of the answer" onRetry={onRetry} />
          )}

          {!streaming && message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}

          {reviewedBy && (
            <p data-slot="message-reviewed" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserCheck aria-hidden className="size-3.5" />
              {reviewedBy.edited ? "Edited" : "Checked"} by {reviewedBy.name} before sending
              {reviewedBy.at && (
                <>
                  {" · "}
                  <RelativeTime date={reviewedBy.at} />
                </>
              )}
            </p>
          )}

          {!streaming && message.status !== "failed" && (
            <MessageActions
              text={text}
              onRetry={onRetry}
              rating={rating}
              onRate={onRate}
              meta={meta || undefined}
              className="-ml-1.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100"
            />
          )}
        </div>
      </div>
    </article>
  )
}

export { Message }
