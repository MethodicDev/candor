import type { InlineNode, ListBlock, ListItemBlock, MessageBlock, PayloadLanguage } from "@/lib/candor/chat"
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
 * A fence is three or more backticks or tildes, and only a line of the same character, at least as many, closes it, so
 * a ```` fence can hold a ``` one. The first word after the fence is its language (`c++`, `objective-c` and `c#`
 * included) and the rest of that line is ignored (```` ```ts title=x ````). A line whose backticks are followed by more
 * backticks is text, not a fence: "```x``` y" is a paragraph. A fence left open runs to the end of the text, as a
 * streaming reply's does. Tildes, longer fences and the text after the language are new in 6.2.1.
 *
 * A GFM pipe table (a header row, a delimiter row such as `| --- | :-: |`, then body rows) becomes a table block of
 * inline text cells, with each column's alignment. `\|` is a pipe inside a cell. A table whose rows don't all have as
 * many cells as its header stays the paragraph it reads as without tables. New in 6.1.0.
 *
 * Consecutive `>` lines become a quote block, a blank `>` line starting a new paragraph in it; a `>` inside a quote is
 * read as text, not as a quote within it. A quote's lines follow `breaks` as a paragraph's do. New in 6.1.0. A list in a
 * quote is read as a list, as anywhere else; the quote's paragraph for it keeps its lines as text.
 *
 * A list item indented at least two columns past its level's indent (the first item's of that level) is nested in the
 * last item of that level, to four levels: `"- a\n - b\n  - c"` makes a and b items of one list, with c nested in b.
 * An item deeper than the fourth level is read as one more item of it, so no text is lost. A tab counts as four columns.
 * Ordered and unordered items can nest in each other, and an item of the other kind at the same level starts a new
 * list there. An indented line that isn't an item continues the item it sits under; after a blank line it is a
 * paragraph inside that item. A fence indented two columns or more past an item's level is a code block inside that
 * item, its lines with the fence's indent taken off; a fence at the list's own indent ends the list. Blank lines
 * between items keep one list, numbered on; a line at the list's own indent that isn't an item ends it. A numbered
 * list keeps its first number as `start`, so a list the text starts at `3.` is numbered from 3. While a reply streams,
 * a last line that is only a marker (`-`, `1.`, or, at a nested indent or after a numbered item, just the digits of
 * the number the next item at its level would have) is an empty item at the level it will have, so the item doesn't
 * move when its text arrives. A last line of any other number is text, read as any other line, so a reply's closing
 * number is never lost. A lone `1.` with no list before it is still a paragraph until text follows it.
 *
 * A fence in an item runs to its closing fence, however indented that is, so code written flush left under an item
 * stays code. A fence with no closing fence after it, as a reply's is until the fence's end arrives, ends at a line
 * less indented than the fence that goes on the list: an item of a level already open, of its kind and, when
 * numbered, with the number the next item there would have (`2.` after `1.`). Then the items after it are kept rather
 * than drawn as code. Nothing else ends it: not text, a heading or a quote, which in code are more often a line of the
 * code (`# a comment`) than the end of it. So while a reply streams, code written flush left whose lines read as the
 * list's next item (a `- a` line of YAML under a `-` item) is drawn as items until its closing fence arrives, and then
 * as code.
 *
 * New in 6.1.2; code in an item, blank lines between items and `start` are new in 6.1.3, and the end of a fence that
 * isn't closed in 6.2.1. With `breaks`, a lone newline in an item's text or a paragraph under it is a line break.
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
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", nodes: inline(para.join(breaks ? "\n" : " ")), ...(breaks && para.length > 1 ? { breaks: true as const } : {}) })
    para = []
  }

  const closed = closedLater(lines)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fence = fenceAt(line)
    if (fence) {
      flushPara()
      const body: string[] = []
      while (++i < lines.length && !closes(lines[i]!, fence)) body.push(lines[i]!)
      const language = fenceLanguage(fence.word)
      blocks.push({ kind: "payload", language, text: body.join("\n"), title: fenceTitle(fence.word, language) })
      continue
    }
    if (/^\s*>/.test(line)) {
      flushPara()
      // Consecutive `>` lines; a blank one starts a new paragraph. A deeper `>` is read as text, and a list as a list.
      const quoted: string[] = []
      for (; i < lines.length && /^\s*>/.test(lines[i]!); i++) quoted.push(lines[i]!.replace(/^\s*>\s?/, ""))
      i--
      const kept: string[][] = []
      const lists: (ListBlock | null)[] = []
      let quotedClosed: ReturnType<typeof closedLater> | undefined
      let open: string[] | null = null
      for (let q = 0; q < quoted.length; q++) {
        const said = quoted[q]!
        if (!said.trim()) {
          open = null
          continue
        }
        if (itemRe.test(said)) {
          const read = readList(quoted, q, breaks, (quotedClosed ??= closedLater(quoted)))
          kept.push(quoted.slice(q, read.end).map((l) => l.trim()).filter(Boolean))
          lists[kept.length - 1] = read.block
          open = null
          q = read.end - 1
          continue
        }
        if (!open) kept.push((open = []))
        open.push(said.trim())
      }
      const read = kept.map((p) => inline(p.join(breaks ? "\n" : " ")))
      if (read.length)
        blocks.push({
          kind: "quote",
          paragraphs: read,
          ...(breaks && kept.some((p) => p.length > 1) ? { breaks: true as const } : {}),
          ...(lists.length ? { lists: Array.from(kept, (_, k) => lists[k] ?? null) } : {}),
        })
      continue
    }
    if (itemRe.test(line)) {
      flushPara()
      const read = readList(lines, i, breaks, closed)
      blocks.push(read.block)
      i = read.end - 1
      continue
    }
    if (!line.trim()) {
      flushPara()
      continue
    }
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
  return blocks
}

/** A list item: its marker (`-`, `*`, `+`, or a number and `.` or `)`), a space and its text. */
const itemRe = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/

/** A line that is only a marker, as a stream writes an item before its text. */
const bareMarker = /^\s*(?:[-*+]|\d+[.)])\s*$/

type Item = { ordered: boolean; text: string; number: number }

/** The list item at `lines[at]`, or the last line when it is only a marker (an empty item still streaming). */
function itemAt(lines: string[], at: number): Item | null {
  const m = itemRe.exec(lines[at]!)
  if (m) return { ordered: !m[1], text: m[3]!, number: m[2] ? Number(m[2]) : 1 }
  if (at === lines.length - 1 && bareMarker.test(lines[at]!)) return { ordered: /\d/.test(lines[at]!), text: "", number: numberIn(lines[at]!) }
  return null
}

/** The number a line's marker starts with, or 1 when it has none. */
const numberIn = (line: string) => Number(/\d+/.exec(line)?.[0] ?? 1)

/** How far a line is indented, in columns: a tab moves to the next multiple of four. */
function indentOf(line: string): number {
  let col = 0
  for (const ch of line) {
    if (ch === "\t") col += 4 - (col % 4)
    else if (/\s/.test(ch)) col++
    else break
  }
  return col
}

/** How many levels a list nests to, the top one included. An item deeper than this is one more item of the last level. */
const LIST_DEPTH = 4

/** A line that starts a block a list can't hold, and so ends it: a fence (unless indented into an item), a quote or a heading. */
const endsList = (line: string) => fenceAt(line) !== null || /^\s*(?:>|#{1,6}\s)/.test(line)

type Fence = { mark: string; size: number; word: string }

/**
 * A fence's opening line: three or more backticks or tildes, then an info string whose first word is the language
 * (the rest is ignored). A backtick fence's info string has no backtick, so a line such as "```x``` y" is text.
 */
function fenceAt(line: string): Fence | null {
  const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line)
  if (!m) return null
  const info = m[2]!.trim()
  if (m[1]![0] === "`" && info.includes("`")) return null
  return { mark: m[1]![0]!, size: m[1]!.length, word: info.split(/\s/, 1)[0]! }
}

/** A line that closes `fence`: only its character, at least as many as opened it, at any indent. */
function closes(line: string, fence: Fence): boolean {
  const m = /^\s*(`{3,}|~{3,})\s*$/.exec(line)
  return m !== null && m[1]![0] === fence.mark && m[1]!.length >= fence.size
}

/**
 * Whether the fence opened at `lines[at]` has a line after it that closes it. Linear: worked out once for all the
 * lines, on first use, as the longest closing fence of each kind after each line.
 */
function closedLater(lines: string[]): (at: number, fence: Fence) => boolean {
  let after: Record<string, Int32Array> | null = null
  return (at, fence) => {
    if (!after) {
      const runs = { "`": new Int32Array(lines.length), "~": new Int32Array(lines.length) }
      let tick = 0
      let tilde = 0
      for (let i = lines.length - 1; i >= 0; i--) {
        runs["`"][i] = tick
        runs["~"][i] = tilde
        const m = /^\s*(`{3,}|~{3,})\s*$/.exec(lines[i]!)
        if (m && m[1]![0] === "`") tick = Math.max(tick, m[1]!.length)
        else if (m) tilde = Math.max(tilde, m[1]!.length)
      }
      after = runs
    }
    return after[fence.mark]![at]! >= fence.size
  }
}

/** A line with up to `cols` columns of its indent taken off, a tab counting to the next multiple of four. */
function dedent(line: string, cols: number): string {
  let col = 0
  let i = 0
  for (; i < line.length && col < cols; i++) {
    const ch = line[i]!
    if (ch === "\t") col += 4 - (col % 4)
    else if (/\s/.test(ch)) col++
    else break
  }
  return line.slice(i)
}

type RawFence = { fence: string; body: string[] }
type RawItem = { lines: string[]; under: (RawList | { para: string[] } | RawFence)[] }
type RawList = { ordered: boolean; start: number; indent: number; items: RawItem[] }

/**
 * The list starting at the item `lines[at]`, with what is nested in it, and the index of the first line after it.
 * Every level's indent is its first item's; a line is under the deepest item whose level it is two columns past.
 */
/** The number a numbered item at indent `n` would take: the next of its level's list, or 1 where it would start one. */
function nextNumber(stack: RawList[], n: number): number {
  let depth = stack.length
  while (depth > 1 && n < stack[depth - 1]!.indent) depth--
  const level = stack[depth - 1]!
  if (level.items.length && n >= level.indent + 2 && depth < LIST_DEPTH) return 1
  return level.ordered ? level.start + level.items.length : 1
}

/**
 * The list item at `lines[end]` inside the list `root` (whose open levels are `stack`), or null. A last line that is
 * only the number the next item at its level would have is that item with its `.` still to come: an empty item, as `1.`
 * is. Any other number is text, read as any other line.
 */
function itemOf(lines: string[], end: number, stack: RawList[], root: RawList): Item | null {
  const line = lines[end]!
  const n = indentOf(line)
  const digits = end === lines.length - 1 && /^\s*\d+$/.test(line) && (n >= root.indent + 2 || (root.ordered && n >= root.indent)) && numberIn(line) === nextNumber(stack, n)
  return itemAt(lines, end) ?? (digits ? { ordered: true, text: "", number: numberIn(line) } : null)
}

/**
 * Whether the item at `lines[end]` goes on a level already open in `stack`: one of its kind, at its indent (not nested
 * deeper), and, when numbered, the number the next item there would have.
 */
function goesOn(lines: string[], end: number, stack: RawList[], root: RawList): boolean {
  const item = itemOf(lines, end, stack, root)
  if (!item) return false
  const m = indentOf(lines[end]!)
  let depth = stack.length
  while (depth > 1 && m < stack[depth - 1]!.indent) depth--
  const level = stack[depth - 1]!
  if (level.items.length && m >= level.indent + 2 && depth < LIST_DEPTH) return false
  return level.ordered === item.ordered && (!item.ordered || item.number === level.start + level.items.length)
}

function readList(lines: string[], at: number, breaks: boolean, closed: (at: number, fence: Fence) => boolean): { block: ListBlock; end: number } {
  const first = itemAt(lines, at)!
  const root: RawList = { ordered: first.ordered, start: first.number, indent: indentOf(lines[at]!), items: [] }
  const stack: RawList[] = [root]
  // The lines a next unindented-enough line would continue: an item's text or a paragraph under one, and whose it is.
  let open = null as { item: RawItem; lines: string[] } | null
  let blank = false
  let end = at
  for (; end < lines.length; end++) {
    const line = lines[end]!
    if (!line.trim()) {
      blank = true
      continue
    }
    const n = indentOf(line)
    const fence = fenceAt(line)
    if (fence && n >= root.indent + 2) {
      // A fence indented into an item is a code block in it, its lines with the fence's indent taken off. It runs to
      // its closing fence; without one, to a line less indented than it that goes on the list, or to the end of the
      // text. The list goes on after it.
      while (stack.length > 1 && n < stack.at(-1)!.indent + 2) stack.pop()
      const ends = closed(end, fence)
      const body: string[] = []
      while (++end < lines.length && !closes(lines[end]!, fence)) {
        const next = lines[end]!
        if (!ends && next.trim() && indentOf(next) < n && goesOn(lines, end, stack, root)) break
        body.push(dedent(next, n))
      }
      stack.at(-1)!.items.at(-1)!.under.push({ fence: fence.word, body })
      open = null
      blank = false
      if (end < lines.length && !closes(lines[end]!, fence)) {
        // Closed by a line of the list: blank lines before it are the list's, and the line is read as the list's.
        while (body.length && !body.at(-1)!.trim()) {
          body.pop()
          blank = true
        }
        end--
      }
      continue
    }
    if (endsList(line)) break
    const item = itemOf(lines, end, stack, root)
    if (!item && n < root.indent + 2) break
    if (item) {
      // Blank lines between items keep one list, its numbering going on.
      while (stack.length > 1 && n < stack.at(-1)!.indent) stack.pop()
      let level = stack.at(-1)!
      const parent = level.items.at(-1)
      if (parent && n >= level.indent + 2 && stack.length < LIST_DEPTH) {
        level = { ordered: item.ordered, start: item.number, indent: n, items: [] }
        parent.under.push(level)
        stack.push(level)
      } else if (level.ordered !== item.ordered) {
        // The other kind at the same level: a new list there, or, at the top, a new list block.
        if (level === root) break
        stack.pop()
        const owner = stack.at(-1)!.items.at(-1)!
        level = { ordered: item.ordered, start: item.number, indent: level.indent, items: [] }
        owner.under.push(level)
        stack.push(level)
      }
      const added: RawItem = { lines: [item.text], under: [] }
      level.items.push(added)
      open = { item: added, lines: added.lines }
    } else {
      // Under the deepest item whose level the line is two columns past.
      while (stack.length > 1 && n < stack.at(-1)!.indent + 2) stack.pop()
      const target = stack.at(-1)!.items.at(-1)!
      if (!blank && open?.item === target) open.lines.push(line.trim())
      else {
        const para = { para: [line.trim()] }
        target.under.push(para)
        open = { item: target, lines: para.para }
      }
    }
    blank = false
  }
  // A code block left open in the last item runs to the end of the text. Blank lines the list ended on belong to what
  // follows.
  end = Math.min(end, lines.length)
  while (end > at + 1 && !lines[end - 1]!.trim()) end--
  return { block: listBlock(root, breaks), end }
}

function listBlock(list: RawList, breaks: boolean): ListBlock {
  const nested = list.items.map((it) =>
    it.under.map((u): ListItemBlock => {
      if ("para" in u) return { kind: "paragraph", nodes: inline(u.para.join(breaks ? "\n" : " ")), ...(breaks && u.para.length > 1 ? { breaks: true as const } : {}) }
      if ("fence" in u) {
        const language = fenceLanguage(u.fence)
        return { kind: "payload", language, text: u.body.join("\n"), title: fenceTitle(u.fence, language) }
      }
      return listBlock(u, breaks)
    })
  )
  return {
    kind: "list",
    ordered: list.ordered,
    ...(list.ordered && list.start !== 1 && Number.isSafeInteger(list.start) ? { start: list.start } : {}),
    items: list.items.map((it) => inline(it.lines.join(breaks ? "\n" : " "))),
    ...(nested.some((n) => n.length) ? { nested } : {}),
  }
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
const startsBlock = (line: string) => fenceAt(line) !== null || /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>)/.test(line)

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
