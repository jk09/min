---
name: spec-implementation
description: 'Implement a repository feature specification end to end. Use when given a spec/SPEC.md path and the task requires a new branch, agent-led implementation, verification, and a compliant git commit.'
argument-hint: 'Path to a SPEC.md file, such as spec/backlog/feat-example/SPEC.md'
user-invocable: true
disable-model-invocation: false
---

# Spec Implementation

Implement one feature from a repository `SPEC.md`, keeping the work isolated and traceable from branch creation through commit.

## Inputs

Require a path to a specific `SPEC.md`. Resolve relative paths from the repository root. Do not guess between multiple specifications. If no path is supplied, ask the user to provide one.

## Procedure

1. Read the repository instructions that govern the work, especially `AGENTS.md`, and read the complete supplied `SPEC.md`. Also inspect the repository status and current branch.
2. Validate the spec path before changing git state:
   - The path must point to an existing file named `SPEC.md` inside `spec/`.
   - Extract the feature directory name immediately above `SPEC.md`; it must be a descriptive slug such as `feat-a7k3p9-llm-prompt-panel`.
   - Use that feature directory name as the branch name unless the user explicitly provides another branch name.
   - Stop and ask before proceeding if the worktree has changes that could be affected, the branch already exists, or the requested branch is the protected default branch.
3. Create and switch to the feature branch from the current `HEAD` using a non-interactive git command. Confirm that the new branch is checked out before editing.
4. Treat the supplied specification as the source of truth. Inspect the smallest relevant implementation surface, state a falsifiable local hypothesis about the controlling code path, and identify a focused check that could disconfirm it before the first edit.
5. Implement the specification in the repository. Preserve existing conventions, public APIs, and unrelated user changes. Add or update focused tests when the specification or risk warrants them.
6. Validate the implementation with the narrowest useful executable checks first, then run broader project checks when practical. Do not commit while relevant checks are failing. Report any unavailable or unrelated failing checks instead of hiding them.
7. Review the final diff and status for scope, generated files, secrets, and accidental changes. Confirm that the acceptance criteria in the specification are addressed.
8. Commit only the changes produced for this run. Use the repository-required format:

   ```text
   <type>(<scope>): <short description>

   Spec: <invariant spec path>

   <Markdown summary of the implementation and verification>
   ```

   The invariant spec path removes workflow directories such as `in_progress`, `backlog`, `blocked`, and `done`; for example, `spec/done/feat-example/SPEC.md` is referenced as `feat-example/SPEC.md` when `AGENTS.md` requires that convention.
9. Verify the commit with `git status --short --branch` and `git log -1 --oneline`. Summarize the branch, commit, implementation, and verification results.

## Decision Points

- If the spec is incomplete, contradictory, or missing acceptance criteria, pause and ask a focused question before editing.
- If the current worktree is dirty, do not automatically stash, reset, or include unrelated changes. Ask the user whether to proceed after identifying the affected files.
- If implementation reveals that another specification or a broader architectural change is required, pause rather than silently expanding scope.
- If tests cannot run because dependencies or platform services are unavailable, continue only when a meaningful alternative check exists and clearly record the limitation.
- If a commit hook changes files or fails, inspect the result, repair only this run's changes, and rerun the same validation and commit deliberately.

## Completion Criteria

The workflow is complete only when:

- The requested feature branch was created from the starting `HEAD` and is checked out.
- The supplied specification's acceptance criteria are implemented or explicitly reported as blocked.
- Focused executable validation was run and its result is known.
- The final diff contains only this run's intended changes.
- A compliant commit exists and its hash/message are reported.

Never use destructive git commands such as `reset --hard` or `checkout --` to clean up the workspace. Never commit unrelated user changes.
