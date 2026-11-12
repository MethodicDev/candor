const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g // the embeddings and overrides (U+202A to U+202E) and the isolates (U+2066 to U+2069)

/**
 * Text from a model or a tool, safe to show: each bidi control character (U+202A to U+202E, U+2066 to U+2069) is
 * replaced by a visible mark naming it, such as `[U+202E]`. Those characters change the order letters are drawn in
 * without changing the text, so "invoice\u202Efdp.exe" would read as "invoiceexe.pdf", and a name or a tool result
 * could make the words around it read as something the app never wrote.
 *
 * The mark is part of the text, so a screen reader, a copy and the screen all get the same words, and the reader can
 * see that something was there rather than having it quietly removed. Arabic, Hebrew and other right-to-left letters
 * aren't controls: they are left alone and still read right to left, and so are the marks between them (U+200E, U+200F
 * and U+061C), which change no order.
 *
 * Models write balanced isolates (U+2066 to U+2069) in genuine mixed text, a Hebrew name inside an English sentence,
 * and those are marked too, so draw the string inside an isolate of its own: `<bdi>{neutralizeBidi(name)}</bdi>`, or
 * `unicode-bidi: isolate` on the element that holds only it. Its direction then comes from its own first letter, and
 * it can't reorder the app's words around it or be reordered by them. Candor's chat and work items do both for every
 * string they draw from a model or a tool; do the same where your own components do. In an attribute (an
 * `aria-label`, a `title`), neutralising is enough: nothing is laid out there.
 *
 * It runs on the server too (no `"use client"`). Homoglyphs, letters of another script that look alike, aren't
 * detected here.
 */
export function neutralizeBidi(text: string): string
export function neutralizeBidi(text: string | undefined): string | undefined
export function neutralizeBidi(text: string | undefined): string | undefined {
  if (!text) return text
  return text.replace(BIDI_CONTROLS, (c) => `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`)
}

/**
 * JSON text with each bidi control written as its JSON escape, U+202E as the six characters `\u202E`, for a field where
 * a person edits JSON a model or a tool wrote (a tool call's input before allowing it). The escape is visible and
 * reorders nothing, and it parses back to the same character, so the input that's sent is still exactly the one
 * proposed. In JSON text a control can only stand inside a string, where the escape means the same.
 */
export function escapeBidiJson(json: string): string {
  return json.replace(BIDI_CONTROLS, (c) => `\\u${c.codePointAt(0)!.toString(16).toUpperCase()}`)
}

/** Whether `text` holds a bidi control character that `neutralizeBidi` would mark. */
export function hasBidiControls(text: string): boolean {
  return new RegExp(BIDI_CONTROLS.source).test(text)
}
