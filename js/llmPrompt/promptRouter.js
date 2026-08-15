/*
Routes prompt text to a skill or to the configured model.

  '/id args'          -> explicit skill invocation
  trigger match       -> implicit skill invocation
  anything else       -> deterministic search with the default search engine

The router never touches the browser directly: every effect goes through the tool
registry, so the capability surface stays auditable.
*/

const toolRegistry = require('llmPrompt/tools/toolRegistry.js')
const browserTools = require('llmPrompt/tools/browserTools.js')
const skillRegistry = require('llmPrompt/skills/skillRegistry.js')
const builtinSkills = require('llmPrompt/skills/builtinSkills.js')
const engineClient = require('llmPrompt/engineClient.js')
const settings = require('util/settings/settings.js')

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

/*
Anything that isn't a skill designator (explicit or implicit) is treated as a plain
search query, deterministically, without ever reaching the model - mirroring how an
address bar falls back to a search engine.
*/
async function runDefaultSearch (prompt, scope) {
    const trace = []
    const context = createContext(scope, trace)

    const outcome = await context.runTool('search.web', { query: prompt })

    if (!outcome.ok) {
        return { ok: false, route: 'search', message: outcome.errorMessage || 'The search could not be completed.', trace }
    }

    const engineName = outcome.result && outcome.result.engine

    return {
        ok: true,
        route: 'search',
        message: 'Searching for "' + prompt + '"\u2026',
        detail: engineName ? ('Using ' + engineName) : '',
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

    return runDefaultSearch(prompt, scope)
}

module.exports = {
    initialize,
    handlePrompt,
    toolRegistry,
    skillRegistry
}
