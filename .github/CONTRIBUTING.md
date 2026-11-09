# Contributing

This repository is generated, on each release, from Candor UI's private source. So a pull request here is never merged
as it is: it is read, and if it is accepted it is applied upstream by hand and reaches everyone in the next release.

## How a pull request gets in

1. Open it against this repository, for one of the free items, a starter, the skill or the docs it holds. Paid items
   aren't here, so a pull request can't change them.
2. It is read. If it is accepted, the change is made in the private source, with a test where there is behaviour, and
   goes out in the next release.
3. That release's changelog entry names you and the pull request. Your commit isn't carried over, so the changelog is
   where the credit is.
4. The pull request is closed with a link to the release that holds the change. If it isn't accepted, it is closed with
   the reason.

Every release is reviewed over its full diff before it is merged, so a contributed change is reviewed twice: once when
it is read, and again in the release.

## Before you open one

- For anything larger than a fix, open an issue first so we can say whether it fits. New work usually goes to the paid
  tiers; fixes to a free item reach everyone.
- Keep to Candor's rules: model output is text, never HTML or a link; unknown stays unknown; a control that can't be
  used says why; nothing is pre-selected in a decision. They are listed at https://candor.themethodic.com/principles.
- Every interface string goes through the locale provider rather than being written into the component, and every
  optional prop is typed `name?: T | undefined`.
- Don't edit `registry.json` or anything under a starter's `components/` or `src/components/` by hand to change a
  Candor item: those files are copies. Change the item's own source file.
- By opening a pull request you agree that your change is under this repository's MIT licence.

Security problems go to [SECURITY.md](SECURITY.md), not to a pull request. Help with using Candor is in
[SUPPORT.md](SUPPORT.md).
