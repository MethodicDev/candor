---
name: candor-ui
description: Build agent product UIs with Candor UI, a shadcn/ui registry of React components for agents that do real work - chat, tool calls, plans, approvals, diffs, run logs, traces, evals, admin and the app shell around them. Use when building or changing a React or Next.js interface for an AI agent, when the project's components.json lists the @candor registry, or when the user mentions Candor. Covers installing components, choosing the right one, wiring the Vercel AI SDK, Claude Agent SDK or AG-UI adapter, and the honesty rules every Candor screen follows.
---

# Candor UI

Candor UI is a shadcn/ui registry: components are copied into the project with the shadcn CLI and then belong to
it. Every component takes plain, typed data, so it works with any model or backend; adapters map the Vercel AI SDK,
the Claude Agent SDK and AG-UI onto that data.

## Set up and install

Use the `candor-ui` CLI; it wraps the shadcn CLI and keeps a lockfile so updates can merge.

```bash
npx candor-ui@latest init --yes        # registry in components.json, the theme, its import; sets up shadcn if missing
npx candor-ui add thread message composer
```

- **Where files land:** `ui` primitives in `@/components/ui/…`, libraries and types in `@/lib/…` (for example
  `@/lib/chat`), everything else in `@/components/…` (for example `@/components/thread`). Import from those paths;
  the `@/registry/…` paths in Candor's own repo don't exist in an app.
- **Client components:** anything with state or handlers needs `"use client"` at the top in the Next.js App Router.
- **Pro and Premium items** need the buyer's licence key. The person runs `npx candor-ui key <key>` themselves (it
  goes in `.env.local`, which must stay out of git); never ask for the key in chat or put it in a file you write. In
  CI, `CANDOR_LICENSE_KEY` is a secret.
- **Updates:** `npx candor-ui update` brings installed items to the latest release and keeps local changes with a
  three-way merge; commit `candor-lock.json`.
- **When something looks wrong:** `npx candor-ui doctor` checks the registry, the key, the theme import, dark mode,
  React and Tailwind, and says how to fix each.

Without the CLI, add `"@candor": "https://candor.themethodic.com/r/{name}.json"` to `components.json` and run
`npx shadcn@latest add @candor/<name>` (for paid items the registry entry needs
`"headers": { "Authorization": "Bearer ${CANDOR_LICENSE_KEY}" }`). `npx shadcn@latest mcp init --client claude` lets a
coding agent browse the registry.

Themes switch with `data-theme="light" | "dark" | "hc"` on `<html>`.

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

**AG-UI:** `useAgUi({ url: "/api/agent", agent })` returns the same `{ messages, composer, approvals, respond }`; a
run that ends on an interrupt shows it in `approvals`, and `respond` resumes it.

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
