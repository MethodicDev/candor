import type { InlineNode, MessageBlock, PayloadLanguage } from "@/lib/candor/chat"
import { canHighlight } from "@/lib/candor/highlight"

/*
 * Model text → Candor blocks. Candor never renders model output as HTML or
 * markdown, so text is read as a small, safe subset of markdown (paragraphs,
 * lists, fenced code, pipe tables, quotes, `code`, **strong**, *em*) into typed blocks. Links
 * become plain text with the address in brackets: nothing from a model is
 * ever a clickable link. Every adapter uses this.
 */

/** A fence's other names for the languages Payload highlights, mapped to the one name it shows. */
const fenceAliases: Record<string, PayloadLanguage> = {
  py: "python",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  console: "shell",
  yml: "yaml",
  html: "xml",
  svg: "xml",
  golang: "go",
  rs: "rust",
}

/**
 * A fence's language, lower-cased, with its common aliases mapped ("py" is "python", "ts" is "typescript"), so
 * Payload can highlight it. A language the highlighter doesn't know is "text", drawn plain.
 */
const fenceLanguage = (word: string): PayloadLanguage => {
  const lang = word.toLowerCase()
  const named = Object.hasOwn(fenceAliases, lang) ? fenceAliases[lang]! : lang
  return named !== "text" && canHighlight(named) ? named : "text"
}

/** Fence words for a dialect of a language Payload highlights, which its label ("TypeScript", "XML") doesn't name. */
const fenceDialects = new Set(["tsx", "jsx", "html", "svg"])

/**
 * A fence's title: its own word when Payload's label doesn't already say it, so a recognised language is named once
 * ("Python", not "Python · python"). A language drawn as plain text keeps its name ("Text · hcl"), and so does a
 * dialect ("TypeScript · tsx").
 */
const fenceTitle = (word: string, language: PayloadLanguage): string | undefined => {
  const lower = word.toLowerCase()
  if (!word || lower === language) return undefined
  return language === "text" || fenceDialects.has(lower) ? word : undefined
}

/**
 * Reads model text as safe markdown: paragraphs, lists, fenced code, pipe tables and quotes. Never HTML. `#` lines are bold paragraphs
 * unless `headings` is set, when `#`, `##` and `###` (and deeper, as level 3) become heading blocks.
 *
 * A fenced block keeps its language, lower-cased and with common aliases mapped (`py` is "python", `ts` and `tsx`
 * "typescript", `sh` "shell", `yml` "yaml"), so Payload highlights it when highlighting is on. A language Payload
 * doesn't highlight is "text", drawn plain, with the fence's word as the block's title. A recognised language is named
 * once, by Payload's label: the title is left out, but for a dialect the label doesn't name (`tsx`, `jsx`, `html`, `svg`).
 *
 * A GFM pipe table (a header row, a delimiter row such as `| --- | :-: |`, then body rows) becomes a table block of
 * inline text cells, with each column's alignment. `\|` is a pipe inside a cell. A table whose rows don't all have as
 * many cells as its header stays the paragraph it reads as without tables. New in 6.1.0.
 *
 * Consecutive `>` lines become a quote block, a blank `>` line starting a new paragraph in it; a `>` inside a quote is
 * read as text, not as a quote within it. A quote's lines follow `breaks` as a paragraph's do. New in 6.1.0.
 *
 * A lone newline inside a paragraph (or a quote's) is a space, as CommonMark reads it, unless `breaks` is set (as GFM's breaks option,
 * for writing apps whose agents break lines on purpose): then it stays in the paragraph's text as "\n", a line break,
 * and a blank line still starts a new paragraph. The text stays text either way; such a paragraph or quote is marked
 * `breaks`, and the renderer shows its "\n" as line breaks.
 */
export function markdownBlocks(
  text: string,
  {
    headings = false,
    breaks = false,
  }: {
    /** `#` lines become heading blocks (levels 1 to 3) rather than bold paragraphs. Defaults to false. */
    headings?: boolean | undefined
    /** A lone newline inside a paragraph stays a line break ("\n" in its text) rather than a space. Defaults to false. */
    breaks?: boolean | undefined
  } = {}
): MessageBlock[] {
  const blocks: MessageBlock[] = []
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", nodes: inline(para.join(breaks ? "\n" : " ")), ...(breaks && para.length > 1 ? { breaks: true as const } : {}) })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(inline) })
    list = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fence = /^\s*```(\w*)\s*$/.exec(line)
    if (fence) {
      flushPara()
      flushList()
      const body: string[] = []
      while (++i < lines.length && !/^\s*```\s*$/.test(lines[i]!)) body.push(lines[i]!)
      const language = fenceLanguage(fence[1]!)
      blocks.push({ kind: "payload", language, text: body.join("\n"), title: fenceTitle(fence[1]!, language) })
      continue
    }
    if (/^\s*>/.test(line)) {
      flushPara()
      flushList()
      // Consecutive `>` lines; a blank one starts a new paragraph. A deeper `>` is read as text.
      const paragraphs: string[][] = [[]]
      for (; i < lines.length && /^\s*>/.test(lines[i]!); i++) {
        const quoted = lines[i]!.replace(/^\s*>\s?/, "").trim()
        if (quoted) paragraphs.at(-1)!.push(quoted)
        else if (paragraphs.at(-1)!.length) paragraphs.push([])
      }
      i--
      const kept = paragraphs.filter((p) => p.length)
      const read = kept.map((p) => inline(p.join(breaks ? "\n" : " ")))
      if (read.length) blocks.push({ kind: "quote", paragraphs: read, ...(breaks && kept.some((p) => p.length > 1) ? { breaks: true as const } : {}) })
      continue
    }
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line)
    if (item) {
      flushPara()
      const ordered = !!item[2]
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push(item[3]!)
      continue
    }
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    flushList()
    const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushPara()
      blocks.push(
        headings
          ? { kind: "heading", level: Math.min(heading[1]!.length, 3) as 1 | 2 | 3, nodes: inline(heading[2]!) }
          : { kind: "paragraph", nodes: [{ kind: "strong", text: heading[2]! }] }
      )
      continue
    }
    const table = tableAt(lines, i)
    if (table) {
      flushPara()
      blocks.push(table.block)
      i = table.end - 1
      continue
    }
    para.push(line.trim())
  }
  flushPara()
  flushList()
  return blocks
}

type Align = "start" | "center" | "end" | null

/** A row's cells: split at each pipe that isn't escaped, without the row's outer pipes. `\|` is a pipe in a cell. Null without a pipe. */
function cells(line: string): string[] | null {
  let row = line.trim()
  if (!/(?:^|[^\\])\|/.test(row)) return null
  if (row.startsWith("|")) row = row.slice(1)
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1)
  const out: string[] = []
  let cell = ""
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "\\" && row[i + 1] === "|") {
      cell += "|"
      i++
    } else if (row[i] === "|") {
      out.push(cell.trim())
      cell = ""
    } else cell += row[i]
  }
  out.push(cell.trim())
  return out
}

/** A delimiter row's alignments (`---`, `:--`, `--:`, `:-:`), or null when the row isn't one. */
function delimiter(line: string): Align[] | null {
  const row = cells(line)
  if (!row || !row.every((c) => /^:?-+:?$/.test(c))) return null
  return row.map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.startsWith(":") ? "start" : c.endsWith(":") ? "end" : null))
}

/** A line that starts another block, and so ends a table: a list item, a heading, a fence or a quote. */
const startsBlock = (line: string) => /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|```|>)/.test(line)

/**
 * A GFM pipe table starting at `lines[at]`: a header row, a delimiter row with as many cells, and the body rows up to
 * a blank line, a line without a pipe or another block. Null when it isn't one, or when a row has more or fewer cells
 * than the header: then the lines are read as they would be without tables, rather than guessed at. A last line with
 * fewer cells is the row a stream hasn't finished: the table ends before it, and the line is read as a paragraph.
 */
function tableAt(lines: string[], at: number): { block: MessageBlock; end: number } | null {
  const header = cells(lines[at]!)
  const align = at + 1 < lines.length ? delimiter(lines[at + 1]!) : null
  if (!header || !align || align.length !== header.length) return null
  const rows: string[][] = []
  let end = at + 2
  for (; end < lines.length; end++) {
    const line = lines[end]!
    if (!line.trim() || startsBlock(line)) break
    const row = cells(line)
    if (!row) break
    // The last line with fewer cells is the row still streaming: the table ends before it, so a table stays a table.
    if (row.length < header.length && end === lines.length - 1) break
    if (row.length !== header.length) return null
    rows.push(row)
  }
  return {
    block: { kind: "table", header: header.map(inline), rows: rows.map((r) => r.map(inline)), ...(align.some(Boolean) ? { align } : {}) },
    end,
  }
}

/** `code`, **strong**, *em* and links (as text). Everything else stays literal. */
export function inline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|\[([^\]]+)\]\(([^)\s]+)\)/g
  let at = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) nodes.push({ kind: "text", text: text.slice(at, m.index) })
    if (m[1] !== undefined) nodes.push({ kind: "code", text: m[1] })
    else if (m[2] !== undefined || m[3] !== undefined) nodes.push({ kind: "strong", text: (m[2] ?? m[3])! })
    else if (m[4] !== undefined || m[5] !== undefined) nodes.push({ kind: "em", text: (m[4] ?? m[5])! })
    else nodes.push({ kind: "text", text: `${m[6]} (${m[7]})` })
    at = m.index + m[0].length
  }
  if (at < text.length) nodes.push({ kind: "text", text: text.slice(at) })
  return nodes
}

/** A person's own words as one block, exactly as typed. Adapters use this for user messages: what someone typed is never read as markdown. */
export function plainBlocks(text: string): MessageBlock[] {
  // Blank lines at the ends would show as empty space in the bubble; inside, they're the person's.
  const t = text.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "")
  return t.trim() ? [{ kind: "plain", text: t }] : []
}
