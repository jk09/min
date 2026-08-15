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

The location of  `SPEC.md` file, which contains the feature specification to be implemented. If the location is not provided, the agent should prompt for it.

## Steps:

- checkout a new branch whose name is based on the spec name, possibly with disambiguator (a simple counter if enough) if a branch with the proposed name exists
- implement the specified feature
- commit the changes per `## Agent commit behavior` in [AGENTS.md](../../../AGENTS.md)