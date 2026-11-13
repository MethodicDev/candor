# Candor starter

A Next.js app with a working agent chat built from [Candor UI](https://candor.themethodic.com)'s free components.
Clone it, add an Anthropic API key, and you're talking to an agent that reads a to-do list on its own and asks you
before it adds to it.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMethodicDev%2Fcandor%2Ftree%2Fmain%2Fstarter&project-name=candor-starter&repository-name=candor-starter&env=ANTHROPIC_API_KEY,CANDOR_APPROVAL_SECRET&envDescription=Your%20Anthropic%20API%20key%2C%20and%20any%20long%20random%20string%20to%20sign%20tool%20approvals&envLink=https%3A%2F%2Fgithub.com%2FMethodicDev%2Fcandor%2Ftree%2Fmain%2Fstarter%23environment-variables)

- **Next.js 16** (App Router, Cache Components), **React 19**, **Tailwind 4**, **TypeScript**, shadcn initialised.
- **Candor's free items**, installed with the shadcn CLI and yours to edit: the theme, `Thread`, `Message`,
  `Composer`, `ToolCall`, `Reasoning`, `PromptSuggestions` and both SDK adapters.
- **`/`: the Vercel AI SDK 7.** `useChat` plus `useCandorChat`, with the agent in `app/api/chat/route.ts`
  (`claude-opus-5-5` via `@ai-sdk/anthropic`). Reading the list runs at once; adding a task waits for your OK through
  the SDK's `toolApproval`, and approvals are signed with `CANDOR_APPROVAL_SECRET`.
- **`/claude`: the Claude Agent SDK.** `streamClaudeAgent` plus `useClaudeAgent`, with the agent in
  `app/api/agent/route.ts` and your answers to its permission requests in `app/api/agent/approve/route.ts`. This one
  needs a **long-running Node server** (`next start`, a container or a VM): waiting permission requests live in the
  server's memory, so serverless functions spread over instances can't answer them.

Without `ANTHROPIC_API_KEY` the pages say so instead of showing the chat. The key is only read on the server.

> Generated from Candor UI 5.0.0: the Candor files in this starter are that release's. What changed since is in the [changelog](https://candor.themethodic.com/changelog).

## Get started

```bash
npx degit MethodicDev/candor/starter my-agent-app
cd my-agent-app
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

Or clone `https://github.com/MethodicDev/candor` and use its `starter` folder, or use the Deploy button above.

### Environment variables

| Name | What it's for |
|---|---|
| `ANTHROPIC_API_KEY` | Runs the agent. Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys). Server-side only. |
| `CANDOR_APPROVAL_SECRET` | Any long random string (`openssl rand -base64 32`). Signs AI SDK approval requests so a browser can't approve a tool call the server never asked about. |

## Where things are

```
app/page.tsx                   the AI SDK chat page
app/claude/page.tsx            the Claude Agent SDK chat page
app/api/chat/route.ts          the AI SDK agent and its tools
app/api/agent/                 the Claude Agent SDK agent, and its approval route
app/_components/               the starter's own UI (chat view, header, missing-key note)
app/_lib/tasks.ts              the demo's to-do list, in server memory: replace with your data
app/_lib/cross-site.ts         refuses a POST another site's page sent; every route that changes something asks it first
components/candor/             Candor components, installed from the registry (ui/ holds its primitives)
components/ui/                 the starter's own primitives (shadcn's)
lib/candor/                    Candor's shared types and helpers
styles/candor.css              Candor's theme (light, dark and high contrast)
```

The to-do list lives in server memory, so it resets on restart and isn't shared between serverless instances. Swap
in your own tools and data, and pass your signed-in user's id as `owner` to `streamClaudeAgent` and
`answerClaudeAgentApproval` so only that person can answer the agent's requests.

## Add more Candor components

The `@candor` registry is already in `components.json`. Free items install as they are:

```bash
npx shadcn@latest add @candor/context-meter @candor/citation
```

**Pro and Premium items** (every other component, plus blocks and templates) need your licence key, from your Polar
customer portal after you [buy](https://candor.themethodic.com/#pricing). Put it in `.env.local`:

```bash
CANDOR_LICENSE_KEY=your-key
```

and send it as a header in `components.json`. Add the header only once the key is set: the shadcn CLI stops if a
variable it names is missing.

```json
{
  "registries": {
    "@candor": {
      "url": "https://candor.themethodic.com/r/{name}.json",
      "headers": { "Authorization": "Bearer ${CANDOR_LICENSE_KEY}" }
    }
  }
}
```

Then, for example, a Premium block on either SDK:

```bash
npx shadcn@latest add @candor/approval-gated-change          # Vercel AI SDK
npx shadcn@latest add @candor/approval-gated-change-claude   # Claude Agent SDK
```

## Theme

`app/globals.css` imports Candor's theme after Tailwind. Themes switch with `data-theme="light" | "dark" | "hc"` on
`<html>`; with no attribute they follow the system. Override colours by their shadcn names and everything else by its
`--cd-*` name after the import. Don't redefine `--font-sans` (shadcn's init does; this starter removed it), or point
it at `var(--cd-font)`.

## Learn more

- [Docs](https://candor.themethodic.com/docs): every component, its props and examples
- [Patterns](https://candor.themethodic.com/patterns): approvals, plans, runs, recovery and more
- [Principles](https://candor.themethodic.com/principles): why Candor shows what it shows
- [llms.txt](https://candor.themethodic.com/llms.txt): for coding agents choosing components

## Licence

This starter is MIT ([LICENSE](LICENSE)), as are Candor's free components. Pro and Premium items are under Candor's
commercial licence.
