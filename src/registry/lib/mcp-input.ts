/* ---------------------------------------------------------------- MCP's shapes (2026-07-28) */

/** A form field's schema, as MCP restricts it: a string, number, boolean or enum. Unknown keys pass through. */
export type McpFieldSchema = {
  /** "string", "number", "integer", "boolean" or "array" (a multi-select enum). */
  type?: string | undefined
  /** A short name for the field. */
  title?: string | undefined
  /** What the field is for, in a sentence. */
  description?: string | undefined
  /** The server's default. Shown as the server's suggestion; Candor never fills it in for the person. */
  default?: string | number | boolean | string[] | undefined
  /** A single-select enum without titles. */
  enum?: string[] | undefined
  /** Display names for `enum`, in the same order (the legacy form, still sent by older servers). */
  enumNames?: string[] | undefined
  /** A single-select enum with titles. */
  oneOf?: { const: string; title?: string | undefined }[] | undefined
  /** A multi-select enum's items: `enum` without titles or `anyOf` with them. */
  items?: { type?: string | undefined; enum?: string[] | undefined; anyOf?: { const: string; title?: string | undefined }[] | undefined } | undefined
  /** At least this many choices, for a multi-select. */
  minItems?: number | undefined
  /** At most this many choices, for a multi-select. */
  maxItems?: number | undefined
  /** At least this many characters. */
  minLength?: number | undefined
  /** At most this many characters. */
  maxLength?: number | undefined
  /** "email", "uri", "date" or "date-time". */
  format?: string | undefined
  /** The smallest number allowed. */
  minimum?: number | undefined
  /** The largest number allowed. */
  maximum?: number | undefined
}

/**
 * MCP's "input required" results (spec 2026-07-28, multi round-trip requests) as Candor data: a server's form becomes
 * questions for ClarifyingQuestions, a plain confirmation or a link to open becomes a two-answer Decision for
 * ApprovalDecision, and the person's answers become the `inputResponses` the client sends when it retries the call.
 * Requests it can't show (sampling, roots, anything newer) stay listed as not supported, never dropped.
 *
 * Pure functions on plain data, so they run in the browser or on the server, with any MCP client.
 *
 * Checked against https://modelcontextprotocol.io/specification/2026-07-28 (basic/patterns/mrtr, client/elicitation
 * and the schema): `resultType: "input_required"`, `inputRequests` as a map keyed by the server's ids, `requestState`
 * echoed back unchanged, and the retry's `inputResponses` keyed the same way. Elicitation results are
 * `{ action: "accept" | "decline" | "cancel", content? }`.
 */

/** An `elicitation/create` request in form mode: a message and a flat schema of primitive fields. */
export type McpElicitFormRequest = {
  method: "elicitation/create"
  params: {
    /** "form", or left out (which means form). */
    mode?: "form" | undefined
    /** Why the server asks, in its own words. */
    message: string
    requestedSchema: { type: "object"; properties: Record<string, McpFieldSchema>; required?: string[] | undefined }
  }
}

/** An `elicitation/create` request in URL mode: a page the person opens outside the client (sign-in, payment). */
export type McpElicitUrlRequest = {
  method: "elicitation/create"
  params: {
    mode: "url"
    /** Why the server asks, in its own words. */
    message: string
    /** The page to open, only once the person agrees. */
    url: string
  }
}

/**
 * A result that asks for more input before the call can finish. At least one of `inputRequests` and `requestState`
 * is present. Values in `inputRequests` are left `unknown`: a server may send kinds this file doesn't know.
 */
export type McpInputRequiredResult = {
  resultType: "input_required"
  /** The server's requests, keyed by its own ids. */
  inputRequests?: Record<string, unknown> | undefined
  /** Opaque to the client: sent back exactly as received, never read or changed. */
  requestState?: string | undefined
  _meta?: Record<string, unknown> | undefined
}

/** The answer to one elicitation, as MCP takes it back. `content` only when accepted in form mode. */
export type McpElicitResult = {
  action: "accept" | "decline" | "cancel"
  content?: Record<string, string | number | boolean | string[]> | undefined
}

/* ---------------------------------------------------------------- Candor's shapes */

/**
 * A question in ClarifyingQuestions' shape (`ClarifyingQuestion`), defined here so this free file needs nothing from
 * a paid one. The question's id is the form field's name.
 */
export type McpQuestion =
  | {
      id: string
      kind: "choice"
      prompt: string
      options: { id: string; label: string; detail?: string | undefined }[]
      multiple?: boolean | undefined
      /** The server's default, marked as a suggestion and never pre-selected. */
      recommended?: string | undefined
      /** A short label shown above the question: the field's title when it also has a description. */
      tag?: string | undefined
      /** Always false: an MCP enum takes only its own values. */
      other?: boolean | undefined
    }
  | {
      id: string
      kind: "text"
      prompt: string
      /** A hint for the expected format, or the server's default, never filled in. */
      placeholder?: string | undefined
      /** The field isn't required: left empty, it isn't sent. */
      optional?: boolean | undefined
      /** A short label shown above the question. */
      tag?: string | undefined
    }

/** A person's answer, in ClarifyingQuestions' shape (`ClarifyingAnswer`). */
export type McpQuestionAnswer = { questionId: string; choice?: string[] | undefined; text?: string | undefined }

/**
 * A two-answer confirmation in ApprovalDecision's shape (`Decision`), defined here so this free file needs nothing
 * from a paid one. The choices' ids are "accept" and "decline", which is what the retry sends.
 */
export type McpDecision = {
  id: string
  question: string
  /** What to decide on, as label and value: the page's host and its full address. */
  facts?: { label: string; value: string }[] | undefined
  /** Accept first, decline second. */
  choices: { id: "accept" | "decline"; label: string; detail?: string | undefined }[]
  state: "open"
}

/** One of the server's requests, as Candor shows it. `key` is the server's id for it. */
export type McpInputItem =
  /**
   * A form: answer it with ClarifyingQuestions. `fields` and `required` are the server's schema, which
   * `mcpInputResponses` checks the answers against.
   */
  | { key: string; kind: "questions"; message: string; questions: McpQuestion[]; fields: Record<string, McpFieldSchema>; required: string[] }
  /** A form with no fields: the server asks to go ahead. Answer it with ApprovalDecision. */
  | { key: string; kind: "confirm"; message: string; decision: McpDecision }
  /**
   * A page to open outside the client. Show the full `url` and its `host` before the person agrees, and open it only
   * once they accept (`decision`). `warnings` say why the address deserves a second look.
   */
  | { key: string; kind: "url"; message: string; url: string; host: string; warnings: string[]; decision: McpDecision }
  /** A request Candor can't show: its method (when it has one) and why. Show it; don't drop it. */
  | { key: string; kind: "unsupported"; method?: string | undefined; reason: string; request: unknown }

/** An input-required result, ready to show. */
export type McpInputView = {
  /** One per request, in the server's order. */
  items: McpInputItem[]
  /** Sent back exactly as received; absent when the server sent none. */
  requestState?: string | undefined
  /** The server's name as your app knows it (passed in), so the person can tell which server asks. */
  server?: string | undefined
  /** The name the server gives itself in the result's `_meta`. Its own claim: show it as such, if at all. */
  serverClaims?: string | undefined
}

/** A person's reply to one item, by its key. */
export type McpInputReply =
  /** A form, answered: the answers from ClarifyingQuestions. */
  | { key: string; action: "accept"; answers?: McpQuestionAnswer[] | undefined }
  /** Declined outright, or dismissed without a choice. */
  | { key: string; action: "decline" | "cancel" }

/** Why an answer can't be sent yet. */
export type McpInputProblem = {
  /** The item's key. */
  key: string
  /** The field, for a form. */
  questionId?: string | undefined
  /** Which rule it broke. */
  code: "unanswered" | "required" | "notAnOption" | "notANumber" | "notAnInteger" | "tooSmall" | "tooLarge" | "tooShort" | "tooLong" | "format" | "tooFew" | "tooMany"
  /** The same in words, from `mcpInputWords`. */
  message: string
}

/** What a retry sends, or why it can't be sent yet. */
export type McpInputResponses =
  | {
      ok: true
      /** The retry's `inputResponses`, keyed by the server's ids. */
      inputResponses: Record<string, unknown>
      /** Keys of requests nothing was sent for (not supported and not answered by your app). The server may ask again. */
      notSent: string[]
    }
  | { ok: false; problems: McpInputProblem[] }

/** The words this file writes into questions, decisions and problems. Pass your own to `mcpInputView` or `mcpInputResponses`. */
export const mcpInputWords = {
  yes: "Yes",
  no: "No",
  /** The extra option on a choice the server doesn't require. */
  skip: "Leave unanswered",
  defaultHint: "Server’s default: {value}",
  formatEmail: "name@example.com",
  formatUri: "https://…",
  formatDate: "YYYY-MM-DD",
  formatDateTime: "YYYY-MM-DDTHH:MM",
  confirm: "Go ahead",
  openPage: "Open the page",
  decline: "Decline",
  host: "Opens",
  address: "Full address",
  punycode: "The address uses an encoded name (xn--), which can imitate another site.",
  notHttps: "The page isn’t on https.",
  badUrl: "The server sent an address that isn’t a valid URL, so it can’t be opened.",
  unsupportedSampling: "The server asks the client to run a model prompt (sampling), which this app doesn’t do here.",
  unsupportedRoots: "The server asks for the client’s folders (roots), which this app doesn’t answer here.",
  unsupportedMethod: "The server asks for something this app can’t show yet: {method}.",
  unsupportedShape: "The server’s request isn’t in a shape this app recognises.",
  unsupportedField: "The form has a field this app can’t show: {field}.",
  unanswered: "Not answered yet.",
  required: "An answer is needed.",
  notAnOption: "That isn’t one of the choices.",
  notANumber: "That isn’t a number.",
  notAnInteger: "That needs to be a whole number.",
  tooSmall: "That needs to be at least {min}.",
  tooLarge: "That needs to be at most {max}.",
  tooShort: "That needs at least {min} characters.",
  tooLong: "That allows at most {max} characters.",
  format: "That doesn’t look like {format}.",
  tooFew: "Choose at least {min}.",
  tooMany: "Choose at most {max}.",
}

/** The words, with any you pass in place of the defaults. */
export type McpInputWords = Partial<typeof mcpInputWords>

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

/** The id of "Leave unanswered" on a choice the server doesn't require; no enum value or "true"/"false" can clash with it. */
const SKIP = "\u0000skip"

/* ---------------------------------------------------------------- result → view */

/**
 * Whether a tools/call (or prompts/get, resources/read) result asks for more input. A result without `resultType`
 * comes from an older server and counts as complete, as the spec says.
 */
export function isMcpInputRequired(result: unknown): result is McpInputRequiredResult {
  return isObject(result) && result.resultType === "input_required"
}

/**
 * An input-required result as items to show: forms as questions, confirmations and links as decisions, and anything
 * else as a visible "not supported". Undefined when the result doesn't ask for input. `server` is your app's own name
 * for the server, which the person should see beside every request.
 */
export function mcpInputView(result: unknown, options: { server?: string | undefined; words?: McpInputWords | undefined } = {}): McpInputView | undefined {
  if (!isMcpInputRequired(result)) return undefined
  const w = { ...mcpInputWords, ...options.words }
  const requests = isObject(result.inputRequests) ? result.inputRequests : {}
  const items = Object.entries(requests).map(([key, request]) => itemOf(key, request, w))
  const info = isObject(result._meta) ? result._meta["io.modelcontextprotocol/serverInfo"] : undefined
  const claims = isObject(info) ? (typeof info.title === "string" && info.title) || (typeof info.name === "string" && info.name) || undefined : undefined
  return {
    items,
    ...(typeof result.requestState === "string" && { requestState: result.requestState }),
    ...(options.server && { server: options.server }),
    ...(claims && { serverClaims: claims }),
  }
}

function itemOf(key: string, request: unknown, w: typeof mcpInputWords): McpInputItem {
  const unsupported = (reason: string, method?: string): McpInputItem => ({ key, kind: "unsupported", ...(method && { method }), reason, request })
  if (!isObject(request) || typeof request.method !== "string") return unsupported(w.unsupportedShape)
  const method = request.method
  if (method === "sampling/createMessage") return unsupported(w.unsupportedSampling, method)
  if (method === "roots/list") return unsupported(w.unsupportedRoots, method)
  if (method !== "elicitation/create") return unsupported(fill(w.unsupportedMethod, { method }), method)
  const params = request.params
  if (!isObject(params) || typeof params.message !== "string") return unsupported(w.unsupportedShape, method)
  const message = params.message
  const mode = params.mode ?? "form"

  if (mode === "url") {
    if (typeof params.url !== "string") return unsupported(w.unsupportedShape, method)
    let parsed: URL
    try {
      parsed = new URL(params.url)
    } catch {
      return unsupported(w.badUrl, method)
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return unsupported(w.badUrl, method)
    const warnings: string[] = []
    if (parsed.hostname.split(".").some((part) => part.startsWith("xn--"))) warnings.push(w.punycode)
    if (parsed.protocol !== "https:") warnings.push(w.notHttps)
    return {
      key,
      kind: "url",
      message,
      url: params.url,
      host: parsed.host,
      warnings,
      decision: {
        id: key,
        question: message,
        facts: [
          { label: w.host, value: parsed.host },
          { label: w.address, value: params.url },
        ],
        choices: [
          { id: "accept", label: w.openPage },
          { id: "decline", label: w.decline },
        ],
        state: "open",
      },
    }
  }

  if (mode !== "form") return unsupported(fill(w.unsupportedMethod, { method: `${method} (${String(mode)})` }), method)
  const schema = params.requestedSchema
  if (!isObject(schema) || (schema.properties !== undefined && !isObject(schema.properties))) return unsupported(w.unsupportedShape, method)
  const properties = (schema.properties ?? {}) as Record<string, unknown>
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((r): r is string => typeof r === "string") : [])
  const names = Object.keys(properties)

  if (!names.length) {
    return {
      key,
      kind: "confirm",
      message,
      decision: {
        id: key,
        question: message,
        choices: [
          { id: "accept", label: w.confirm },
          { id: "decline", label: w.decline },
        ],
        state: "open",
      },
    }
  }

  const questions: McpQuestion[] = []
  for (const name of names) {
    const q = questionOf(name, properties[name], required.has(name), w)
    // One field it can't show makes the whole form unsupported: answering only part of it would send a half-truth.
    if (!q) return unsupported(fill(w.unsupportedField, { field: name }), method)
    questions.push(q)
  }
  return { key, kind: "questions", message, questions, fields: properties as Record<string, McpFieldSchema>, required: [...required] }
}

type Option = { id: string; label: string }

/** A field's options, when it is an enum (single or multiple); undefined otherwise. */
function optionsOf(s: McpFieldSchema): { options: Option[]; multiple: boolean } | undefined {
  const titled = (list: unknown) =>
    Array.isArray(list) && list.every((o) => isObject(o) && typeof o.const === "string")
      ? (list as { const: string; title?: unknown }[]).map((o) => ({ id: o.const, label: typeof o.title === "string" && o.title ? o.title : o.const }))
      : undefined
  const plain = (list: unknown, names?: unknown) =>
    Array.isArray(list) && list.every((v) => typeof v === "string")
      ? (list as string[]).map((v, i) => ({ id: v, label: Array.isArray(names) && typeof names[i] === "string" && names[i] ? (names[i] as string) : v }))
      : undefined
  if (s.type === "array") {
    const items = isObject(s.items) ? s.items : undefined
    const options = items ? (items.anyOf !== undefined ? titled(items.anyOf) : plain(items.enum)) : undefined
    return options ? { options, multiple: true } : undefined
  }
  if (s.type === "string" || s.type === undefined) {
    if (s.oneOf !== undefined) {
      const options = titled(s.oneOf)
      return options ? { options, multiple: false } : undefined
    }
    if (s.enum !== undefined) {
      const options = plain(s.enum, s.enumNames)
      return options ? { options, multiple: false } : undefined
    }
  }
  return undefined
}

const formatHint = (format: unknown, w: typeof mcpInputWords) =>
  format === "email" ? w.formatEmail : format === "uri" ? w.formatUri : format === "date" ? w.formatDate : format === "date-time" ? w.formatDateTime : undefined

function questionOf(name: string, raw: unknown, required: boolean, w: typeof mcpInputWords): McpQuestion | undefined {
  if (!isObject(raw)) return undefined
  const s = raw as McpFieldSchema
  const title = typeof s.title === "string" && s.title ? s.title : undefined
  const description = typeof s.description === "string" && s.description ? s.description : undefined
  const prompt = description ?? title ?? name
  const tag = description && title ? title : undefined
  const head = { id: name, prompt, ...(tag && { tag }) }

  const enumOf = optionsOf(s)
  if (enumOf) {
    const options = !required && !enumOf.multiple ? [...enumOf.options, { id: SKIP, label: w.skip }] : enumOf.options
    const recommended = typeof s.default === "string" && enumOf.options.some((o) => o.id === s.default) ? s.default : undefined
    return { ...head, kind: "choice", options, multiple: enumOf.multiple, other: false, ...(recommended && { recommended }) }
  }
  if (s.type === "boolean") {
    const options = [
      { id: "true", label: w.yes },
      { id: "false", label: w.no },
      ...(required ? [] : [{ id: SKIP, label: w.skip }]),
    ]
    const recommended = typeof s.default === "boolean" ? String(s.default) : undefined
    return { ...head, kind: "choice", options, multiple: false, other: false, ...(recommended && { recommended }) }
  }
  if (s.type === "string" || s.type === "number" || s.type === "integer") {
    const hint = s.default !== undefined && s.default !== null && typeof s.default !== "object" ? fill(w.defaultHint, { value: String(s.default) }) : formatHint(s.format, w)
    return { ...head, kind: "text", ...(hint && { placeholder: hint }), ...(!required && { optional: true }) }
  }
  return undefined
}

/* ---------------------------------------------------------------- answers → retry */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/

function formatOk(format: unknown, text: string) {
  if (format === "email") return EMAIL.test(text)
  if (format === "date") return DATE.test(text) && !Number.isNaN(Date.parse(text))
  if (format === "date-time") return DATE_TIME.test(text) && !Number.isNaN(Date.parse(text))
  if (format === "uri") {
    try {
      return Boolean(new URL(text))
    } catch {
      return false
    }
  }
  return true
}

/**
 * The retry's `inputResponses` for the person's replies, checked against each form's schema first (the spec asks
 * clients to validate). Every form, confirmation and link needs a reply; a form is sent only once every required
 * field has a valid answer. `own` holds responses your app made itself, for requests Candor doesn't show (a sampling
 * or roots answer), keyed by the server's ids; anything left is listed in `notSent`.
 */
export function mcpInputResponses(
  view: McpInputView,
  replies: McpInputReply[],
  options: { own?: Record<string, unknown> | undefined; words?: McpInputWords | undefined } = {}
): McpInputResponses {
  const w = { ...mcpInputWords, ...options.words }
  const problems: McpInputProblem[] = []
  // Keys are the server's ids, so the maps have no prototype: "__proto__" or "toString" is just another key.
  const inputResponses: Record<string, unknown> = Object.create(null)
  const notSent: string[] = []
  const problem = (key: string, code: McpInputProblem["code"], vars: Record<string, string | number> = {}, questionId?: string) =>
    problems.push({ key, ...(questionId !== undefined && { questionId }), code, message: fill(w[code], vars) })

  for (const item of view.items) {
    if (item.kind === "unsupported") {
      if (options.own && Object.hasOwn(options.own, item.key)) inputResponses[item.key] = options.own[item.key]
      else notSent.push(item.key)
      continue
    }
    const reply = replies.find((r) => r.key === item.key)
    if (!reply) {
      problem(item.key, "unanswered")
      continue
    }
    if (reply.action !== "accept") {
      inputResponses[item.key] = { action: reply.action } satisfies McpElicitResult
      continue
    }
    if (item.kind !== "questions") {
      // A confirmation or a link: accepting sends no content. For a link, open it now; the server finds out on retry.
      inputResponses[item.key] = { action: "accept" } satisfies McpElicitResult
      continue
    }
    const content: Record<string, string | number | boolean | string[]> = Object.create(null)
    const before = problems.length
    for (const q of item.questions) {
      const s = item.fields[q.id] ?? {}
      const required = item.required.includes(q.id)
      const a = reply.answers?.find((x) => x.questionId === q.id)
      if (q.kind === "choice") {
        const picked = (a?.choice ?? []).filter((c) => c !== SKIP)
        if (picked.some((c) => !q.options.some((o) => o.id === c))) {
          problem(item.key, "notAnOption", {}, q.id)
          continue
        }
        if (q.multiple) {
          if (!picked.length && (!required || s.minItems === 0)) {
            if (required) content[q.id] = []
            continue
          }
          if (!picked.length && s.minItems === undefined) problem(item.key, "required", {}, q.id)
          else if (typeof s.minItems === "number" && picked.length < s.minItems) problem(item.key, "tooFew", { min: s.minItems }, q.id)
          else if (typeof s.maxItems === "number" && picked.length > s.maxItems) problem(item.key, "tooMany", { max: s.maxItems }, q.id)
          else content[q.id] = picked
          continue
        }
        const value = picked[0]
        if (value === undefined) {
          if (required) problem(item.key, "required", {}, q.id)
          continue
        }
        content[q.id] = s.type === "boolean" ? value === "true" : value
        continue
      }
      const text = a?.text?.trim() ?? ""
      if (!text) {
        if (!q.optional) problem(item.key, "required", {}, q.id)
        continue
      }
      if (s.type === "number" || s.type === "integer") {
        const n = Number(text)
        if (!Number.isFinite(n)) problem(item.key, "notANumber", {}, q.id)
        else if (s.type === "integer" && !Number.isInteger(n)) problem(item.key, "notAnInteger", {}, q.id)
        else if (typeof s.minimum === "number" && n < s.minimum) problem(item.key, "tooSmall", { min: s.minimum }, q.id)
        else if (typeof s.maximum === "number" && n > s.maximum) problem(item.key, "tooLarge", { max: s.maximum }, q.id)
        else content[q.id] = n
        continue
      }
      if (typeof s.minLength === "number" && text.length < s.minLength) problem(item.key, "tooShort", { min: s.minLength }, q.id)
      else if (typeof s.maxLength === "number" && text.length > s.maxLength) problem(item.key, "tooLong", { max: s.maxLength }, q.id)
      else if (!formatOk(s.format, text)) problem(item.key, "format", { format: formatHint(s.format, w) ?? String(s.format) }, q.id)
      else content[q.id] = text
    }
    if (problems.length === before) inputResponses[item.key] = { action: "accept", content } satisfies McpElicitResult
  }
  return problems.length ? { ok: false, problems } : { ok: true, inputResponses, notSent }
}

/**
 * The params for retrying the original request: its own params (name and arguments for tools/call) with
 * `inputResponses` and the result's `requestState` exactly as received. A `requestState` from an earlier round is
 * removed when this result has none, as the spec requires. Send it as a new request with a new JSON-RPC id.
 */
export function mcpRetryParams<P extends Record<string, unknown>>(
  original: P,
  view: Pick<McpInputView, "requestState">,
  inputResponses: Record<string, unknown>
): Omit<P, "inputResponses" | "requestState"> & { inputResponses: Record<string, unknown>; requestState?: string | undefined } {
  const rest: Record<string, unknown> = { ...original }
  delete rest.inputResponses
  delete rest.requestState
  return {
    ...(rest as Omit<P, "inputResponses" | "requestState">),
    inputResponses,
    ...(view.requestState !== undefined && { requestState: view.requestState }),
  }
}
