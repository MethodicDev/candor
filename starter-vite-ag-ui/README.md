# Candor starter: Vite and AG-UI

A Vite app with a working agent chat built from [Candor UI](https://candor.themethodic.com)'s free components, talking
[AG-UI](https://docs.ag-ui.com), the protocol LangGraph, CrewAI, Mastra, Google ADK and Pydantic AI agents stream to a
browser. Clone it and it runs at once, with a scripted agent in the page and no backend. Point it at your own AG-UI
endpoint when you have one.

- **Vite 8**, **React 19**, **Tailwind 4**, **TypeScript**, shadcn initialised. No server: it builds to static files.
- **Candor's free items**, installed with the shadcn CLI and yours to edit: the theme, `Thread`, `Message`, `Composer`,
  `ToolCall`, `Reasoning`, `PromptSuggestions`, `PermissionPrompt` and the AG-UI adapter, `useAgUi`.
- **An agent at `VITE_AGENT_URL`.** `useAgUi` sends each message to it as a `RunAgentInput` and reads the AG-UI events
  it streams back: text, reasoning and tool calls become messages, and a run that stops on an **interrupt** (the agent
  asking you to approve a tool call) shows a permission prompt. Your answer starts the next run with `resume`.
- **No `VITE_AGENT_URL`: a scripted agent.** `src/app/scripted-agent.ts` replays AG-UI events in the browser, the way a
  server would. Ask it about your to-do list and it reads the list; ask it to add a task and it waits for your OK first.
  It isn't a model: its replies are fixed text, and the page says so.

> Generated from Candor UI 4.0.1: the Candor files in this starter are that release's. What changed since is in the [changelog](https://candor.themethodic.com/changelog).

## Get started

```bash
npx degit MethodicDev/candor/starter-vite-ag-ui my-agent-app
cd my-agent-app
npm install
cp .env.example .env.local
npm run dev
```

Or clone `https://github.com/MethodicDev/candor` and use its `starter-vite-ag-ui` folder.

If `npm install` prints `install-scripts … fsevents`, that is npm's newer policy of listing packages that have install
scripts. `fsevents` is the file watcher Vite uses on macOS, and it is optional: the starter installs, builds and runs with
it left unapproved, so you can ignore the warning.

### Use your own agent

Set `VITE_AGENT_URL` in `.env.local` to your AG-UI endpoint and restart the dev server:

```bash
VITE_AGENT_URL=http://localhost:8000/agent
```

The endpoint must accept a `POST` with a JSON `RunAgentInput` and answer with server-sent events. LangGraph, CrewAI and
the other frameworks above each have an AG-UI integration that adds such an endpoint to your server; follow its
[docs](https://docs.ag-ui.com). Two things to check:

- **Cross-origin requests.** The browser calls the endpoint directly, so the server must allow this page's origin
  (CORS, with `POST` and the `content-type` header). Or avoid it in development with a Vite proxy: set
  `VITE_AGENT_URL=/agent` and add `server: { proxy: { "/agent": "http://localhost:8000" } }` to `vite.config.ts`.
- **Secrets.** Vite puts every `VITE_` variable in the page, and the browser talks to the agent itself. Keep model keys
  on the agent's server, and if the endpoint needs authentication, pass `headers` to `useAgUi` from your own sign-in,
  never a key you ship.

Tool approvals are interrupts in AG-UI. If your agent never interrupts, nothing is asked; a tool call that doesn't wait
on a person simply runs, and shows in the thread. Candor doesn't run frontend tools for you: pass `tools` to `useAgUi`
and handle them where you need to.

### Environment variables

| Name | What it's for |
|---|---|
| `VITE_AGENT_URL` | Your AG-UI endpoint. Empty or unset: the scripted agent. Read when the app is built or the dev server starts, and visible in the page. |

## Where things are

```
src/main.tsx                the entry
src/app/app.tsx             the page: header, and which agent it talks to
src/app/chat-view.tsx       the chat: Thread, Message, Composer, PermissionPrompt, wired to useAgUi
src/app/scripted-agent.ts   the in-browser AG-UI agent used when VITE_AGENT_URL is empty: delete it once you have a real one
src/app/tool-title.ts       plain-words titles for the demo agent's tools
src/components/candor/      Candor components, installed from the registry (ui/ holds its primitives)
src/components/ui/          the starter's own primitives (shadcn's)
src/lib/candor/             Candor's shared types and helpers
src/styles/candor.css       Candor's theme (light, dark and high contrast)
```

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

## Theme

`src/index.css` imports Candor's theme after Tailwind. Themes switch with `data-theme="light" | "dark" | "hc"` on
`<html>`; with no attribute they follow the system. Override colours by their shadcn names and everything else by its
`--cd-*` name after the import. Don't redefine `--font-sans` (shadcn's init does; this starter removed it), or point
it at `var(--cd-font)`.

## Learn more

- [`useAgUi`](https://candor.themethodic.com/docs/use-ag-ui): the adapter's options and what it returns
- [Docs](https://candor.themethodic.com/docs): every component, its props and examples
- [Patterns](https://candor.themethodic.com/patterns): approvals, plans, runs, recovery and more
- [Principles](https://candor.themethodic.com/principles): why Candor shows what it shows
- [llms.txt](https://candor.themethodic.com/llms.txt): for coding agents choosing components

## Licence

This starter is MIT ([LICENSE](LICENSE)), as are Candor's free components. Pro and Premium items are under Candor's
commercial licence.
