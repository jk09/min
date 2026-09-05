# Feature Specification Template

## 1. Feature Title
- **Feature name:** TypeScript support and intellisense across the codebase
- **Created on:** 2026-09-05T12:08:00+02:00
- **Owner:** Jozef Košík <jozef.kosik@gmail.com>

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** The codebase is written in vanilla JavaScript without comprehensive TypeScript definitions or type-checking configuration. This limits compile-time type safety, IDE code completion (intellisense), refactoring confidence, and early detection of type mismatches and missing properties.
- **Desired outcome:** Enable first-class TypeScript support across the entire codebase by introducing a tuned TypeScript configuration (`tsconfig.json`), ambient and module type definitions (`types/`), development dependencies (`typescript`, `@types/node`), type-checking scripts (`npm run typecheck`), and build pipeline support for TypeScript source modules.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** JavaScript files in `js/`, `main/`, `scripts/`, `pages/`, and `test/` rely on runtime execution without static type verification. Window globals (`tabs`, `tasks`, `ipc`, `electron`, `globalArgs`, `l`, etc.) and internal APIs lack static type declarations, resulting in `any`/untyped inferences in IDEs.
- **Motivation:** Adding TypeScript tooling and type declarations gives developers rich auto-completion, parameter hints, type verification via `tsc`, and seamless authoring in both TypeScript and JavaScript without requiring a destructive full-codebase rewrite.
- **Related issues or references:** [package.json](../../../package.json), [js/default.js](../../../js/default.js), [main/main.js](../../../main/main.js).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Provide a root `tsconfig.json` that covers the main process, renderer process, helper pages, scripts, and tests with type safety and intellisense enabled.
- Goal 2: Provide global and module type declarations for Min's runtime environment, electron integrations, browser tools, prompt runtime, and window globals.
- Goal 3: Provide automated type checking via `npm run typecheck` (`tsc --noEmit`) that runs cleanly without errors.
- Goal 4: Ensure the build pipeline supports importing/compiling TypeScript files alongside existing JavaScript modules.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Forcibly renaming every existing `.js` file to `.ts` in a single pass; `allowJs: true` and `checkJs: true` provide immediate typechecking and intellisense over existing files while allowing incremental conversion to `.ts`.
- Non-goal 2: Changing runtime behavior or user-facing browser UI features.

## 6. User Stories
Capture the expected user experience.

- As a developer, I want type safety and intellisense in my editor when working on Min so that I can discover APIs and catch type errors early.
- As a contributor, I want to run `npm run typecheck` to verify that all modules and type definitions conform to TypeScript types.
- As a maintainer, I want to be able to write new modules in TypeScript (`.ts`) and have them work seamlessly with the build and test suites.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Requirement 1: `package.json` includes `typescript` and relevant `@types/*` in `devDependencies`.
2. Requirement 2: `tsconfig.json` is configured with modern ECMAScript target (ES2022/Node22), node resolution, `allowJs: true`, `checkJs: true`, `noEmit: true` for standalone type checking, and references global type declarations.
3. Requirement 3: Ambient type definitions in `types/` declare Min window globals, Electron renderer bridges, Prompt/Tool registry types, Tab and Task state interfaces, and localization functions.
4. Requirement 4: `npm run typecheck` runs TypeScript typechecking across the codebase and exits successfully with 0 errors.
5. Requirement 5: The bundling scripts (`scripts/buildBrowser.js`, etc.) support TypeScript files if `.ts` files are included or imported.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: `tsc --noEmit` should complete within a few seconds.
- Reliability: Existing tests and runtime functionality must remain 100% functional without regressions.
- Compatibility: Compatible with Node.js >= 22.12.0 and Electron 42.6.0.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- Developer experience: VS Code and other Language Server Protocol (LSP) editors will automatically pick up `tsconfig.json` and `types/` for auto-complete, go-to-definition, and inline diagnostics.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Dependencies: `typescript`, `@types/node`.
- Declarations: `types/globals.d.ts`, `types/min.d.ts`, etc.
- Build integration: Add tsify or ts-compatible loader in browserify / buildBrowser if `.ts` files are processed in bundle, or ensure `tsc` / tsify / babelify handles `.ts`.

## 11. Acceptance Criteria
Define how success will be measured.

- [x] `tsconfig.json` exists and is properly configured for the project.
- [x] TypeScript and `@types/node` are installed in `devDependencies`.
- [x] `npm run typecheck` executes `tsc --noEmit` and passes with 0 errors.
- [x] Comprehensive ambient types exist for Min's globals and key subsystems.
- [x] Unambiguous modules across subsystems (`js/navbar/`, `js/llmPrompt/`, `js/util/`, `scripts/`) are converted to `.ts` with full type annotations.
- [x] Unit tests verify TypeScript configuration, type checking, and converted TypeScript module execution.
- [x] All existing test suites pass.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Open project in editor and verify intellisense for `tabs`, `tasks`, `ipc`, `electron`, `window`, etc.
- Automated test coverage: Unit test `test/typescript.test.js` validating tsconfig and typecheck execution.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Immediate availability for development workflows.
- Follow-up work: Incrementally author new components or convert existing modules to `.ts`.
