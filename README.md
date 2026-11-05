# Candor UI: the free tier

Interface components for agent apps: a thread, messages, a composer, tool calls, reasoning and citations, the
building blocks under them, a light, dark and high-contrast theme, and adapters for the Vercel AI SDK, the Claude
Agent SDK and AG-UI. Built on shadcn, installed with its CLI, MIT licensed.

This repo is the source of Candor UI's 43 free items (version 1.0.1), the skill for coding agents and a
starter app. Docs and live examples: **https://candor.themethodic.com**.

## Install

```bash
npx candor-ui init
npx shadcn@latest add @candor/thread @candor/message @candor/composer
```

`candor-ui init` adds the `@candor` registry to `components.json` and the theme to your CSS. Or add the registry by
hand: `"@candor": "https://candor.themethodic.com/r/{name}.json"`.

## For coding agents

```bash
npx skills add MethodicDev/candor
```

installs `skills/candor-ui`: which component fits which job, the adapters, and the rules the components keep. Agents
can also read https://candor.themethodic.com/llms.txt.

## Starter

`starter/` is a Next.js app with a working agent chat built from these components:

```bash
npx degit MethodicDev/candor/starter my-agent-app
```

## What's here

- `theme`: Candor's default theme: light, dark and high contrast, contrast-checked. Import styles/candor.css after Tailwind.
- `ag-ui`: Turns AG-UI events into Candor messages, waiting approvals and usage.
- `ai-sdk`
- `claude-agent-sdk`: Turns Claude Agent SDK events into Candor messages, waiting approvals and usage.
- `claude-agent-server`: Send a typed card to the browser, e.g.
- `use-ag-ui`: Wires an AG-UI agent to Candor: messages for <Thread>/<Message>, props for <Composer>, and the interrupts waiting on a person.
- `use-candor-chat`: Wires a `useChat()` result to Candor: messages for <Thread>/<Message>, props for <Composer>, and the tool calls waiting on a person.
- `use-claude-agent`: Wires a Claude Agent SDK server route to Candor: messages for <Thread>/<Message>, props for <Composer>, and the tool calls waiting on a person.
- `copy-field`: A value a person copies somewhere else (a callback URL, a scope list).
- `degraded-panel`: Something couldn't be done.
- `locked`: The honest-state rule: a control that cannot be used says why.
- `relative-time`
- `status-dot`: A small status mark.
- `step-list`: An ordered list of steps joined by a rail: an agent's plan, its reasoning, a run's stages.
- `streaming-text`: Text that is still arriving.
- `surface`
- `terms`: The app's words for its own concepts, so components read like the product: one app says "org", another "project" or "workspace".
- `agent-avatar`
- `card-registry`: A card an agent's reply can carry.
- `citation`: An inline [n].
- `composer`: Where a person asks.
- `context-meter`: What fills the model's context budget, as a ring in the composer that opens to a breakdown: system, instructions, Know, the thread, tools, files.
- `entity-chip`: The kinds of thing your app's entities can be: an icon and a noun each.
- `message-actions`: Copy, retry and rate under an agent's reply.
- `message-content`: Inline nodes.
- `message`: One message in a thread.
- `payload`: A block of code or query text from the agent: a query it ran, code it wrote, a config file.
- `prompt-suggestions`: Prompts to start from.
- `reasoning`: The agent's stated reasoning above its answer.
- `thread`: The scrolling message column.
- `tool-call`: One tool call as a compact row: what it did in plain words, its status, and how long it took.
- `chat`: The data a Candor thread renders.
- `know`: The data behind the agents' knowledge base and agent settings.
- `render-prop`: Lets Candor's Radix-based primitives also take Base UI's `render` prop.
- `safe-markdown`: Reads model text as safe markdown: paragraphs, lists and fenced code.
- `status`: The status vocabulary every Candor agent component shares.
- `use-copy`: Copy text and report what actually happened.
- `use-shortcut`: The keys of a combo as they should be printed: "mod+k" → ["⌘", "K"] on a Mac and ["Ctrl", "K"] elsewhere.
- `button`
- `collapsible`
- `popover`
- `skeleton`
- `tooltip`

## Pro and Premium

Plans, approvals, diffs, runs, evals, the app shell, admin screens, full-stack blocks and templates are in the paid
tiers: https://candor.themethodic.com/#pricing.

## Contributing

This repo is generated from Candor UI's main repo on each release. Issues are welcome here; pull requests are read and
applied upstream by hand, so they show up in the next release rather than being merged directly.

## Licence

MIT, © Methodic LLC. See `LICENSE`.
