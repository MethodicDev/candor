export type TokenType = "keyword" | "string" | "number" | "comment" | "function" | "property" | "type" | "tag" | "variable" | "operator" | "plain"

export type Token = { type: TokenType; text: string }

/**
 * A small syntax highlighter for code an agent shows: it splits text into typed tokens (keyword, string, comment…),
 * and Payload renders each as a span. The output is text, never HTML, so nothing in the code can run or inject markup.
 * It covers the languages agents show most (JS/TS, Python, SQL, JSON, shell, YAML, CSS, HTML/XML, Go, Rust, Java, C)
 * in a few kilobytes; anything else comes back as one plain token.
 */

type Grammar = {
  line?: string[] | undefined
  block?: [string, string][] | undefined
  strings: string[]
  keywords: Set<string>
  /** SQL: keywords match in any case. */
  caseless?: boolean | undefined
  /** "key": in JSON, key: in YAML. */
  properties?: "json" | "yaml" | undefined
  /** $NAME and ${NAME} in shell. */
  variables?: boolean | undefined
  /** <tag attr="…"> in HTML and XML. */
  markup?: boolean | undefined
}

const words = (s: string) => new Set(s.split(" "))

const js = words(
  "abstract as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while with yield"
)
const c = words("auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while true false null NULL")

const grammars: Record<string, Grammar> = {
  js: { line: ["//"], block: [["/*", "*/"]], strings: ['"', "'", "`"], keywords: js },
  python: {
    line: ["#"],
    strings: ['"""', "'''", '"', "'"],
    keywords: words("and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield match case self"),
  },
  sql: {
    line: ["--"],
    block: [["/*", "*/"]],
    strings: ["'", '"'],
    caseless: true,
    keywords: words(
      "select from where and or not in is null as join left right inner outer full cross on group by order having limit offset insert into values update set delete create table alter drop index view distinct union all case when then else end asc desc count sum avg min max interval like between exists primary key foreign references default with returning true false coalesce cast"
    ),
  },
  json: { strings: ['"'], keywords: words("true false null"), properties: "json" },
  bash: {
    line: ["#"],
    strings: ['"', "'"],
    variables: true,
    keywords: words("if then else elif fi for while until do done case esac in function return export local readonly set unset echo cd exit source alias sudo npm npx git curl"),
  },
  yaml: { line: ["#"], strings: ['"', "'"], keywords: words("true false null yes no on off"), properties: "yaml" },
  css: { block: [["/*", "*/"]], strings: ['"', "'"], keywords: words("important inherit initial unset none auto") },
  html: { block: [["<!--", "-->"]], strings: ['"', "'"], keywords: new Set(), markup: true },
  go: {
    line: ["//"],
    block: [["/*", "*/"]],
    strings: ['"', "`", "'"],
    keywords: words("break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false"),
  },
  rust: {
    line: ["//"],
    block: [["/*", "*/"]],
    strings: ['"'],
    keywords: words("as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while"),
  },
  java: {
    line: ["//"],
    block: [["/*", "*/"]],
    strings: ['"', "'"],
    keywords: words("abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void while var"),
  },
  c: { line: ["//"], block: [["/*", "*/"]], strings: ['"', "'"], keywords: c },
}

const aliases: Record<string, string> = {
  javascript: "js", jsx: "js", ts: "js", tsx: "js", typescript: "js", mjs: "js", cjs: "js",
  py: "python",
  sh: "bash", shell: "bash", zsh: "bash", console: "bash",
  yml: "yaml",
  xml: "html", svg: "html",
  golang: "go", rs: "rust", kotlin: "java", cpp: "c", "c++": "c", h: "c", csharp: "java", cs: "java",
  postgres: "sql", postgresql: "sql", mysql: "sql", sqlite: "sql",
}

/** Whether `language` has a grammar here. */
export function canHighlight(language: string): boolean {
  const l = language.toLowerCase()
  return Boolean(grammars[aliases[l] ?? l])
}

/** Long payloads stay plain: highlighting them would cost more than it helps. */
const MAX = 50_000

/** The text split into typed tokens; their texts joined give back the input exactly. */
export function tokenize(text: string, language: string): Token[] {
  const l = language.toLowerCase()
  const g = grammars[aliases[l] ?? l]
  if (!g || text.length > MAX) return [{ type: "plain", text }]
  const out: Token[] = []
  const push = (type: TokenType, t: string) => {
    if (!t) return
    const last = out[out.length - 1]
    if (last && last.type === type) last.text += t
    else out.push({ type, text: t })
  }
  let i = 0
  let lineStart = true
  let inTag = false
  while (i < text.length) {
    const rest = text.slice(i)
    const ch = text[i]!

    // Comments.
    const line = g.line?.find((m) => rest.startsWith(m) && !(g.variables && m === "#" && i > 0 && /\S/.test(text[i - 1]!)))
    if (line && !inTag) {
      const end = text.indexOf("\n", i)
      const stop = end < 0 ? text.length : end
      push("comment", text.slice(i, stop))
      i = stop
      continue
    }
    const block = g.block?.find(([open]) => rest.startsWith(open))
    if (block && !inTag) {
      const end = text.indexOf(block[1], i + block[0].length)
      const stop = end < 0 ? text.length : end + block[1].length
      push("comment", text.slice(i, stop))
      i = stop
      continue
    }

    // Markup: tag names, attributes, then attribute values as strings.
    if (g.markup) {
      const open = /^<\/?([A-Za-z][\w:.-]*)/.exec(rest)
      if (!inTag && open) {
        push("operator", rest.startsWith("</") ? "</" : "<")
        push("tag", open[1]!)
        i += open[0].length
        inTag = true
        continue
      }
      if (inTag) {
        const close = /^\/?>/.exec(rest)
        if (close) {
          push("operator", close[0])
          i += close[0].length
          inTag = false
          continue
        }
        const attr = /^[A-Za-z_:][\w:.-]*/.exec(rest)
        if (attr) {
          push("property", attr[0])
          i += attr[0].length
          continue
        }
      } else {
        // Text between tags.
        const next = text.indexOf("<", i + 1)
        const stop = next < 0 ? text.length : next
        push("plain", text.slice(i, stop))
        i = stop
        continue
      }
    }

    // Strings (with backslash escapes), and JSON's property names.
    const quote = (!g.markup || inTag) && g.strings.find((q) => rest.startsWith(q))
    if (quote) {
      let j = i + quote.length
      while (j < text.length && !text.startsWith(quote, j)) {
        if (text[j] === "\\") j++
        else if (quote.length === 1 && quote !== "`" && text[j] === "\n") break
        j++
      }
      const stop = Math.min(text.length, j + (text.startsWith(quote, j) ? quote.length : 0))
      const s = text.slice(i, stop)
      push(g.properties === "json" && /^\s*:/.test(text.slice(stop)) ? "property" : "string", s)
      i = stop
      lineStart = false
      continue
    }

    // YAML keys at the start of a line (after indentation or "- ").
    if (g.properties === "yaml" && lineStart) {
      const key = /^([ \t]*(?:- )?)([\w.-][\w .-]*?)(\s*:)(?=\s|$)/.exec(rest)
      if (key) {
        push("plain", key[1]!)
        push("property", key[2]!)
        push("operator", key[3]!)
        i += key[0].length
        lineStart = false
        continue
      }
    }

    // Shell variables.
    if (g.variables && ch === "$") {
      const v = /^\$(\{[^}\n]*\}|[A-Za-z_]\w*|[0-9@#?*!$-])/.exec(rest)
      if (v) {
        push("variable", v[0])
        i += v[0].length
        lineStart = false
        continue
      }
    }

    // Numbers.
    const num = /^(?:0x[\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(rest)
    if (num && (i === 0 || !/[\w$]/.test(text[i - 1]!))) {
      push("number", num[0])
      i += num[0].length
      lineStart = false
      continue
    }

    // Words: keywords, calls, types.
    const word = /^[A-Za-z_$][\w$]*/.exec(rest)
    if (word) {
      const w = word[0]
      const after = text.slice(i + w.length)
      const type: TokenType = (g.caseless ? g.keywords.has(w.toLowerCase()) : g.keywords.has(w))
        ? "keyword"
        : /^\s*\(/.test(after) && !g.properties
          ? "function"
          : /^[A-Z][a-z]/.test(w) && !g.caseless && !g.properties && grammars.css !== g
            ? "type"
            : "plain"
      push(type, w)
      i += w.length
      lineStart = false
      continue
    }

    if (ch === "\n") {
      push("plain", ch)
      lineStart = true
      i++
      continue
    }
    if (/\s/.test(ch)) {
      push("plain", ch)
      i++
      continue
    }
    push(/[=+\-*/%<>!&|^~?:]/.test(ch) ? "operator" : "plain", ch)
    lineStart = false
    i++
  }
  return out
}
