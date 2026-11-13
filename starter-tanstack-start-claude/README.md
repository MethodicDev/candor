# Candor starter: TanStack Start and the Claude Agent SDK

A [TanStack Start](https://tanstack.com/start) app with a working agent chat built from
[Candor UI](https://candor.themethodic.com)'s free components. Clone it, add an Anthropic API key, and you're talking
to an agent that reads a to-do list on its own and asks you before it adds to it.

- **TanStack Start** (file-based routes, server routes, Nitro), **React 19**, **Tailwind 4**, **TypeScript**, shadcn
  initialised.
- **Candor's free items**, installed with the shadcn CLI and yours to edit: the theme, `Thread`, `Message`,
  `Composer`, `ToolCall`, `Reasoning`, `PromptSuggestions`, `PermissionPrompt` and the Claude Agent SDK adapter.
- **The Claude Agent SDK.** `streamClaudeAgent` runs the agent in a server route (`src/routes/api/agent/index.ts`),
  `useClaudeAgent` reads its stream in the page, and your answers to its permission requests go to
  `src/routes/api/agent/approve.ts`. Reading the list runs at once; adding a task waits for your OK.
- **A long-running Node server.** Waiting permission requests live in the server's memory, so this app builds to one
  Node server (`npm start`, a container or a VM). Serverless functions spread over instances can't answer them.

Without `ANTHROPIC_API_KEY` the page says so instead of showing the chat. The key is only read on the server: it is
never imported by anything the browser loads.

> Generated from Candor UI 5.0.0: the Candor files in this starter are that release's. What changed since is in the [changelog](https://candor.themethodic.com/changelog).

## Get started

```bash
npx degit MethodicDev/candor/starter-tanstack-start-claude my-agent-app
cd my-agent-app
npm install
cp .env.example .env.local   # then fill in the key
npm run dev
```

Or clone `https://github.com/MethodicDev/candor` and use its `starter-tanstack-start-claude` folder.

To run it as it would in production:

```bash
npm run build
npm start
```

`npm start` reads `.env.local` when it's there; on a host, set the variable there instead.

### Environment variables

| Name | What it's for |
|---|---|
| `ANTHROPIC_API_KEY` | Runs the agent. Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys). Server-side only. |

## Where things are

```
src/routes/index.tsx           the chat page; its loader asks the server whether the key is set
src/routes/__root.tsx          the document: head, stylesheet
src/routes/api/agent/          the agent (index.ts), and your answers to its permission requests (approve.ts)
src/app/                       the starter's own UI (chat view, missing-key note) and the to-do list
src/app/tasks.server.ts        the demo's to-do list, in server memory: replace with your data
src/app/cross-site.server.ts   refuses a POST another site's page sent; every route that changes something asks it first
src/components/candor/         Candor components, installed from the registry (ui/ holds its primitives)
src/components/ui/             the starter's own primitives (shadcn's)
src/lib/candor/                Candor's shared types and helpers
src/styles/candor.css          Candor's theme (light, dark and high contrast)
src/routeTree.gen.ts           written by TanStack Router; commit it, don't edit it
```

The to-do list lives in server memory, so it resets on restart. Swap in your own tools and data, and pass your
signed-in user's id as `owner` to `streamClaudeAgent` and `answerClaudeAgentApproval` so only that person can answer
the agent's requests.

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

Then, for example, a Premium block on the Claude Agent SDK:

```bash
npx shadcn@latest add @candor/approval-gated-change-claude
```

## Theme

`src/index.css` imports Candor's theme after Tailwind. Themes switch with `data-theme="light" | "dark" | "hc"` on
`<html>`; with no attribute they follow the system. Override colours by their shadcn names and everything else by its
`--cd-*` name after the import. Don't redefine `--font-sans` (shadcn's init does; this starter removed it), or point
it at `var(--cd-font)`.

## Learn more

- [`useClaudeAgent`](https://candor.themethodic.com/docs/use-claude-agent): the adapter's options and what it returns
- [Docs](https://candor.themethodic.com/docs): every component, its props and examples
- [Patterns](https://candor.themethodic.com/patterns): approvals, plans, runs, recovery and more
- [Principles](https://candor.themethodic.com/principles): why Candor shows what it shows
- [llms.txt](https://candor.themethodic.com/llms.txt): for coding agents choosing components

## Licence

This starter is MIT ([LICENSE](LICENSE)), as are Candor's free components. Pro and Premium items are under Candor's
commercial licence.
