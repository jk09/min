---
name: feature-spec-generator
description: Generate a feature specification from a short feature description using the repository's feature spec template.
---

# Feature Spec Generator

Use this skill to create a new feature specification from a concise description of the feature or work item.

## When to use this skill
Use this skill when you need to draft a new feature specification for the repository based on a short prompt, idea, or backlog note.

## Inputs
- A short description of the feature or problem to solve.
- Optional context such as user type, desired behavior, constraints, or related references.

## Output
Create a new Markdown feature specification file in the backlog folder using the repository's feature-spec template.

## Workflow
1. Read the repository's feature spec template from [spec/feature-spec-template.md](../../../spec/feature-spec-template.md).
2. Infer a concise feature title and summary from the provided description.
3. Fill in the template sections with reasonable placeholder content where the input is incomplete.
4. Set the metadata fields as follows:
   - Created on: use the current date and time.
   - Owner: use the current git author/committer identity from the repository.
5. Save the generated specification in a new folder under [spec/backlog](../../../spec/backlog) by default; only use a different location if the user explicitly requests one.
6. Use a folder name that exactly follows this pattern: `<type>-<alpha>-<desc>` where:
   - `<type>` is `feat`, `fix`, or another short type label matching the nature of the work.
   - `<alpha>` is a random lowercase alphanumeric string of at least 6 characters.
   - `<desc>` is a short description inferred from the feature input.
   - The full folder name must be filename-safe for both Windows and POSIX systems.
7. Place the main document in the folder as `SPEC.md`.
8. Preserve the structure and placeholders from the template so the spec remains easy to refine later.

## Quality bar
- The generated document should follow the repository template closely.
- It should be readable, structured, and suitable for further editing.
- It should include realistic placeholders when the prompt is sparse.
- It should not invent unsupported implementation details unless they are clearly implied by the request.

## Example prompt
Create a feature specification for a browser action that lets users save a tab as a reusable workspace.
