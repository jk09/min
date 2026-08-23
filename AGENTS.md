# AGENTS.md - min browser

Instructions for the development of the `min` Web browser which should be read in its entirety before each agentic run. Agents SHOULD USE the [behavioral guidelines](CLAUDE-BEHAVIORAL-GUIDELINES.md) and [README](README.md).

## Git Repository
This repo is forked from the [`Min` source repo](https://github.com/minbrowser/min). The `master` branch is LOCKED except for the upstream updates.

## Original goals of `Min`

`Min` is a focused, fast browser  written entirely in JavaScript, allowing for distraction-free browsing.

### Browse without distractions 

Tabs in `Min` take up less space, giving you more room to browse the web. Pages you haven’t looked at in a while fade out, letting you see what’s important, and Focus Mode hides your other tabs to prevent you from getting distracted.

### Organize Everything

Min lets you search the full text of every page you've visited, right on your device. Tags let you easily organize your bookmarks, and Min will even learn from your bookmarks and suggest similar pages automatically.

### Stop Tab Chaos

Tasks let you easily group and organize your tabs. Keyboard shortcuts let you quickly switch between tasks, and tasks auto-collapse when you're not using them.

### Protect your privacy

Min blocks most ads and trackers automatically, so you can browse faster without being tracked, and we don't share your browsing history - [more](https://github.com/minbrowser/min/blob/master/docs/statistics.md).


## Project goals 

The goal of this fork is to implement an minimalistic browser whose workflow is driven by LLM prompts.
The `Min` browser session should resemble vibe coding (vibe browsing?).

- Keep the minimalistic character of the browser.
- Support agent-like workflows where users can define custom instructions or behaviors for discovery and navigation tasks.
- Configurable and extensible by LLM agents and skills, instead of built-in functionality and plugins

## Development conventions
- Prefer small, testable components with clear responsibilities such as  web/resource fetching, display/rendering, and agent/instruction handling.
- Keep user-facing output rich, readable, and structured; avoid noisy logging unless debugging is requested.
- Favor safe, read-only operations by default for browsing tasks; only perform mutations when the user explicitly asks for them.
- Preserve deterministic behavior and make external dependencies injectable where practical.
- When introducing new packages, prefer widely supported JavaScript libraries and keep dependencies minimal.

## Specifications

The specifications for individual features are in the [specification folder](./spec/). Its subfolders contain `SPEC.md` files, along with possible supplemental files. The names of the subfolders refer to the workflow status of the specified features: `backlog`, `in_progress`, `done`, `blocked`. The subfolder `done` expecially can be used to determine the rationale for certain features. The commits which contain the implementation of features may have the spec references in their commit messages.

## Feature ledger

Specifications record intent at a point in time; the [feature ledger](./spec/FEATURES.json) records what the application actually does now. It is the source of truth for the live feature set. See [docs/feature-ledger.md](./docs/feature-ledger.md) for the full design and [docs/features.md](./docs/features.md) for the generated feature documentation.

Every agentic run MUST:

1. Run `npm run features:context` and read the generated `spec/CONTEXT.md` before planning. It lists the active features and the features that must not be reintroduced.
2. Reuse an existing feature `id` when revising that feature. Do not create a second `active` entry for behaviour that already has one.
3. When replacing a feature, set the old entry to `superseded` (or `removed`, with a `removalReason`), clear its `sourceFiles` and `tests`, and delete the test files and documentation that belonged to it.
4. Keep tests matched to features across the `unit`, `integration` and `e2e` tiers, and list them on the ledger entry.
5. Run `npm run features:docs`, then `npm test` and `npm run test:unit`, then `npm run features:restamp -- <id> [...]` for every feature whose source files changed, before committing.

`npm run verify:features` runs as part of `npm test` and fails on stale, orphaned or inconsistent ledger entries.

## Agent commit behavior
- Automatically commit (`git commit ...`) the changes produced by each agentic run.
- The format of the commit message should follow the [commit message instructions](./.copilot-commit-message-instructions.md)
- Prefer committing only after the work is complete and verified, and avoid creating empty commits unless there is a meaningful reason.

## Notes for agents
- If the workspace grows, split guidance into focused docs rather than stuffing everything into this file.
- Link to existing docs instead of duplicating them.
- Prefer practical, actionable instructions over generic coding advice.
