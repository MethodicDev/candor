export {} // oxlint-disable-line typescript/no-useless-empty-export -- code first, so an install keeps the doc comment
// shadcn starts an installed file at its first line of code and drops the comments above it; this file is one type, and
// its doc comment is what it is for.

/**
 * A heading's level in the page's outline: `1` is `<h1>`, `6` is `<h6>`. Every Candor item that draws a heading takes
 * its `headingLevel` as this type; the level is where the heading sits in the outline, never how large it looks.
 *
 * @keywords outline, h1, h2, h3, heading order
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
