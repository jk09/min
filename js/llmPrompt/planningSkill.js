/*
Pure helpers for the /b planning skill: turning the tool catalog into a system
prompt for the model, and summarizing a completed plan for the user. Kept
dependency-free (no requires) so it is directly unit-testable, like planParser.js.
*/

const MAX_TOOL_CALLS_HINT = 5

function describeParameter (parameter) {
    return parameter.name + ':' + parameter.type + (parameter.required ? '' : '?')
}

function describeTool (tool) {
    const params = tool.parameters.map(describeParameter).join(', ')
    return '- ' + tool.id + ' [' + tool.scope + '] (' + params + '): ' + tool.description
}

/* catalog is toolRegistry.getCatalog()'s output: [{ id, scope, description, parameters }] */
function buildSystemPrompt (catalog) {
    const toolLines = catalog.map(describeTool).join('\n')

    return [
        'You turn a browser instruction into a short plan of tool calls.',
        'Only use the tools listed below; never invent a tool id or a parameter name.',
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
function describePlanOutcome (plan, planResult) {
    const summary = planResult.steps.length + (planResult.steps.length === 1 ? ' step' : ' steps') + ' completed.'
    return (plan.message ? plan.message + ' ' : '') + summary
}

/*
Builds the /b debug record shown in the debug tab. Only ever includes values
already computed by the /b skill (instruction, prompts, parsed plan, tool trace)
- never provider credentials, which never reach this module in the first place.
*/
function buildDebugRecord (input) {
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
