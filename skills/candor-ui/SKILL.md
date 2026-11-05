---
name: candor-ui
description: Build agent product UIs with Candor UI, a shadcn/ui registry of React components for agents that do real work - chat, tool calls, plans, approvals, diffs, run logs, traces, evals, admin and the app shell around them. Use when building or changing a React or Next.js interface for an AI agent, when the project's components.json lists the @candor registry, or when the user mentions Candor. Covers installing components, choosing the right one, wiring the Vercel AI SDK or Claude Agent SDK adapter, and the honesty rules every Candor screen follows.
---

# Candor UI

Candor UI is a shadcn/ui registry: components are copied into the project with the shadcn CLI and then belong to
it. Every component takes plain, typed data, so it works with any model or backend; adapters map the Vercel AI SDK
and the Claude Agent SDK onto that data.

## Set up the registry

Add the registry to `components.json` once. Free items need nothing more:

```json
{ "registries": { "@candor": "https://candor.themethodic.com/r/{name}.json" } }
```

Pro and Premium items need the buyer's licence key. Put it in `.env.local` as `CANDOR_LICENSE_KEY` (never in a
committed file) and send it as a header. The shadcn CLI stops with an error if a variable it names is missing, so
only add the header when the key is set:

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

To let a coding agent browse and install Candor items itself, run `npx shadcn@latest mcp init --client claude` (or
`cursor`, `vscode`, `codex`): shadcn's MCP server serves every registry in `components.json`.

Then install the theme first, and the components you need; their dependencies come with them:

```bash
npx shadcn@latest add @candor/theme @candor/thread @candor/message @candor/composer
```

Import the theme after Tailwind in the global CSS: `@import "./styles/candor.css";`. Themes switch with
`data-theme="light" | "dark" | "hc"` on `<html>`.

## Choose components

Read `references/components.md` for every item, grouped by job, with its tier and what it exports. Pick by the job
the screen does, not by name similarity:

- **A conversation with an agent:** `thread`, `message`, `composer`, `tool-call`, `reasoning`, `citation`,
  `prompt-suggestions`.
- **Work the agent proposes or does:** plans, approvals, diffs, run logs and run receipts are under *work*.
- **Trust and control:** `locked` for controls a person can't use (it says why), `approval-request` and
  `approval-queue` for decisions, `blast-radius` for what a change touches, `audit-log`.
- **Operating agents:** *ops*, *evals*, *admin* and *billing* hold traces, scorecards, permissions and usage.
- **The app around it:** *shell* (layout, sidebar, command menu, session list) and *team*.

Install only what the screen needs. Check an item's props in its source after installing; don't guess them.

## Wire an agent

**Vercel AI SDK 7:** `useCandorChat(useChat(...), { agent })` returns `{ messages, composer, approvals, respond }`.

**Claude Agent SDK:** on the server, `streamClaudeAgent(({ canUseTool, abortController }) => query({ prompt,
options: { canUseTool, abortController, resume: sessionId, includePartialMessages: true } }), { signal:
request.signal, owner: userId })`; a second route calls `answerClaudeAgentApproval(id, approved, reason, userId)`. In
the browser, `useClaudeAgent({ api, approveApi, agent })` returns the same shape plus `usage`. The agent must run on
one long-running Node process (approvals wait in its memory), not spread over serverless instances.

Both render the same way:

```tsx
<Thread footer={<Composer {...composer} />}>
  {messages.map((m) => <Message key={m.id} message={m} />)}
</Thread>
```

Show `approvals` with Allow and Deny buttons and call `respond(id, approved, reason?)`. Never approve on the user's
behalf.

## The honesty rules

Candor screens are built so a person can trust what an agent did. Keep these when you build with it:

- **Never render model output as HTML or as a clickable link.** Adapters read model text as a safe subset of
  markdown; links become plain text. Don't bypass this with `dangerouslySetInnerHTML` or a markdown renderer.
- **Unknown stays unknown.** If the service didn't measure a duration, cost or count, leave it empty. Never estimate
  one and present it as measured; an SDK's estimate is labelled as an estimate.
- **Reasoning is believed, not verified.** Show model reasoning as the model's own account.
- **A control that can't be used says why.** Use `locked` with a reason instead of a disabled button with no
  explanation.
- **Nothing is pre-selected** in a decision a person has to make (approve or deny, a destructive choice).
- **The agent is always named,** from your app's data, never from model output. System lines are your app's own
  strings.
- **Destructive actions confirm by typing,** and say what can and can't be undone.

## Next.js and React Server Components

Components that need the browser are marked `"use client"`; display pieces stay server components. Put providers
that take icons or functions (`AgentRolesProvider`, `EntityKindsProvider`, `CardRegistryProvider`, presets) in one
client providers file. Event handlers and helpers exported from client modules (`formatRelative`, `defineCard`,
`toast`) belong in client code.

## Make it the product's own

- Override colour and type tokens in a CSS file imported after `candor.css` (shadcn names such as `--primary`,
  plus Candor's `--cd-*` and status pairs like `--success-weak` / `--success-text`), for every theme you support.
- `TermsProvider` sets the app's words ("project", "workspace"); `EntityKindsProvider` and `AgentRolesProvider`
  register its entity types and agent roles. Policy (who may do what, why something is locked) stays in the app and
  arrives as props.
