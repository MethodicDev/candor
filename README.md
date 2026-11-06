# Candor UI: the free tier

Interface components for agent apps: a thread, messages, a composer, tool calls, reasoning and citations, the
building blocks under them, a light, dark and high-contrast theme, and adapters for the Vercel AI SDK, the Claude
Agent SDK and AG-UI. Built on shadcn, installed with its CLI, MIT licensed.

This repo is the source of Candor UI's 52 free items (version 1.5.1), the skill for coding agents and a
starter app. Docs and live examples: **https://candor.themethodic.com**.

## Install

```bash
npx candor-ui init
npx candor-ui add thread message composer
```

`candor-ui init` adds the `@candor` registry to `components.json` and the theme to your CSS; in a project without
shadcn yet it runs shadcn's setup first (`--yes` sets it up with Radix and shadcn's nova preset, no questions). Or add the registry by
hand: `"@candor": "https://candor.themethodic.com/r/{name}.json"`. If shadcn asks to overwrite a primitive such as
`ui/button.tsx`, answer yes: Candor's button styles locked actions; without a terminal, pass `--overwrite`.

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
- `ag-ui`: Turns AG-UI events into Candor messages, waiting approvals and usage, with AG-UI 1.0's shared state and activities.
- `ai-sdk`: Vercel AI SDK (v7) UI messages to Candor messages: text, reasoning, tool calls, sources and data cards.
- `claude-agent-sdk`: Turns Claude Agent SDK events into Candor messages, waiting approvals (and the agent's questions), usage and sources, and a person's answer back into the SDK's result.
- `claude-agent-server`: The server half of the Claude Agent SDK adapter: stream a run to useClaudeAgent, keep its permission requests in a store your own route can answer, and let a browser re-attach to a run after a reload.
- `use-ag-ui`: Wires an AG-UI agent to Candor: messages for <Thread>/<Message>, props for <Composer>, and the interrupts waiting on a person.
- `use-candor-chat`: Wires a `useChat()` result to Candor: messages for <Thread>/<Message>, props for <Composer>, and the tool calls waiting on a person.
- `use-claude-agent`: Wires a Claude Agent SDK server route to Candor: messages for <Thread>/<Message>, props for <Composer>, and the tool calls waiting on a person, re-attaching to a run after a reload.
- `copy-field`: A value a person copies somewhere else (a callback URL, a scope list).
- `degraded-panel`: Something couldn't be done.
- `locale`: The interface's words, language and direction.
- `locked`: The honest-state rule: a control that cannot be used says why.
- `relative-time`: A time as people say it ("5 minutes ago"), with the exact time on hover, safe to render on the server.
- `status-dot`: A small status mark.
- `step-list`: An ordered list of steps joined by a rail: an agent's plan, its reasoning, a run's stages.
- `streaming-text`: Text that is still arriving.
- `surface`: Candor's card: a plain, muted, bordered or floating surface, so no screen hand-rolls its own.
- `terms`: The app's words for its own concepts, so components read like the product: one app says "org", another "project" or "workspace".
- `agent-avatar`: An agent's glyph and hue by role, so people can tell agents apart at a glance.
- `ai-disclosure`: A plain notice that the person is interacting with an AI system: a first line in the thread (`variant="line"`) or a compact "AI" badge for a thread header (`variant="badge"`) that opens to the app's own explanation.
- `attachment-preview`: A file waiting to be sent, as a chip in the composer: its name, then upload progress, an error, or its size, and a remove button.
- `card-registry`: A card an agent's reply can carry.
- `citation`: An inline [n] that opens its source in a popover, so evidence is one step away without leaving the thread.
- `composer`: Where a person writes to the agent: @ mentions attach things as references, / starts a known action, and the scope says where the ask runs.
- `context-meter`: What fills the model's context budget, as a ring in the composer that opens to a breakdown: system, instructions, Know, the thread, tools, files.
- `entity-chip`: A thing in the user's system (a table, a record, a flow) as a chip with its kind's icon, that can open it.
- `folded-turns`: A run of turns folded into one line, for long agent work a reader doesn't need to see step by step: "Drafted three versions and compared them".
- `message-actions`: Copy, retry and rate under an agent's reply.
- `message-content`: A message's typed blocks (paragraphs, lists, code, tool calls, cards), rendered as text, never as markdown or HTML.
- `message`: One message in a thread.
- `payload`: A block of code or query text from the agent: a query it ran, code it wrote, a config file.
- `permission-prompt`: A tool call waiting for a person's go-ahead: what it will do, why it reached them, and the permission mode the run is in.
- `prompt-suggestions`: Prompts to start from.
- `reasoning`: The agent's stated reasoning above its answer.
- `thread-divider`: A rule across the thread with a label in the middle: a day ("Today", "Yesterday", "5 Nov 2026") or a chapter of the conversation ("Drafting", "Review").
- `thread-event`: A quiet, centred line in a thread for something that happened rather than something said: "Sam joined", "Switched to the staging environment", "Run stopped by a guardrail".
- `thread`: The scrolling message column.
- `tool-call`: One tool call as a compact row: what it did in plain words, its status, and how long it took.
- `chat`: The data a Candor thread renders.
- `highlight`: A small syntax highlighter for code an agent shows: it splits text into typed tokens (keyword, string, comment…), and Payload renders each as a span.
- `know`: The data behind the agents' knowledge base and agent settings.
- `render-prop`: Lets Candor's Radix-based primitives also take Base UI's `render` prop.
- `safe-markdown`: Reads model text as safe markdown: paragraphs, lists and fenced code.
- `status`: The status vocabulary every Candor agent component shares.
- `use-copy`: Copy text and report what actually happened.
- `use-shortcut`: The keys of a combo as they should be printed: "mod+k" → ["⌘", "K"] on a Mac and ["Ctrl", "K"] elsewhere.
- `use-virtual-list`: Render only the items of a long list that are in or near view, for Thread's and SessionList's `virtualize`.
- `button`: shadcn's button in Candor's theme, with a locked state for <Locked> (dimmed, and says why).
- `collapsible`: shadcn's collapsible (Radix) in Candor's theme.
- `popover`: shadcn's popover (Radix) in Candor's theme.
- `skeleton`: A loading placeholder in the shape of what's coming.
- `tooltip`: shadcn's tooltip (Radix) in Candor's theme.

## Pro and Premium

Plans, approvals, diffs, runs, evals, the app shell, admin screens, full-stack blocks and templates are in the paid
tiers: https://candor.themethodic.com/#pricing.

## Contributing

This repo is generated from Candor UI's main repo on each release. Issues are welcome here; pull requests are read and
applied upstream by hand, so they show up in the next release rather than being merged directly.

## Licence

MIT, © Methodic LLC. See `LICENSE`. It covers this repository's free items; Candor UI's paid items are under the
[Candor UI Commercial Licence](https://candor.themethodic.com/licence).
