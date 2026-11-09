/*
 * Runs axe-core on the Vite starter's page in a real browser: light and dark, at rest and with the permission prompt
 * open (the scripted agent is asked to add a task, which makes it ask first). Exits 1 on any violation.
 *
 *   node .github/scripts/axe-starter.mjs http://127.0.0.1:4173
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { chromium } from "playwright"

const url = process.argv[2] ?? "http://127.0.0.1:4173"
const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8")

const browser = await chromium.launch()
let failures = 0
for (const scheme of ["light", "dark"]) {
  const page = await (await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } })).newPage()
  await page.goto(url, { waitUntil: "networkidle" })
  const check = async (state) => {
    await page.evaluate(axeSource)
    const { violations } = await page.evaluate(() => globalThis.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }))
    console.log(`${scheme}, ${state}: ${violations.length} violation(s)`)
    for (const v of violations) {
      failures++
      console.error(`  ${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n")}`)
    }
  }
  await check("at rest")
  const box = page.getByRole("textbox").first()
  await box.fill('Add "Try a Candor block" to my list')
  await box.press("Enter")
  const deny = page.getByRole("button", { name: /deny/i }).first()
  if (await deny.waitFor({ timeout: 15_000 }).then(() => true, () => false)) await check("permission prompt open")
  else {
    failures++
    console.error(`  ${scheme}: the permission prompt never appeared, so it was not checked.`)
  }
  await page.context().close()
}
await browser.close()
process.exit(failures ? 1 : 0)
