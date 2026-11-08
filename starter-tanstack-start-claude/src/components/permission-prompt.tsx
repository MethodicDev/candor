import * as React from "react"
import { Info, Pencil, ShieldAlert, ShieldQuestion } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStrings } from "@/components/locale"
import { Payload } from "@/components/payload"
import { Button } from "@/components/ui/button"

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
 * A tool call waiting for a person's go-ahead: what it will do, why it reached them, and the permission mode the
 * run is in. They can edit the input before allowing it and see exactly what they changed; Allow then sends that
 * input, nothing else. "Don't ask again" rules are offered as boxes nobody has ticked, and are kept only if the
 * person ticks them. When the agent is asking questions instead, it shows them as a short form. Words from the
 * request (its title, reason, input) are shown as text, never markup.
 *
 * It sits in the thread, with no backdrop and nothing that dismisses it: the only ways out are Allow and Deny, and
 * nothing else is ever counted as a denial. While the decision waits, its shield pulses slowly; a press on inert
 * space outside it (the gesture that would dismiss a dialog) nudges it instead, so the person sees it is still
 * waiting. Both stop once the answer is being sent.
 */
function PermissionPrompt({
  request,
  mode,
  suggestions,
  editable = false,
  onAllow,
  onDeny,
  busy = false,
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
  className?: string | undefined
}) {
  // Keyed by the request, so an edit, a ticked rule or an answer never carries over to the next request.
  return <PromptBody key={request.id} {...{ request, mode, suggestions, editable: editable && request.editable !== false, onAllow, onDeny, busy, className }} />
}

function PromptBody({
  request,
  mode,
  suggestions,
  editable,
  onAllow,
  onDeny,
  busy,
  className,
}: {
  request: PermissionRequest
  mode?: string | undefined
  suggestions?: PermissionSuggestion[] | undefined
  editable: boolean
  onAllow: (answer: PermissionAnswer) => void
  onDeny: () => void
  busy: boolean
  className?: string | undefined
}) {
  const t = useStrings("permissionPrompt", permissionPromptStrings)
  const id = React.useId()
  const original = React.useMemo(() => json(request.input ?? {}), [request.input])
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(original)
  const [ticked, setTicked] = React.useState<number[]>([])
  const [answers, setAnswers] = React.useState<Record<string, { choice: string[]; text: string; other: boolean }>>({})
  const edited = editing ? parseObject(draft) : null
  const proposed = parseObject(original)
  const changedKeys = edited && proposed ? [...new Set([...Object.keys(proposed), ...Object.keys(edited)])].filter((k) => JSON.stringify(proposed[k]) !== JSON.stringify(edited[k])) : []
  const invalid = editing && !edited
  const title = request.title ?? t("fallbackTitle", { tool: request.tool })
  const questions = request.questions

  // A request that grants more than it looks opens on Deny, so a stray Enter can't allow it.
  const denyRef = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (request.defaultToNo) denyRef.current?.focus()
  }, [request.id, request.defaultToNo])

  // A press on inert space outside the prompt, while it waits, nudges it rather than dismissing anything.
  const section = React.useRef<HTMLElement>(null)
  const [nudged, setNudged] = React.useState(false)
  React.useEffect(() => {
    if (busy) return
    const onPress = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target || section.current?.contains(target)) return
      if (target.closest(INTERACTIVE)) return
      setNudged(true)
    }
    document.addEventListener("pointerdown", onPress)
    return () => document.removeEventListener("pointerdown", onPress)
  }, [busy])
  React.useEffect(() => {
    if (!nudged) return
    const timer = window.setTimeout(() => setNudged(false), 1000)
    return () => window.clearTimeout(timer)
  }, [nudged])

  const word = (s: PermissionSuggestion) => {
    const key = { allow: "ruleAllow", deny: "ruleDeny", ask: "ruleAsk", remove: "ruleRemove", mode: "setMode", directories: "directories", other: "other" }[s.action] as keyof typeof permissionPromptStrings
    const scope = s.scope && ({ session: "scopeSession", local: "scopeLocal", project: "scopeProject", user: "scopeUser" } as Record<string, keyof typeof permissionPromptStrings>)[s.scope]
    const what = s.action === "mode" && modeKeys[s.what] ? t(modeKeys[s.what]!) : s.what
    return { text: t(key, { what, mode: what }), scope: scope ? t(scope) : s.scope }
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
      aria-label={t("label", { title: questions ? t("questions") : title })}
      className={cn("overflow-hidden rounded-xl border border-warning/50 bg-card text-sm shadow-xs [--cd-attention-color:var(--warning)]", nudged && "animate-nudge", className)}
    >
      <header className="flex items-start gap-2.5 bg-warning-weak/50 px-3.5 py-2.5">
        <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-warning-text", !busy && "animate-attention-wait")}>
          <ShieldQuestion className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{questions ? t("questions") : title}</h3>
          {request.description && <p className="mt-0.5 text-muted-foreground">{request.description}</p>}
        </div>
        <code className="shrink-0 font-mono text-2xs text-muted-foreground">{request.tool}</code>
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
          {request.blockedPath && <li>{t("blockedPath", { path: request.blockedPath })}</li>}
          {request.agentId && <li>{t("subagent")}</li>}
          {request.mcpServer && <li>{t("server", { name: request.mcpServer.name, source: request.mcpServer.source })}</li>}
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
                  {q.prompt}
                </legend>
                {q.options.map((o) => (
                  <label key={o.id} className="flex min-h-6 items-start gap-2">
                    <input type={q.multiple ? "checkbox" : "radio"} name={`${id}-${q.id}`} checked={a?.choice.includes(o.id) ?? false} onChange={() => choose(q, o.id)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                    <span>
                      {o.label}
                      {o.detail && <span className="block text-xs text-muted-foreground">{o.detail}</span>}
                    </span>
                  </label>
                ))}
                {q.other && (
                  <>
                    <label className="flex min-h-6 items-start gap-2">
                      <input type={q.multiple ? "checkbox" : "radio"} name={`${id}-${q.id}`} checked={a?.other ?? false} onChange={() => toggleOther(q)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                      <span>{t("otherOption")}</span>
                    </label>
                    {a?.other && (
                      <textarea
                        aria-label={t("otherLabel", { question: q.prompt })}
                        rows={2}
                        value={a.text}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id]!, text: e.target.value } }))}
                        className="ms-6 block resize-none rounded-md border border-input bg-card px-2.5 py-1.5 text-sm outline-none [field-sizing:content] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
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
                className="block w-full resize-y rounded-md border border-input bg-card px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive"
              />
              <div id={`${id}-changes`} role="status" className="text-xs">
                {invalid ? (
                  <p className="text-destructive-text">{t("editInvalid")}</p>
                ) : changedKeys.length ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground">{t("changed")}</p>
                    <ul className="flex flex-col gap-1">
                      {changedKeys.map((k) => (
                        <li key={k} className="grid gap-0.5 font-mono">
                          <span className="text-muted-foreground">{k}</span>
                          {k in proposed! && <span className="rounded-xs bg-destructive-weak/60 px-1 line-through">{json(proposed![k])}</span>}
                          {k in edited! && <span className="rounded-xs bg-success-weak/70 px-1">{json(edited![k])}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t("unchanged")}</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="self-start" onClick={() => (setEditing(false), setDraft(original))}>
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
                  <label key={i} className="flex min-h-6 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={ticked.includes(i)}
                      onChange={(e) => setTicked((prev) => (e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)))}
                      className="mt-0.5 size-4 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="font-mono text-xs">{w.text}</span>
                      {w.scope && <span className="text-muted-foreground"> · {w.scope}</span>}
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
        <Button ref={denyRef} size="sm" variant="outline" onClick={onDeny} disabled={busy}>
          {t("deny")}
        </Button>
        <Button size="sm" onClick={allow} disabled={busy || invalid || (questions ? !questions.every(answered) : false)} aria-busy={busy}>
          {questions ? t("answer") : edited && changedKeys.length ? t("allowEdited") : t("allow")}
        </Button>
      </footer>
    </section>
  )
}

export { PermissionPrompt }
