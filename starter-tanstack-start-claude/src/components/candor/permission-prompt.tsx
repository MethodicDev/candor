import * as React from "react"
import { Info, Pencil, ShieldAlert, ShieldQuestion } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFormat, place, useStrings } from "@/components/candor/locale"
import { escapeBidiJson, neutralizeBidi } from "@/lib/candor/bidi"
import { Payload } from "@/components/candor/payload"
import { Button } from "@/components/candor/ui/button"
import { Locked } from "@/components/candor/locked"
import { motion } from "@/lib/candor/motion"

/** How long the animations running on `el` take in all, in milliseconds (the longest of duration × iteration count, capped at 6 s); undefined when it can't be read. */
function animationMs(el: Element | null): number | undefined {
  if (!el || typeof getComputedStyle === "undefined") return undefined
  const style = getComputedStyle(el)
  const durations = style.animationDuration.split(",").map((t) => (t.trim().endsWith("ms") ? Number.parseFloat(t) : Number.parseFloat(t) * 1000))
  const counts = style.animationIterationCount.split(",").map((c) => (c.trim() === "infinite" ? Number.POSITIVE_INFINITY : Number.parseFloat(c)))
  const totals = durations.map((d, i) => d * (counts[i % counts.length] || 1)).filter((n) => Number.isFinite(n) || n === Number.POSITIVE_INFINITY)
  return totals.length ? Math.min(6000, Math.max(...totals)) : undefined
}

/** Three pulses of 1.6 s while the decision waits (4.8 s, then still), shortened from 2.2's 7.2 s. */
const waitingMotion = motion("permission-prompt", "waiting", "attention", { dur: 1600, amp: "3" })
/** A press around the prompt instead of on it: one ring, and the refuse shake under expressive. */
const nudgeMotion = { ...motion("permission-prompt", "nudge", "refuse"), ...motion("permission-prompt", "nudge", "attention") }

/** PermissionPrompt's fixed words; override them under `permissionPrompt` in LocaleProvider's `strings`. */
export const permissionPromptStrings = {
  label: "Permission request: {title}",
  fallbackTitle: "The agent wants to use {tool}",
  why: "Why you’re asked",
  mode: "Permission mode",
  modeDefault: "Ask before acting",
  modeAcceptEdits: "Accept file edits",
  modePlan: "Plan only",
  modeAuto: "Automatic, by a classifier",
  modeDontAsk: "Don’t ask; deny what isn’t allowed",
  modeBypassPermissions: "Allow everything",
  blockedPath: "Path outside what’s allowed: {path}",
  subagent: "A subagent asked.",
  server: "From the tool server “{name}”, configured in {source}.",
  input: "What it will run with",
  edit: "Edit before allowing",
  editLabel: "Input, as JSON",
  editInvalid: "That isn’t a JSON object, so it can’t be used.",
  changed: "You changed",
  unchanged: "Nothing changed yet.",
  cancelEdit: "Use the original",
  remember: "Don’t ask again for",
  rememberHint: "Optional. Nothing is remembered unless you tick it.",
  ruleAllow: "Allow {what}",
  ruleDeny: "Always deny {what}",
  ruleAsk: "Always ask for {what}",
  ruleRemove: "Stop applying the rule for {what}",
  setMode: "Switch to: {mode}",
  warnBypassPermissions: "After this, nothing is checked: the agent can run any command and change or delete any file it can reach.",
  warnAuto: "After this, a classifier allows or blocks each action instead of you.",
  directories: "Access to {what}",
  other: "A permission change: {what}",
  scopeSession: "for this session",
  scopeLocal: "in this project, on this computer",
  scopeProject: "in this project, for everyone on it",
  scopeUser: "for you, in every project",
  allow: "Allow",
  allowEdited: "Allow as edited",
  deny: "Deny",
  /** Why Allow and Deny can't be pressed while the answer is being sent. */
  lockedBusy: "Sending your answer",
  /** Why Allow can't be pressed while the edited input isn't a JSON object. */
  lockedInvalid: "Fix the edited input first",
  /** Why the answer can't be sent until every question has one. */
  lockedUnanswered: "Answer every question first",
  answer: "Send answers",
  otherOption: "Other",
  otherLabel: "Your own answer to: {question}",
  questions: "The agent has questions",
}

/** One "don't ask again" choice, in the plain shape PermissionPrompt shows. claudeSuggestions builds them from the SDK's. */
export type PermissionSuggestion = {
  /** What the rule does. */
  action: "allow" | "deny" | "ask" | "remove" | "mode" | "directories" | "other"
  /** What it covers, as the source writes it: `Bash(npm test:*)`, a mode's name, directories. Shown as code. */
  what: string
  /** Where it's kept: "session", "local" (this project, this computer), "project" (shared), "user", or the source's own word. */
  scope?: string | undefined
}

/** A question the agent asks through the prompt: pick one or more labels, or answer in its own words. */
export type PermissionQuestion = {
  id: string
  prompt: string
  tag?: string | undefined
  options: { id: string; label: string; detail?: string | undefined }[]
  multiple: boolean
  other?: boolean | undefined
}

/** A tool call waiting on a person, in the shape the adapters give (ClaudeApproval fits it). */
export type PermissionRequest = {
  id: string
  tool: string
  input: unknown
  /** The source's own sentence for the request: "Claude wants to run npm test". */
  title?: string | undefined
  description?: string | undefined
  /** Why it reached a person (no rule allowed it, a safety check, a path outside the project). */
  reason?: string | undefined
  blockedPath?: string | undefined
  /** Put the focus on Deny: the request grants more than it looks. */
  defaultToNo?: boolean | undefined
  /** Set when a subagent asked. */
  agentId?: string | undefined
  mcpServer?: { name: string; source: string } | undefined
  /** The questions, when the request is the agent asking rather than a tool to allow. */
  questions?: PermissionQuestion[] | undefined
  /** False when the server won't accept an edited input for this call: no Edit is offered, whatever `editable` says. */
  editable?: boolean | undefined
}

export type PermissionAnswer = {
  /** The input as edited, when the person changed it. */
  updatedInput?: Record<string, unknown> | undefined
  /** The suggestions the person ticked, by index. */
  alwaysAllow?: number[] | undefined
  /** Answers to `questions`. */
  answers?: { questionId: string; choice?: string[] | undefined; text?: string | undefined }[] | undefined
}

/**
 * What PermissionPrompt gives `jsonEditor`, the field the person edits the input in. It is a part of CodeEditor's own
 * props, so a Pro app can pass `CodeEditor` as it is; any component that takes them will do.
 */
export type PermissionJsonEditorProps = {
  /** The input as JSON text, as the person has it. */
  value: string
  /** Called with the new text on each edit. */
  onValueChange: (value: string) => void
  /** The text's language, for its colours: always "json". */
  language: string
  /** The field's name, from the prompt's strings ("Input, as JSON"). */
  label: string
  /** While the text isn't a JSON object, what's wrong, in the prompt's words. The field shows it and is marked invalid. */
  error?: { message: string; line?: number | undefined } | undefined
  /** The most lines tall it grows before it scrolls. */
  maxLines?: number | undefined
}

/**
 * The request's words as they're shown. Its title, reason, questions and the rest come from the agent or its tools, so
 * no bidi control character reorders them. The input itself is left exact: it's what Allow sends, and Payload marks
 * the controls where it shows it.
 */
const shownRequest = (request: PermissionRequest): PermissionRequest => ({
  ...request,
  tool: neutralizeBidi(request.tool),
  title: neutralizeBidi(request.title),
  description: neutralizeBidi(request.description),
  reason: neutralizeBidi(request.reason),
  blockedPath: neutralizeBidi(request.blockedPath),
  mcpServer: request.mcpServer && { name: neutralizeBidi(request.mcpServer.name), source: neutralizeBidi(request.mcpServer.source) },
  questions: request.questions?.map((q) => ({
    ...q,
    prompt: neutralizeBidi(q.prompt),
    tag: neutralizeBidi(q.tag),
    options: q.options.map((o) => ({ ...o, label: neutralizeBidi(o.label), detail: neutralizeBidi(o.detail) })),
  })),
})

const modeKeys: Record<string, keyof typeof permissionPromptStrings> = {
  default: "modeDefault",
  acceptEdits: "modeAcceptEdits",
  plan: "modePlan",
  auto: "modeAuto",
  dontAsk: "modeDontAsk",
  bypassPermissions: "modeBypassPermissions",
}

const json = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2))


/** What a press lands on when the person is doing something else, rather than clicking around the prompt. */
const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="textbox"], [role="slider"], [tabindex]:not([tabindex="-1"])'

/** Parses edited JSON into an object, or null when it isn't one. */
function parseObject(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * A tool call an agent asks to make, waiting for a person to approve or deny it before it runs: what it will do, why
 * it reached them, and the permission mode the run is in. They can edit the input before allowing it and see exactly what they changed; Allow then sends that
 * input, nothing else. "Don't ask again" rules are offered as boxes nobody has ticked, and are kept only if the
 * person ticks them. When the agent is asking questions instead, it shows them as a short form. Words from the
 * request (its title, reason, input) are shown as text, never markup.
 *
 * It sits in the thread, with no backdrop and nothing that dismisses it: the only ways out are Allow and Deny, and
 * nothing else is ever counted as a denial. While the decision waits, its shield pulses slowly; a press on inert
 * space outside it (the gesture that would dismiss a dialog) nudges it instead, so the person sees it is still
 * waiting. Both stop once the answer is being sent.
 *
 * Its heading is an `<h2>` unless `headingLevel` says otherwise; it reads no `HeadingScope`, so inside a dialog (whose
 * title is the `<h2>`) give it `headingLevel={3}`.
 *
 * @motion attention:waiting While the decision waits, a ring pulses out from the shield three times and then is still.
 * It stops once the answer is being sent, and under calm it is one ring that fades.
 * @motion attention:nudge A press on inert space outside the prompt rings it once, so the person sees it is still waiting.
 * @motion refuse:nudge Under expressive the same press also shakes the prompt a little; nothing is dismissed.
 */
function PermissionPrompt({
  request,
  mode,
  suggestions,
  editable = false,
  onAllow,
  onDeny,
  busy = false,
  headingLevel = 2,
  jsonEditor,
  className,
}: {
  /** The waiting request. */
  request: PermissionRequest
  /** The run's permission mode, as the SDK names it ("default", "acceptEdits", "plan", "auto"…). Left out, it isn't shown. */
  mode?: string | undefined
  /** "Don't ask again" rules to offer. None is ticked. */
  suggestions?: PermissionSuggestion[] | undefined
  /** Let the person edit the input as JSON before allowing it. */
  editable?: boolean | undefined
  /** Called with the edited input, the ticked rules or the answers. */
  onAllow: (answer: PermissionAnswer) => void
  /** Called when the person denies it (or won't answer the questions). */
  onDeny: () => void
  /** The answer is being sent: both buttons wait, and the waiting pulse stops. */
  busy?: boolean | undefined
  /**
   * The level of the prompt's heading, to fit under the page's own headings without skipping a level. Defaults to 2
   * (3 before 5.0.0), right below the page's `<h1>`; pass 3 when the prompt sits under a section's `<h2>`. It reads
   * no `HeadingScope`, so in a dialog, whose title is an `<h2>`, pass 3 as well:
   *
   * ```tsx
   * <DialogContent>
   *   <DialogTitle>Approve a tool call</DialogTitle>
   *   <PermissionPrompt request={request} headingLevel={3} onAllow={allow} onDeny={deny} />
   * </DialogContent>
   * ```
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 | undefined
  /**
   * The field the input is edited in, when `editable`. Left out, it is a plain text field. Pass `CodeEditor` (Pro) for
   * line numbers, the JSON's colours, Tab to indent and the error read out with the field. The input is shown through
   * Payload either way until the person chooses to edit it.
   */
  jsonEditor?: React.ComponentType<PermissionJsonEditorProps> | undefined
  className?: string | undefined
}) {
  // Keyed by the request, so an edit, a ticked rule or an answer never carries over to the next request.
  return <PromptBody key={request.id} {...{ request, mode, suggestions, editable: editable && request.editable !== false, onAllow, onDeny, busy, headingLevel, jsonEditor, className }} />
}

function PromptBody({
  request: given,
  mode,
  suggestions,
  editable,
  onAllow,
  onDeny,
  busy,
  headingLevel,
  jsonEditor: JsonEditor,
  className,
}: {
  request: PermissionRequest
  mode?: string | undefined
  suggestions?: PermissionSuggestion[] | undefined
  editable: boolean
  onAllow: (answer: PermissionAnswer) => void
  onDeny: () => void
  busy: boolean
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6
  jsonEditor?: React.ComponentType<PermissionJsonEditorProps> | undefined
  className?: string | undefined
}) {
  const t = useStrings("permissionPrompt", permissionPromptStrings)
  // Between a "don't ask again" rule and where it's kept ("Allow Bash(ls:*) · for this session").
  const { separator } = useFormat()
  const request = React.useMemo(() => shownRequest(given), [given])
  const id = React.useId()
  const original = React.useMemo(() => json(request.input ?? {}), [request.input])
  // The field shows each control escaped (`\u202E`): visible, and it parses back to the input exactly.
  const escaped = escapeBidiJson(original)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(escaped)
  const [ticked, setTicked] = React.useState<number[]>([])
  const [answers, setAnswers] = React.useState<Record<string, { choice: string[]; text: string; other: boolean }>>({})
  const edited = editing ? parseObject(draft) : null
  const proposed = parseObject(original)
  const changedKeys = edited && proposed ? [...new Set([...Object.keys(proposed), ...Object.keys(edited)])].filter((k) => JSON.stringify(proposed[k]) !== JSON.stringify(edited[k])) : []
  const invalid = editing && !edited
  const title = request.title ?? t("fallbackTitle", { tool: request.tool })
  const questions = request.questions
  const Heading = `h${headingLevel}` as const

  // A request that grants more than it looks opens on Deny, so a stray Enter can't allow it.
  const denyRef = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (request.defaultToNo) denyRef.current?.focus()
  // oxlint-disable-next-line react/exhaustive-effect-dependencies -- request.id re-runs the focus for the next request even when defaultToNo is the same
  }, [request.id, request.defaultToNo])

  // A press on inert space outside every prompt, while it waits, nudges it rather than dismissing anything.
  const section = React.useRef<HTMLElement>(null)
  const [nudged, setNudged] = React.useState(false)
  const ended = React.useRef(new Set<string>())
  React.useEffect(() => {
    if (busy) return
    const onPress = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target || section.current?.contains(target)) return
      // A press anywhere inside another prompt is that prompt's business, not an outside press for this one.
      if (target.closest('[data-slot="permission-prompt"]')) return
      if (target.closest(INTERACTIVE)) return
      setNudged(true)
    }
    document.addEventListener("pointerdown", onPress)
    return () => document.removeEventListener("pointerdown", onPress)
  }, [busy])
  React.useEffect(() => {
    if (!nudged) return
    // The nudge ends when its animations do (onAnimationEnd on the section). This timer is only the fallback for when
    // none runs (motion off, or no Candor CSS), set from the duration and count the page resolved, so a brand's longer
    // ring or shake isn't cut short.
    ended.current = new Set()
    const timer = window.setTimeout(() => setNudged(false), (animationMs(section.current) ?? 1200) + 100)
    return () => window.clearTimeout(timer)
  }, [nudged])

  const word = (s: PermissionSuggestion) => {
    const key = { allow: "ruleAllow", deny: "ruleDeny", ask: "ruleAsk", remove: "ruleRemove", mode: "setMode", directories: "directories", other: "other" }[s.action] as keyof typeof permissionPromptStrings
    const scope = s.scope && ({ session: "scopeSession", local: "scopeLocal", project: "scopeProject", user: "scopeUser" } as Record<string, keyof typeof permissionPromptStrings>)[s.scope]
    const what = s.action === "mode" && modeKeys[s.what] ? t(modeKeys[s.what]!) : neutralizeBidi(s.what)
    return { text: t(key, { what, mode: what }), scope: scope ? t(scope) : neutralizeBidi(s.scope) }
  }

  const answered = (q: PermissionQuestion) => {
    const a = answers[q.id]
    return Boolean(a && (a.choice.length || (a.other && a.text.trim())))
  }
  const choose = (q: PermissionQuestion, option: string) =>
    setAnswers((prev) => {
      const a = prev[q.id] ?? { choice: [], text: "", other: false }
      const choice = q.multiple ? (a.choice.includes(option) ? a.choice.filter((c) => c !== option) : [...a.choice, option]) : [option]
      return { ...prev, [q.id]: { ...a, choice, other: q.multiple ? a.other : false } }
    })
  const toggleOther = (q: PermissionQuestion) =>
    setAnswers((prev) => {
      const a = prev[q.id] ?? { choice: [], text: "", other: false }
      return { ...prev, [q.id]: { ...a, other: !a.other, choice: q.multiple || a.other ? a.choice : [] } }
    })

  const allow = () => {
    if (busy) return
    if (questions) {
      if (!questions.every(answered)) return
      onAllow({ answers: questions.map((q) => ({ questionId: q.id, choice: answers[q.id]?.choice, text: answers[q.id]?.other ? answers[q.id]?.text.trim() : undefined })) })
      return
    }
    if (invalid) return
    onAllow({ ...(edited && changedKeys.length && { updatedInput: edited }), ...(ticked.length && { alwaysAllow: ticked }) })
  }

  return (
    <section
      ref={section}
      data-slot="permission-prompt"
      data-waiting={busy ? undefined : ""}
      data-nudged={nudged ? "" : undefined}
      onAnimationEnd={(e) => {
        // The nudge runs two animations (the shake and the ring) and ends with the last of them. A child's own
        // animation, or one that isn't Candor's, doesn't end it.
        if (e.target !== e.currentTarget || !e.animationName.startsWith("cd-")) return
        ended.current.add(e.animationName)
        const running = getComputedStyle(e.currentTarget).animationName.split(",").map((n) => n.trim()).filter((n) => n.startsWith("cd-"))
        if (running.every((n) => ended.current.has(n))) setNudged(false)
      }}
      aria-label={t("label", { title: questions ? t("questions") : title })}
      style={nudgeMotion}
      className={cn("overflow-hidden rounded-xl border border-warning/50 bg-card text-sm shadow-xs [--cd-attention-color:var(--cd-warning)]", nudged && "cd-nudge", className)}
    >
      <header className="flex items-start gap-2.5 bg-warning-weak/50 px-3.5 py-2.5">
        <span aria-hidden style={waitingMotion} className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-warning-text", !busy && "cd-attention")}>
          <ShieldQuestion className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Heading className="font-semibold leading-snug">{questions ? t("questions") : title}</Heading>
          {request.description && <p className="mt-0.5 text-muted-foreground">{request.description}</p>}
        </div>
        <code className="shrink-0 font-mono text-2xs text-muted-foreground">
          <bdi>{request.tool}</bdi>
        </code>
      </header>

      <dl className="flex flex-col gap-1.5 px-3.5 pt-2.5 text-sm">
        {request.reason && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{t("why")}</dt>
            <dd className="min-w-0">{request.reason}</dd>
          </div>
        )}
        {mode && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{t("mode")}</dt>
            <dd data-slot="permission-mode">{modeKeys[mode] ? t(modeKeys[mode]!) : <code className="font-mono text-xs">{mode}</code>}</dd>
          </div>
        )}
      </dl>
      {(request.blockedPath || request.agentId || request.mcpServer) && (
        <ul className="mt-1.5 flex flex-col gap-0.5 px-3.5 text-xs text-muted-foreground">
          {request.blockedPath && <li>{place(t("blockedPath", { path: "{path}" }), { path: <bdi>{request.blockedPath}</bdi> })}</li>}
          {request.agentId && <li>{t("subagent")}</li>}
          {request.mcpServer && <li>{place(t("server", { name: "{name}", source: "{source}" }), { name: <bdi>{request.mcpServer.name}</bdi>, source: <bdi>{request.mcpServer.source}</bdi> })}</li>}
        </ul>
      )}

      {questions ? (
        <div className="flex flex-col gap-4 px-3.5 py-3">
          {questions.map((q) => {
            const a = answers[q.id]
            return (
              <fieldset key={q.id} className="flex flex-col gap-1.5">
                <legend className="mb-1 font-medium">
                  {q.tag && <span className="me-1.5 rounded-xs bg-muted px-1 text-2xs font-medium text-muted-foreground">{q.tag}</span>}
                  <bdi>{q.prompt}</bdi>
                </legend>
                {q.options.map((o) => (
                  <label key={o.id} className="flex min-h-(--cd-control-h-2xs,1.5rem) items-start gap-(--cd-control-gap,0.5rem)">
                    <input type={q.multiple ? "checkbox" : "radio"} name={`${id}-${q.id}`} checked={a?.choice.includes(o.id) ?? false} onChange={() => choose(q, o.id)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                    <span>
                      <bdi>{o.label}</bdi>
                      {o.detail && <span className="block text-xs text-muted-foreground">{o.detail}</span>}
                    </span>
                  </label>
                ))}
                {q.other && (
                  <>
                    <label className="flex min-h-(--cd-control-h-2xs,1.5rem) items-start gap-(--cd-control-gap,0.5rem)">
                      <input type={q.multiple ? "checkbox" : "radio"} name={`${id}-${q.id}`} checked={a?.other ?? false} onChange={() => toggleOther(q)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                      <span>{t("otherOption")}</span>
                    </label>
                    {a?.other && (
                      <textarea
                        aria-label={t("otherLabel", { question: q.prompt })}
                        rows={2}
                        value={a.text}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id]!, text: e.target.value } }))}
                        className="ms-6 block resize-none rounded-md border border-input bg-card px-(--cd-control-px-sm,0.625rem) py-(--cd-item-py,0.375rem) text-sm outline-none [field-sizing:content] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                      />
                    )}
                  </>
                )}
              </fieldset>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-3.5 py-3">
          {editing ? (
            <>
              {JsonEditor ? (
                // The app's editor names itself from the label and shows the error, read out with the field.
                <JsonEditor value={draft} onValueChange={setDraft} language="json" label={t("editLabel")} error={invalid ? { message: t("editInvalid") } : undefined} maxLines={12} />
              ) : (
                <>
                  <label htmlFor={`${id}-edit`} className="text-xs font-medium text-muted-foreground">
                    {t("editLabel")}
                  </label>
                  <textarea
                    id={`${id}-edit`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    rows={Math.min(12, draft.split("\n").length + 1)}
                    aria-invalid={invalid || undefined}
                    aria-describedby={`${id}-changes`}
                    className="block w-full resize-y rounded-md border border-input bg-card px-(--cd-control-px-sm,0.625rem) py-(--cd-item-py,0.375rem) font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive"
                  />
                </>
              )}
              <div id={`${id}-changes`} role="status" className="text-xs">
                {invalid ? (
                  // The app's editor shows this itself, with the field.
                  JsonEditor ? null : (
                    <p className="text-destructive-text">{t("editInvalid")}</p>
                  )
                ) : changedKeys.length ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground">{t("changed")}</p>
                    <ul className="flex flex-col gap-1">
                      {changedKeys.map((k) => (
                        <li key={k} className="grid gap-0.5 font-mono">
                          <bdi className="text-muted-foreground">{neutralizeBidi(k)}</bdi>
                          {k in proposed! && <bdi className="rounded-xs bg-destructive-weak/60 px-1 line-through">{neutralizeBidi(json(proposed![k]))}</bdi>}
                          {k in edited! && <bdi className="rounded-xs bg-success-weak/70 px-1">{neutralizeBidi(json(edited![k]))}</bdi>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t("unchanged")}</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="self-start" onClick={() => (setEditing(false), setDraft(escaped))}>
                {t("cancelEdit")}
              </Button>
            </>
          ) : (
            <>
              <Payload language="json" title={t("input")} text={original} />
              {editable && proposed && (
                <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden /> {t("edit")}
                </Button>
              )}
            </>
          )}

          {suggestions && suggestions.length > 0 && (
            <fieldset className="mt-1 flex flex-col gap-1 rounded-lg border border-dashed px-3 py-2">
              <legend className="px-1 text-xs font-medium">{t("remember")}</legend>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info aria-hidden className="size-3" /> {t("rememberHint")}
              </p>
              {suggestions.map((s, i) => {
                const w = word(s)
                return (
                  <label key={i} className="flex min-h-(--cd-control-h-2xs,1.5rem) items-start gap-(--cd-control-gap,0.5rem)">
                    <input
                      type="checkbox"
                      checked={ticked.includes(i)}
                      onChange={(e) => setTicked((prev) => (e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)))}
                      className="mt-0.5 size-4 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="font-mono text-xs">{w.text}</span>
                      {w.scope && (
                        <span className="text-muted-foreground">
                          {separator}
                          {w.scope}
                        </span>
                      )}
                      {s.action === "mode" && (s.what === "bypassPermissions" || s.what === "auto") && (
                        <span className="mt-0.5 flex items-start gap-1 text-xs text-warning-text">
                          <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                          {t(s.what === "auto" ? "warnAuto" : "warnBypassPermissions")}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}
        </div>
      )}

      <footer className="flex flex-wrap justify-end gap-2 border-t bg-sunken px-3.5 py-2">
        <Locked reason={busy ? t("lockedBusy") : undefined}>
          <Button ref={denyRef} size="sm" variant="outline" onClick={onDeny}>
            {t("deny")}
          </Button>
        </Locked>
        <Locked reason={busy ? t("lockedBusy") : invalid ? t("lockedInvalid") : questions && !questions.every(answered) ? t("lockedUnanswered") : undefined}>
          <Button size="sm" onClick={allow} aria-busy={busy}>
            {questions ? t("answer") : edited && changedKeys.length ? t("allowEdited") : t("allow")}
          </Button>
        </Locked>
      </footer>
    </section>
  )
}

export { PermissionPrompt }
