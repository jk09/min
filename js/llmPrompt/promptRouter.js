/*
Routes prompt text to a skill or to the configured model.

  '/id args'          -> explicit skill invocation
  trigger match       -> implicit skill invocation
  anything else       -> general LLM query, answered with a plan of tool calls

The router never touches the browser directly: every effect goes through the tool
registry, so the capability surface stays auditable.
*/

const toolRegistry = require('llmPrompt/tools/toolRegistry.js')
const browserTools = require('llmPrompt/tools/browserTools.js')
const skillRegistry = require('llmPrompt/skills/skillRegistry.js')
const builtinSkills = require('llmPrompt/skills/builtinSkills.js')
const planParser = require('llmPrompt/planParser.js')
const engineClient = require('llmPrompt/engineClient.js')
const settings = require('util/settings/settings.js')

const PLAN_SYSTEM_PROMPT = [
    'You control the Min web browser. Answer the user by returning JSON only, with no prose outside the JSON.',
    'Schema: {"message": string, "toolCalls": [{"tool": string, "args": object}]}.',
    '"message" is a short answer shown to the user. "toolCalls" are executed in order and may be empty.',
    'Only use tools from the catalog, and only pass parameters the catalog declares.',
    'Prefer a single tool call. If the request is just a question, answer in "message" with no tool calls.'
].join(' ')

let initialized = false

function loadUserSkills () {
    const definitions = settings.get('llmSkills')

    if (!Array.isArray(definitions)) {
        return
    }

    definitions.forEach(function (definition) {
        try {
            skillRegistry.register(skillRegistry.compileDeclarativeSkill(definition))
        } catch (e) {
            console.warn('ignoring invalid user skill', definition && definition.id, e.message)
        }
    })
}

function initialize () {
    if (initialized) {
        return
    }
    toolRegistry.registerAll(browserTools)
    skillRegistry.registerAll(builtinSkills)
    loadUserSkills()
    initialized = true
}

const llm = {
    complete: function (request) {
        return engineClient.complete(request)
    }
}

function createContext (scope, trace) {
    async function runTool (id, args) {
        const outcome = await toolRegistry.run(id, args, { scope })
        trace.push({ tool: id, args: args || {}, ok: outcome.ok })
        return outcome
    }

    async function runPlan (toolCalls) {
        for (const call of toolCalls) {
            const outcome = await runTool(call.tool, call.args)
            if (!outcome.ok) {
                return { ok: false, errorMessage: outcome.errorMessage, steps: trace.slice() }
            }
        }
        return { ok: true, steps: trace.slice() }
    }

    return { scope, runTool, runPlan, llm }
}

async function runSkill (skill, argsText, prompt, scope) {
    const trace = []
    const context = createContext(scope, trace)

    try {
        const result = await skill.run({ prompt, argsText }, context)
        return {
            ok: true,
            route: 'skill',
            skillId: skill.id,
            kind: skill.kind,
            message: (result && result.message) || 'Done.',
            detail: (result && result.detail) || '',
            trace
        }
    } catch (e) {
        return {
            ok: false,
            route: 'skill',
            skillId: skill.id,
            kind: skill.kind,
            message: e && e.message ? e.message : 'The skill failed.',
            trace
        }
    }
}

function buildBrowserContext () {
    const selectedTab = tabs && tabs.getSelected() ? tabs.get(tabs.getSelected()) : null

    return {
        activeTab: selectedTab && selectedTab.url ? { url: selectedTab.url, title: selectedTab.title || '' } : null,
        openTabCount: tabs ? tabs.count() : 0
    }
}

async function runGeneralQuery (prompt, scope) {
    const trace = []
    const context = createContext(scope, trace)

    const answer = await llm.complete({
        system: PLAN_SYSTEM_PROMPT,
        prompt: [
            'Tool catalog:\n' + JSON.stringify(toolRegistry.getCatalog()),
            'Browser state:\n' + JSON.stringify(buildBrowserContext()),
            'User request:\n' + prompt
        ].join('\n\n'),
        responseFormat: 'json'
    })

    if (!answer.ok) {
        return { ok: false, route: 'llm', message: answer.errorMessage || 'The model could not be reached.', trace }
    }

    const parsed = planParser.parsePlan(answer.output, toolRegistry.list().map(tool => tool.id))

    if (!parsed.ok) {
        return { ok: false, route: 'llm', message: parsed.errorMessage, trace }
    }

    const execution = await context.runPlan(parsed.plan.toolCalls)

    if (!execution.ok) {
        return { ok: false, route: 'llm', message: execution.errorMessage, trace }
    }

    return {
        ok: true,
        route: 'llm',
        message: parsed.plan.message || 'Done.',
        detail: parsed.plan.toolCalls.length > 0 ? '' : 'No browser actions were needed.',
        trace
    }
}

/*
options.scope - 'read' or 'mutate'. Prompts typed by the user are mutate-capable;
the gate exists so non-interactive callers can stay read-only.
*/
async function handlePrompt (rawPrompt, options = {}) {
    initialize()

    const prompt = String(rawPrompt || '').trim()
    const scope = options.scope === 'read' ? 'read' : 'mutate'

    if (!prompt) {
        return { ok: false, route: 'error', message: 'Type a request, or / to see the available skills.', trace: [] }
    }

    if (prompt === '/') {
        return {
            ok: true,
            route: 'help',
            message: skillRegistry.getCatalog().map(skill => skill.usage + ' — ' + skill.description).join('\n'),
            trace: []
        }
    }

    const explicit = skillRegistry.resolveExplicit(prompt)

    if (explicit && explicit.unknownSkillId) {
        return { ok: false, route: 'error', message: 'There is no skill called "' + explicit.unknownSkillId + '". Type / to list skills.', trace: [] }
    }

    if (explicit) {
        return runSkill(explicit.skill, explicit.argsText, prompt, scope)
    }

    const implicit = skillRegistry.resolveImplicit(prompt)

    if (implicit) {
        return runSkill(implicit.skill, implicit.argsText, prompt, scope)
    }

    return runGeneralQuery(prompt, scope)
}

module.exports = {
    initialize,
    handlePrompt,
    toolRegistry,
    skillRegistry
}
