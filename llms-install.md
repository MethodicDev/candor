# Installing Candor UI as a coding agent

Candor UI is a shadcn/ui registry of React components for agents that do real work. This file is for a coding agent
setting Candor up inside a person's project. Everything here is free: the free tier is MIT, the skill is MIT, and the
docs MCP server needs no key.

## 1. Add the registry and the first components

From the project root (a React or Next.js app, with or without shadcn already set up):

```bash
npx candor-ui@latest init --yes
npx candor-ui add thread message composer
```

`init --yes` adds the `@candor` registry to `components.json`, the theme and its import, and sets up shadcn if the
project has none (Radix, shadcn's nova preset, no questions). `add` copies the named items into the project:
primitives in `@/components/ui/…`, libraries and types in `@/lib/…`, everything else in `@/components/…`. Import from
those paths. If shadcn asks to overwrite a primitive such as `ui/button.tsx`, answer yes, or pass `--overwrite`.

Pro and Premium items need the buyer's licence key. The person runs `npx candor-ui key <key>` themselves; never ask
for the key in chat or write it into a file. `npx candor-ui doctor` explains anything that looks wrong.

## 2. Connect the docs MCP server

`https://candor.themethodic.com/mcp` is a remote streamable HTTP server. It is read-only and keyless: it serves docs,
patterns and component suggestions, never component source and never paid items. Its tools are
<!-- facts:mcp-tools -->`search_docs`, `get_component_docs`, `suggest_components`, `list_components`, `get_pattern`, `list_screens`, `get_screen`, `get_started`, `get_brief`, `get_design`, `get_review_checklist`, `theme_check` and `item_changes`<!-- /facts:mcp-tools -->.

Claude Code:

```bash
claude mcp add --transport http candor https://candor.themethodic.com/mcp
```

Cursor (`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json`):

```json
{ "mcpServers": { "candor": { "url": "https://candor.themethodic.com/mcp" } } }
```

Codex:

```bash
codex mcp add candor --url https://candor.themethodic.com/mcp
```

or in `~/.codex/config.toml`:

```toml
[mcp_servers.candor]
url = "https://candor.themethodic.com/mcp"
```

VS Code (`.vscode/mcp.json`, or the user profile's `mcp.json`):

```json
{ "servers": { "candor": { "type": "http", "url": "https://candor.themethodic.com/mcp" } } }
```

GitHub Copilot CLI:

```bash
copilot mcp add --transport http candor https://candor.themethodic.com/mcp
```

Without the MCP, every docs page is Markdown at `https://candor.themethodic.com/docs/<name>.md`, indexed in
`https://candor.themethodic.com/llms.txt`.

## 3. Install the skill, or the whole plugin

The `candor-ui` skill says which component fits which job, how the Vercel AI SDK, Claude Agent SDK and AG-UI adapters
are wired, and the rules every Candor screen keeps. On its own:

```bash
npx skills add MethodicDev/candor
```

As a plugin, the skill and the MCP server arrive together from the public repo `MethodicDev/candor`:

- **Claude Code:** `claude plugin marketplace add MethodicDev/candor`, then `claude plugin install candor-ui@candor`;
  inside a session, `/plugin install candor-ui --marketplace MethodicDev/candor` does both. The plugin is the repo
  root: `.claude-plugin/plugin.json` declares the `candor` MCP server, `skills/candor-ui` is the skill.
- **GitHub Copilot CLI:** `copilot plugin marketplace add MethodicDev/candor`, then
  `copilot plugin install candor-ui@candor`. The marketplace is `.github/plugin/marketplace.json`; the plugin is the
  Agent Plugins 1.0 package at `plugins/vscode/candor-ui`.
- **VS Code:** install from source with the repo URL `https://github.com/MethodicDev/candor` and the plugin name
  `candor-ui` (**Chat: Install Plugin from Source**, or
  `vscode://chat-plugin/install?source=https%3A%2F%2Fgithub.com%2FMethodicDev%2Fcandor&plugin=candor-ui`).
- **Cursor:** `.cursor-plugin/marketplace.json` lists the Cursor plugin at `plugins/cursor/candor-ui`. A team imports
  the repo as a marketplace from its GitHub URL; one person copies that folder to `~/.cursor/plugins/local/candor-ui`
  and reloads the window.
- **Codex:** copy `plugins/codex/candor-ui` to the project's `plugins/candor-ui` and list it in
  `.agents/plugins/marketplace.json`:

  ```json
  {
    "name": "candor",
    "interface": { "displayName": "Candor" },
    "plugins": [
      {
        "name": "candor-ui",
        "source": { "source": "local", "path": "./plugins/candor-ui" },
        "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
        "category": "Productivity"
      }
    ]
  }
  ```

  Then install it from the Plugins directory. The MCP server declares `auth.type: "none"`, so no sign-in follows.

## 4. Keep the honesty rules

Candor screens are built so a person can trust what an agent did. When you build with it, keep these, which are
explained at https://candor.themethodic.com/principles:

- Never render model output as HTML or as a clickable link; the adapters read it as a safe subset of markdown.
- Unknown stays unknown: a duration, cost or count the service didn't measure stays empty, never estimated and shown
  as measured.
- A control that can't be used says why (`locked` with a reason), rather than a disabled button with no explanation.
- Nothing is pre-selected in a decision a person has to make.
- Reasoning is shown as the model's own account, not as verified fact.
- The agent is named from the app's data, never from model output.
- Destructive actions confirm by typing and say what can and can't be undone.
- Never approve on the person's behalf, and never tick "always allow" for them.

Check a component's props in its docs page or its source after installing; don't guess them.
