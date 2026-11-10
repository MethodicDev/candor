import type { InlineNode, MessageBlock, PayloadLanguage } from "@/lib/candor/chat"

/*
 * Model text → Candor blocks. Candor never renders model output as HTML or
 * markdown, so text is read as a small, safe subset of markdown (paragraphs,
 * lists, fenced code, `code`, **strong**, *em*) into typed blocks. Links
 * become plain text with the address in brackets: nothing from a model is
 * ever a clickable link. Every adapter uses this.
 */

const fenceLanguage = (lang: string): PayloadLanguage => (lang === "json" ? "json" : lang === "xml" || lang === "html" ? "xml" : "text")

/**
 * Reads model text as safe markdown: paragraphs, lists and fenced code. Never HTML. `#` lines are bold paragraphs
 * unless `headings` is set, when `#`, `##` and `###` (and deeper, as level 3) become heading blocks.
 */
export function markdownBlocks(text: string, { headings = false }: { headings?: boolean | undefined } = {}): MessageBlock[] {
  const blocks: MessageBlock[] = []
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", nodes: inline(para.join(" ")) })
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
      blocks.push({ kind: "payload", language: fenceLanguage(fence[1]!.toLowerCase()), text: body.join("\n"), title: fence[1] || undefined })
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
    para.push(line.replace(/^\s*>\s?/, "").trim())
  }
  flushPara()
  flushList()
  return blocks
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
