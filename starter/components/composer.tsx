"use client"

import * as React from "react"
import { ArrowUp, LoaderCircle, Paperclip, Square, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Attachment, ComposerScope, EntityRef, MentionOption, SlashCommand } from "@/lib/chat"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EntityChip, useEntityKinds } from "@/components/entity-chip"
import { AttachmentChip } from "@/components/attachment-preview"
import { useStrings } from "@/components/locale"
import { motion, useArrived, useLeaving } from "@/lib/motion"

/**
 * @motion pop:chip A mention or attachment chip pops in when the person adds one while writing, and a chip they
 * remove pops out. Chips that were there when the composer first drew, such as a restored draft, appear still.
 */
const chipMotion = motion("composer", "chip", "pop")
/**
 * @motion overlay:menu The mention and command menu rises a little and fades in above the field when the person types
 * the character that opens it, and goes at once when it closes. Under reduced motion it is a short fade.
 */
const menuMotion = motion("composer", "menu", "overlay", { variant: "slide" })
/**
 * @motion press:send Send and Stop shrink a little while they are held down and return when let go. A Send that is
 * disabled never moves, and under reduced motion neither changes size.
 */
const sendMotion = motion("composer", "send", "press", { amp: "0.9" })
/**
 * @motion live:sending While the app reports that the message is being sent, a spinner turns in place of Send's
 * arrow. It stops when the app says sending is over, and under reduced motion the spinner is still.
 */
const sendingMotion = motion("composer", "sending", "live", { dur: 1000 })

/** Composer's fixed words; override them under `composer` in LocaleProvider's `strings`. */
export const composerStrings = {
  placeholder: "Ask a question, or describe a change",
  label: "Message",
  commands: "Commands",
  mentions: "Mentions",
  attachFiles: "Attach files",
  production: "Production",
  nonProduction: "Non-production",
  offline: "You’re offline. Your message will wait here.",
  hintSend: "send",
  hintNewLine: "new line",
  hintMention: "mention",
  hintCommand: "command",
  stop: "Stop",
  send: "Send",
  dropFiles: "Drop files to attach",
}

export type ComposerState =
  | "ready"
  | "sending"
  | "streaming"
  | { kind: "locked"; reason: string }
  | { kind: "offline"; reason?: string | undefined }
  /** Typing stays open, but sending waits, and the box says why: "Your partner is still thinking". */
  | { kind: "held"; reason: string }

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

const groupOf = (item: MenuItem, commandsLabel = "Commands") => (item.type === "command" ? commandsLabel : item.option.group)

/** Whether a drag carries files (not text or a link being dragged around the page). */
const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")

const referenceKey = (r: EntityRef) => `${r.kind}:${r.name}`
const attachmentKey = (a: Attachment) => a.id

/** A removed chip, kept for the length of its pop-out and hidden from assistive tech. */
function LeavingChip({ onDone, children }: { onDone: () => void; children: React.ReactNode }) {
  return (
    <span aria-hidden data-leaving style={chipMotion} className="pointer-events-none inline-flex max-w-full cd-pop-out" onAnimationEnd={onDone}>
      {children}
    </span>
  )
}

/**
 * Where a person asks. Mentions (@) attach things in the user's system as chips the agent
 * receives as references, not as text it has to parse; slash commands (/) start
 * a known action. The scope pill says which environment the ask runs
 * against, and turns to a warning when that is production.
 *
 * Enter sends, Shift+Enter breaks a line. While an agent replies the send button
 * becomes Stop. A locked composer says why; an offline one says so. With
 * `onAttach`, files can also be pasted or dropped onto it. `tools` adds your
 * own controls to the toolbar, such as a dictation button. A held composer
 * (`{ kind: "held", reason }`) keeps typing open and says why sending waits.
 * `textareaRef` focuses the box from outside, e.g. after a new project starts.
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
  accept,
  onRemoveAttachment,
  placeholder: placeholderProp,
  label: labelProp,
  tools,
  textareaRef,
  sendShape = "square",
  hints = true,
  className,
}: {
  /** The text in the box. */
  value: string
  /** Called with the new text as the person types. */
  onChange: (value: string) => void
  /** Called on send with the text and the entities mentioned. */
  onSubmit: (value: string, references: EntityRef[]) => void
  /** Shown as Stop while a reply is streaming. */
  onStop?: (() => void) | undefined
  /** ready, sending, streaming, locked (with a reason), held (typing open, sending waits, with a reason) or offline. */
  state?: ComposerState | undefined
  /** Where the next message's work lands; production turns the pill to a warning. */
  scope?: ComposerScope | undefined
  /** Makes the scope pill a button, e.g. to change environment. */
  onScopeClick?: (() => void) | undefined
  /** What @ can insert, grouped under their headings. */
  mentions?: MentionOption[] | undefined
  /** What / can run, only at the start of a message. */
  commands?: SlashCommand[] | undefined
  /** Entities already attached, shown as chips. A chip added after the composer drew pops in; a removed one pops out. */
  references?: EntityRef[] | undefined
  /** Called when a chip is added or removed. */
  onReferencesChange?: ((references: EntityRef[]) => void) | undefined
  /** Files attached, with upload progress or an error, as chips that pop in when added and out when removed. */
  attachments?: Attachment[] | undefined
  /** Shows an attach button; called with the chosen files. */
  onAttach?: ((files: File[]) => void) | undefined
  /**
   * Which files the attach button's picker offers, as for `<input accept>` (e.g. "image/*,.pdf"). Files pasted or
   * dropped arrive as they are, so check types where you upload.
   */
  accept?: string | undefined
  /** Called when a file is removed. */
  onRemoveAttachment?: ((id: string) => void) | undefined
  /** Shown in the empty box; "Ask a question, or describe a change" by default. */
  placeholder?: string | undefined
  /** The accessible name of the text box; "Message" by default. */
  label?: string | undefined
  /** Your own controls in the toolbar, after the attach button: a dictation button, a model picker. */
  tools?: React.ReactNode | undefined
  /**
   * The keyboard hints shown at wide widths ("↵ send · ⇧↵ new line"), naming @ and / only when `mentions` or
   * `commands` are given. Defaults to true; false hides them.
   */
  hints?: boolean | undefined
  /** The text box, to focus it or read its selection from outside. */
  textareaRef?: React.Ref<HTMLTextAreaElement> | undefined
  /** The send button's shape: "square" (the default, rounded corners) or "round". */
  sendShape?: "square" | "round" | undefined
  className?: string | undefined
}) {
  const kindOf = useEntityKinds()
  const t = useStrings("composer", composerStrings)
  const placeholder = placeholderProp ?? t("placeholder")
  const label = labelProp ?? t("label")
  const id = React.useId()
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  React.useImperativeHandle(textareaRef, () => textarea.current as HTMLTextAreaElement, [])
  // Files dragged over the composer: a count of enter/leave pairs, since child elements fire their own.
  const [dragDepth, setDragDepth] = React.useState(0)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [trigger, setTrigger] = React.useState<Trigger | null>(null)
  const [active, setActive] = React.useState(0)

  // Chips added after the composer first drew pop in; chips just removed pop out as inert ghosts, then go. Chips there
  // at first render are drawn still: nothing moves for a state the reader already had.
  const referenceArrived = useArrived(React.useMemo(() => references.map(referenceKey), [references]))
  const attachmentArrived = useArrived(React.useMemo(() => attachments.map(attachmentKey), [attachments]))
  const referenceMotion = useLeaving(references, referenceKey)
  const attachmentMotion = useLeaving(attachments, attachmentKey)

  const held = typeof state === "object" && state.kind === "held" ? state : null
  const locked = typeof state === "object" && state.kind !== "held" ? state : null
  const canAttach = Boolean(onAttach) && !locked
  const busy = state === "sending" || state === "streaming"
  const canSend = !locked && !held && !busy && (value.trim().length > 0 || references.length > 0)

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
    <div
      data-slot="composer"
      data-dragging={dragDepth > 0 || undefined}
      className={cn("@container relative", className)}
      onDragEnter={(e) => {
        if (!canAttach || !hasFiles(e)) return
        e.preventDefault()
        setDragDepth((d) => d + 1)
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        // Always claim a file drag, so a drop that can't attach doesn't open the file in place of the app.
        e.preventDefault()
        e.dataTransfer.dropEffect = canAttach ? "copy" : "none"
      }}
      onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setDragDepth(0)
        if (!canAttach) return
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onAttach!(files)
      }}
    >
      {dragDepth > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-card/90 text-sm font-medium text-accent-text">
          {t("dropFiles")}
        </div>
      )}
      {menuOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label={trigger?.char === "/" ? t("commands") : t("mentions")}
          style={menuMotion}
          className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-float [--cd-overlay-distance:0.25rem] [--cd-side-y:1] cd-overlay"
        >
          {items.map((item, i) => {
            const group = groupOf(item, t("commands"))
            const prev = items[i - 1]
            const header = !prev || groupOf(prev, t("commands")) !== group ? group : null
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
                      <span className="ms-auto truncate text-xs text-muted-foreground">{item.command.description}</span>
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
          "rounded-2xl border bg-card shadow-raised cd-tint focus-within:border-border-strong focus-within:shadow-float",
          locked && "bg-muted shadow-none"
        )}
      >
        {(references.length > 0 || attachments.length > 0 || referenceMotion.leaving.length > 0 || attachmentMotion.leaving.length > 0) && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {references.map((r) => (
              <EntityChip
                key={referenceKey(r)}
                entity={r}
                onRemove={(e) => onReferencesChange?.(references.filter((x) => x !== e))}
                style={chipMotion}
                className={cn(referenceArrived(referenceKey(r)) && "cd-pop")}
              />
            ))}
            {referenceMotion.leaving.map((r) => (
              <LeavingChip key={`leaving:${referenceKey(r)}`} onDone={() => referenceMotion.left(r)}>
                <EntityChip entity={r} />
              </LeavingChip>
            ))}
            {attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} onRemove={onRemoveAttachment} style={chipMotion} className={cn(attachmentArrived(a.id) && "cd-pop")} />
            ))}
            {attachmentMotion.leaving.map((a) => (
              <LeavingChip key={`leaving:${a.id}`} onDone={() => attachmentMotion.left(a)}>
                <AttachmentChip attachment={a} />
              </LeavingChip>
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
          onPaste={(e) => {
            // Pasted files (a screenshot, files copied in Finder) attach; pasted text is typed as usual.
            const files = Array.from(e.clipboardData?.files ?? [])
            if (!files.length || !canAttach) return
            onAttach!(files)
            if (!e.clipboardData.getData("text/plain")) e.preventDefault()
          }}
          aria-controls={menuOpen ? listId : undefined}
          aria-activedescendant={menuOpen ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-describedby={locked ? `${id}-locked` : held ? `${id}-held` : undefined}
          className={cn(
            "block max-h-60 min-h-12 w-full resize-none bg-transparent px-(--cd-row-px,1rem) pt-3 pb-1 text-prose leading-relaxed outline-none [field-sizing:content] placeholder:text-faint-foreground disabled:cursor-not-allowed",
            locked && !value && "min-h-0 h-3 pt-3 pb-0"
          )}
        />
        {locked && (
          <p id={`${id}-locked`} className="flex items-center gap-1.5 px-4 pb-1 text-sm text-muted-foreground">
            {locked.kind === "offline" ? locked.reason ?? t("offline") : locked.reason}
          </p>
        )}
        {held && (
          <p id={`${id}-held`} data-slot="composer-held" className="px-4 pb-1 text-sm text-muted-foreground">
            {held.reason}
          </p>
        )}

        <div className="flex items-center gap-1.5 px-2 pt-1 pb-2">
          {onAttach && (
            <>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={accept}
                tabIndex={-1}
                aria-label={t("attachFiles")}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) onAttach(files)
                  e.target.value = ""
                }}
              />
              <Tooltip>
                <TooltipTrigger render={<button type="button" aria-label={t("attachFiles")} disabled={Boolean(locked)} onClick={() => fileInput.current?.click()} className="flex size-(--cd-control-h-sm,2rem) items-center justify-center rounded-lg text-muted-foreground cd-tint hover:bg-accent hover:text-foreground disabled:opacity-40" />}><Paperclip className="size-4" /></TooltipTrigger>
                <TooltipContent>{t("attachFiles")}</TooltipContent>
              </Tooltip>
            </>
          )}

          {tools}

          {scope && (
            <button
              type="button"
              onClick={onScopeClick}
              disabled={!onScopeClick}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs cd-tint enabled:hover:bg-accent",
                production ? "bg-warning-weak text-warning-text enabled:hover:bg-warning-weak" : "text-muted-foreground"
              )}
            >
              {production ? <TriangleAlert aria-hidden className="size-3 shrink-0" /> : <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />}
              <span className="truncate">
                {scope.environment} · {production ? t("production") : (scope.detail ?? t("nonProduction"))}
              </span>
            </button>
          )}

          {hints && (
            // Only what this composer can do: @ and / are named only when there's something for them to offer.
            <span className="ms-auto hidden text-2xs text-faint-foreground @lg:inline">
              <kbd className="font-sans">↵</kbd> {t("hintSend")} · <kbd className="font-sans">⇧↵</kbd> {t("hintNewLine")}
              {mentions.length > 0 && (
                <>
                  {" · "}
                  <kbd className="font-sans">@</kbd> {t("hintMention")}
                </>
              )}
              {commands.length > 0 && (
                <>
                  {" · "}
                  <kbd className="font-sans">/</kbd> {t("hintCommand")}
                </>
              )}
            </span>
          )}

          {state === "streaming" && onStop ? (
            <button
              type="button"
              aria-label={t("stop")}
              onClick={onStop}
              style={sendMotion}
              className={cn("ms-auto flex size-(--cd-control-h-sm,2rem) items-center justify-center bg-foreground text-background cd-press", hints && "@lg:ms-1", sendShape === "round" ? "rounded-full" : "rounded-lg")}
            >
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={t("send")}
              onClick={submit}
              disabled={!canSend}
              aria-busy={state === "sending"}
              style={sendMotion}
              className={cn("ms-auto flex size-(--cd-control-h-sm,2rem) items-center justify-center bg-primary text-primary-foreground cd-press enabled:hover:bg-primary-hover disabled:opacity-30", hints && "@lg:ms-1", sendShape === "round" ? "rounded-full" : "rounded-lg")}
            >
              {state === "sending" ? <LoaderCircle style={sendingMotion} className="size-4 cd-live-spin" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { Composer }
