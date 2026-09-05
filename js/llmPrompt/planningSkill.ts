/*
Pure helpers for the /b planning skill: turning the tool catalog into a system
prompt for the model, and summarizing a completed plan for the user. Kept
dependency-free (no requires) so it is directly unit-testable, like planParser.ts.
*/

import type { Plan, ToolCall } from './planParser'

export const MAX_TOOL_CALLS_HINT: number = 5

export interface ToolCatalogParameter {
  name: string
  type: string
  required?: boolean
  description?: string
}

export interface ToolCatalogEntry {
  id: string
  scope: string
  description: string
  parameters: ToolCatalogParameter[]
}

export interface PlanResultStep {
  tool: string
  args: Record<string, any>
  outcome: any
}

export interface PlanExecutionResult {
  ok: boolean
  steps: PlanResultStep[]
  errorCode?: string
  errorMessage?: string
}

export interface DebugRecordInput {
  instruction?: string
  ownModelId?: string
  systemPrompt?: string
  modelResponse?: string
  parsedPlan?: Plan | null
  trace?: any[]
  failureMessage?: string | null
}

export interface DebugRecord {
  instruction: string
  ownModelId: string
  systemPrompt: string
  modelResponse: string
  parsedPlan: Plan | null
  trace: any[]
  failureMessage: string | null
}

export function describeParameter (parameter: ToolCatalogParameter): string {
  return parameter.name + ':' + parameter.type + (parameter.required ? '' : '?')
}

export function describeTool (tool: ToolCatalogEntry): string {
  const params = tool.parameters.map(describeParameter).join(', ')
  return '- ' + tool.id + ' [' + tool.scope + '] (' + params + '): ' + tool.description
}

/* catalog is toolRegistry.getCatalog()'s output: [{ id, scope, description, parameters }] */
export function buildSystemPrompt (catalog: ToolCatalogEntry[]): string {
  const toolLines = catalog.map(describeTool).join('\n')

  return [
    'You turn a browser instruction into a short plan of tool calls.',
    'Only use the tools listed below; never invent a tool id or a parameter name.',
    'Every argument value must be concrete and valid for the target tool; do not use placeholders or wildcards like "*", "<id>", or "any".',
    'For tabs.close, only pass an exact tab id that came from tabs.list.',
    'Reply with JSON only, no prose, in the exact shape:',
    '{ "message": "short summary for the user", "toolCalls": [ { "tool": "id", "args": { } } ] }',
    'Use at most ' + MAX_TOOL_CALLS_HINT + ' tool calls.',
    'If nothing listed can do what was asked, return an empty toolCalls list and explain why in "message".',
    '',
    'Available tools:',
    toolLines
  ].join('\n')
}

/* plan: { message, toolCalls }, planResult: { ok, steps } from toolRegistry.runPlan */
export function describePlanOutcome (plan: Plan, planResult: PlanExecutionResult): string {
  const summary = planResult.steps.length + (planResult.steps.length === 1 ? ' step' : ' steps') + ' completed.'
  return (plan.message ? plan.message + ' ' : '') + summary
}

/*
Builds the LLM Prompt debug record shown in the debug tab. Only ever includes
values already computed by the browser planning skill (instruction, prompts, parsed plan, tool trace)
- never provider credentials, which never reach this module in the first place.
*/
export function buildDebugRecord (input: DebugRecordInput): DebugRecord {
  return {
    instruction: input.instruction || '',
    ownModelId: input.ownModelId || '',
    systemPrompt: input.systemPrompt || '',
    modelResponse: input.modelResponse || '',
    parsedPlan: input.parsedPlan || null,
    trace: input.trace || [],
    failureMessage: input.failureMessage || null
  }
}

module.exports = { MAX_TOOL_CALLS_HINT, buildSystemPrompt, describePlanOutcome, buildDebugRecord }
