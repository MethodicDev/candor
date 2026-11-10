## UI components

UI components come from the @candor shadcn registry; read https://candor.themethodic.com/llms.txt before choosing one,
and keep its honesty rules. Installed Candor components live in `src/components/candor/` and `src/lib/candor/`; the starter's own
code is in `src/app/` and `src/routes/`.

The agent runs in `src/routes/api/agent/index.ts` (the Claude Agent SDK, through `streamClaudeAgent`), and the page's
`useClaudeAgent` talks to it. `ANTHROPIC_API_KEY` is read on the server only. Keep it out of anything the browser imports.
