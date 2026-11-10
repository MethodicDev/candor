## UI components

UI components come from the @candor shadcn registry; read https://candor.themethodic.com/llms.txt before choosing one,
and keep its honesty rules. Installed Candor components live in `src/components/candor/` and `src/lib/candor/`; the starter's own
code is in `src/app/`.

The agent is an AG-UI endpoint at `VITE_AGENT_URL`. With it unset, `src/app/scripted-agent.ts` plays a short run in the
browser. `useAgUi` (from `src/components/candor/use-ag-ui.ts`) turns the events into messages and approvals.
