# Security policy

## Report a vulnerability privately

Email **info@themethodic.com** with "Security" in the subject, or use GitHub's private report: the **Report a
vulnerability** button on this repository's Security tab. Please don't open a public issue or pull request for a
vulnerability, and don't put a licence key, token or other secret in any report.

A good report says what you found, where (the item, package, URL or file, and the version), the steps to reproduce it
and what an attacker could do with it. A short proof of concept is enough.

## What to expect

- A first reply within 2 business days (Monday to Friday, US public holidays excepted).
- A first assessment, saying whether we can reproduce it and how serious we think it is, within 7 days of that reply.
- A fix in the next release, or a patch release if it can't wait. Every version stays installable, but fixes are made in
  the newest one, so that is the version we test against and support.
- Credit in the changelog's entry for the fix if you want it, and not if you don't.

This is a small company, not a security team, and these are targets we plan to keep. If we miss one we'll say so.

## What is in scope

- **The registry** at `https://candor.themethodic.com/r/` (free items served as static files, paid items behind a
  licence check) and the **licence check** itself: bypassing it, reading a paid item without a key for it, or getting
  another person's key or data out of it.
- **The docs MCP server** at `https://candor.themethodic.com/mcp`, which is meant to be read-only and keyless and never
  to serve paid source.
- **The components' source in this repository**: for example a component that renders model output as HTML or a live
  link (Candor's first rule is that it never does), or one that leaks data it was given.
- **The starters** (`starter/`, `starter-vite-ag-ui/`, `starter-tanstack-start-claude/`): for example an exposed
  secret, an unauthenticated route that runs an agent, or an unsafe default.
- **The npm packages** `candor-ui` (the CLI) and `@candor-ui/react`.

## What is not

- Your own application built with Candor, and configuration choices you made in it. If the kit's code made it easy to
  get wrong, tell us anyway: that is a report about the kit.
- Vulnerabilities in a dependency (React, Next.js, shadcn, the agent SDKs). Report those to their maintainers; tell us
  if Candor pins or exposes the affected version.
- Findings that need a licence key you don't hold, other people's accounts, social engineering of the people behind the
  project, or denial-of-service and load testing against `candor.themethodic.com`.

## Safe testing

Test the registry and the MCP server with your own key or none, at a pace a person would use, and stop as soon as you
can show the problem. Don't read, change or keep other people's data.
