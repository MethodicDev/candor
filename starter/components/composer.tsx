"use client"

import * as React from "react"
import { ArrowUp, LoaderCircle, Paperclip, Square, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Attachment, ComposerScope, EntityRef, MentionOption, SlashCommand } from "@/lib/chat"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EntityChip, useEntityKinds } from "@/components/entity-chip"

export type ComposerState =
  | "ready"
  | "sending"
  | "streaming"
  | { kind: "locked"; reason: string }
  | { kind: "offline"; reason?: string }

type Trigger = { char: "@" | "/"; start: number; query: string }

type MenuItem =
  | { type: "mention"; option: MentionOption }
  | { type: "command"; command: SlashCommand }

/** The @ or / token the caret sits in, if any. A / only counts at the start of the message. */
function findTrigger(value: string, caret: number): Trigger | null {
  const before = value.slice(0, caret)
  const m = /(^|\s)([@/])([\w.-]*)$/.exec(before)
  if (!m) return null
  const char = m[2] as "@" | "/"
  const start = before.length - m[3]!.length - 1
  if (char === "/" && before.slice(0, start).trim() !== "") return null
  return { char, start, query: m[3]! }
}

const groupOf = (item: MenuItem) => (item.type === "command" ? "Commands" : item.option.group)

function formatSize(bytes?: number) {
  if (bytes === undefined) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Where a person asks. Mentions (@) attach things in the user's system as chips the agent
 * receives as references, not as text it has to parse; slash commands (/) start
 * a known action. The scope pill says which environment the ask runs
 * against, and turns to a warning when that is production.
 *
 * Enter sends, Shift+Enter breaks a line. While an agent replies the send button
 * becomes Stop. A locked composer says why; an offline one says so.
 */
function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  state = "ready",
  scope,
  onScopeClick,
  mentions = [],
  commands = [],
  references = [],
  onReferencesChange,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  placeholder = "Ask a question, or describe a change",
  label = "Message",
  className,
}: {
  /** The text in the box. */
  value: string
  /** Called with the new text as the person types. */
  onChange: (value: string) => void
  /** Called on send with the text and the entities mentioned. */
  onSubmit: (value: string, references: EntityRef[]) => void
  /** Shown as Stop while a reply is streaming. */
  onStop?: () => void
  /** ready, sending, streaming, locked (with a reason) or offline. */
  state?: ComposerState
  /** Where the next message's work lands; production turns the pill to a warning. */
  scope?: ComposerScope
  /** Makes the scope pill a button, e.g. to change environment. */
  onScopeClick?: () => void
  /** What @ can insert, grouped under their headings. */
  mentions?: MentionOption[]
  /** What / can run, only at the start of a message. */
  commands?: SlashCommand[]
  /** Entities already attached, shown as chips. */
  references?: EntityRef[]
  /** Called when a chip is added or removed. */
  onReferencesChange?: (references: EntityRef[]) => void
  /** Files attached, with upload progress or an error. */
  attachments?: Attachment[]
  /** Shows an attach button; called with the chosen files. */
  onAttach?: (files: File[]) => void
  /** Called when a file is removed. */
  onRemoveAttachment?: (id: string) => void
  /** Shown in the empty box. */
  placeholder?: string
  /** The accessible name of the text box. */
  label?: string
  className?: string
}) {
  const kindOf = useEntityKinds()
  const id = React.useId()
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [trigger, setTrigger] = React.useState<Trigger | null>(null)
  const [active, setActive] = React.useState(0)

  const locked = typeof state === "object" ? state : null
  const busy = state === "sending" || state === "streaming"
  const canSend = !locked && !busy && (value.trim().length > 0 || references.length > 0)

  const items: MenuItem[] = React.useMemo(() => {
    if (!trigger) return []
    const q = trigger.query.toLowerCase()
    if (trigger.char === "/") {
      return commands
        .filter((c) => c.name.toLowerCase().startsWith(q))
        .map((command) => ({ type: "command" as const, command }))
    }
    const taken = new Set(references.map((r) => `${r.kind}:${r.name}`))
    return mentions
      .filter((o) => !o.entity || !taken.has(`${o.entity.kind}:${o.entity.name}`))
      .filter((o) => o.label.toLowerCase().includes(q) || o.entity?.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((option) => ({ type: "mention" as const, option }))
  }, [trigger, commands, mentions, references])

  const menuOpen = trigger !== null && items.length > 0
  React.useEffect(() => setActive(0), [trigger?.query, trigger?.char])

  const syncTrigger = () => {
    const el = textarea.current
    if (!el) return
    setTrigger(findTrigger(el.value, el.selectionStart))
  }

  // Where the caret goes once a replaced value renders. Applied in a layout
  // effect on that render, so keystrokes typed afterwards are never moved.
  const pendingCaret = React.useRef<number | null>(null)
  React.useLayoutEffect(() => {
    const el = textarea.current
    if (el && pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
  }, [value, references])

  const replaceTrigger = (text: string) => {
    if (!trigger) return
    const el = textarea.current
    const caret = el?.selectionStart ?? value.length
    const next = value.slice(0, trigger.start) + text + value.slice(caret)
    pendingCaret.current = trigger.start + text.length
    onChange(next)
    setTrigger(null)
    el?.focus()
  }

  const choose = (item: MenuItem) => {
    if (item.type === "command") {
      replaceTrigger(`/${item.command.name} `)
    } else if (item.option.entity) {
      onReferencesChange?.([...references, item.option.entity])
      replaceTrigger("")
    } else {
      replaceTrigger(`@${item.option.label} `)
    }
  }

  const submit = () => {
    if (!canSend) return
    onSubmit(value.trim(), references)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActive((a) => (a + 1) % items.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActive((a) => (a - 1 + items.length) % items.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        choose(items[active]!)
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setTrigger(null)
        return
      }
    }
    if (e.key === "Backspace" && value === "" && references.length > 0) {
      onReferencesChange?.(references.slice(0, -1))
      return
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const production = !!scope?.production
  const listId = `${id}-menu`
  const optionId = (i: number) => `${id}-opt-${i}`

  return (
    <div data-slot="composer" className={cn("@container relative", className)}>
      {menuOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label={trigger?.char === "/" ? "Commands" : "Mentions"}
          className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-float animate-in fade-in-0 slide-in-from-bottom-1"
        >
          {items.map((item, i) => {
            const group = groupOf(item)
            const prev = items[i - 1]
            const header = !prev || groupOf(prev) !== group ? group : null
            const Icon = item.type === "mention" && item.option.entity ? kindOf(item.option.entity.kind).Icon : null
            return (
              <React.Fragment key={item.type === "command" ? item.command.id : item.option.id}>
                {header && <p className="px-2 pt-2 pb-1 text-2xs font-medium text-faint-foreground">{header}</p>}
                <div
                  id={optionId(i)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(item)
                  }}
                  onMouseMove={() => setActive(i)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  {item.type === "command" ? (
                    <>
                      <span className="font-mono text-xs text-accent-text">/{item.command.name}</span>
                      {item.command.args && <span className="font-mono text-xs text-faint-foreground">{item.command.args}</span>}
                      <span className="ml-auto truncate text-xs text-muted-foreground">{item.command.description}</span>
                    </>
                  ) : (
                    <>
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {Icon ? <Icon className="size-3.5" /> : <span className="text-xs">@</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.option.label}</span>
                        {(item.option.description ?? item.option.entity?.name) !== item.option.label && (item.option.description ?? item.option.entity?.name) && (
                          <span className="block truncate font-mono text-2xs text-faint-foreground">
                            {item.option.description ?? item.option.entity?.name}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl border bg-card shadow-raised transition-[border-color,box-shadow] duration-150 focus-within:border-border-strong focus-within:shadow-float",
          locked && "bg-muted shadow-none"
        )}
      >
        {(references.length > 0 || attachments.length > 0) && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {references.map((r) => (
              <EntityChip key={`${r.kind}:${r.name}`} entity={r} onRemove={(e) => onReferencesChange?.(references.filter((x) => x !== e))} />
            ))}
            {attachments.map((a) => (
              <span
                key={a.id}
                className={cn(
                  "relative inline-flex max-w-56 items-center gap-1.5 overflow-hidden rounded-md border bg-card py-1 pr-1 pl-2 text-xs",
                  a.error && "border-destructive/50"
                )}
              >
                <Paperclip aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.name}</span>
                <span className={cn("shrink-0 tabular-nums", a.error ? "text-destructive-text" : "text-faint-foreground")}>
                  {a.error ? a.error : a.progress !== undefined ? `${Math.round(a.progress * 100)}%` : formatSize(a.size)}
                </span>
                {onRemoveAttachment && (
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onRemoveAttachment(a.id)} className="rounded-sm p-0.5 text-faint-foreground hover:bg-accent hover:text-foreground">
                    <X className="size-3" />
                  </button>
                )}
                {a.progress !== undefined && !a.error && (
                  <span aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width] duration-300" style={{ width: `${a.progress * 100}%` }} />
                )}
              </span>
            ))}
          </div>
        )}

        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <textarea
          ref={textarea}
          id={id}
          rows={1}
          value={value}
          disabled={Boolean(locked)}
          placeholder={locked ? undefined : placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            requestAnimationFrame(syncTrigger)
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") syncTrigger()
          }}
          onClick={syncTrigger}
          onBlur={() => setTrigger(null)}
          aria-controls={menuOpen ? listId : undefined}
          aria-activedescendant={menuOpen ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-describedby={locked ? `${id}-locked` : undefined}
          className={cn(
            "block max-h-60 min-h-12 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base leading-relaxed outline-none [field-sizing:content] placeholder:text-faint-foreground disabled:cursor-not-allowed",
            locked && !value && "min-h-0 h-3 pt-3 pb-0"
          )}
        />
        {locked && (
          <p id={`${id}-locked`} className="flex items-center gap-1.5 px-4 pb-1 text-sm text-muted-foreground">
            {locked.kind === "offline" ? locked.reason ?? "You’re offline. Your message will wait here." : locked.reason}
          </p>
        )}

        <div className="flex items-center gap-1.5 px-2 pt-1 pb-2">
          {onAttach && (
            <>
              <input
                ref={fileInput}
                type="file"
                multiple
                tabIndex={-1}
                aria-label="Attach files"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) onAttach(files)
                  e.target.value = ""
                }}
              />
              <Tooltip>
                <TooltipTrigger render={<button type="button" aria-label="Attach files" disabled={Boolean(locked)} onClick={() => fileInput.current?.click()} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:opacity-40" />}><Paperclip className="size-4" /></TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>
            </>
          )}

          {scope && (
            <button
              type="button"
              onClick={onScopeClick}
              disabled={!onScopeClick}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors duration-150 enabled:hover:bg-accent",
                production ? "bg-warning-weak text-warning-text enabled:hover:bg-warning-weak" : "text-muted-foreground"
              )}
            >
              {production ? <TriangleAlert aria-hidden className="size-3 shrink-0" /> : <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />}
              <span className="truncate">
                {scope.environment} · {production ? "Production" : (scope.detail ?? "Non-production")}
              </span>
            </button>
          )}

          <span className="ml-auto hidden text-2xs text-faint-foreground @lg:inline">
            <kbd className="font-sans">↵</kbd> send · <kbd className="font-sans">⇧↵</kbd> new line · <kbd className="font-sans">@</kbd> mention
          </span>

          {state === "streaming" && onStop ? (
            <button
              type="button"
              aria-label="Stop"
              onClick={onStop}
              className="ml-auto flex size-8 items-center justify-center rounded-lg bg-foreground text-background transition-transform duration-150 active:scale-95 @lg:ml-1"
            >
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              onClick={submit}
              disabled={!canSend}
              aria-busy={state === "sending"}
              className="ml-auto flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-[background-color,opacity,transform] duration-150 enabled:hover:bg-primary-hover active:scale-95 disabled:opacity-30 @lg:ml-1"
            >
              {state === "sending" ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { Composer }
