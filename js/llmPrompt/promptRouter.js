/*
Routes prompt text:

    browser mode: any web address opens in a new tab; all other text searches
    llm mode: prompt text is fed to the configured LLM model

LLM mode retains slash-prefixed skills for compatibility. Browser mode never
interprets slash-prefixed text as a skill or model request.

The URL check always runs first, so text that resolves to an address is opened
even if it also happens to start with '/'. Leading/trailing whitespace is
discarded before any of these checks run.

The router never touches the browser directly: every effect goes through the tool
registry, so the capability surface stays auditable.
*/

const toolRegistry = require('llmPrompt/tools/toolRegistry.js')
const browserTools = require('llmPrompt/tools/browserTools.js')
const skillRegistry = require('llmPrompt/skills/skillRegistry.js')
const builtinSkills = require('llmPrompt/skills/builtinSkills.js')
const engineClient = require('llmPrompt/engineClient.js')
const settings = require('util/settings/settings.js')
const urlParser = require('util/urlParser.js')

let initialized = false

function loadUserSkills() {
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

function initialize() {
    if (initialized) {
        return
    }
    toolRegistry.registerAll(browserTools)
    skillRegistry.registerAll(builtinSkills)
    loadUserSkills()
    initialized = true
}

function createContext(scope, trace, agentId, ownModelId, debug, requestId, onProgress) {
    async function runTool(id, args) {
        const outcome = await toolRegistry.run(id, args, { scope })
        trace.push({ tool: id, args: args || {}, ok: outcome.ok, result: outcome.result, errorMessage: outcome.errorMessage })
        return outcome
    }

    async function runPlan(toolCalls) {
        for (const call of toolCalls) {
            const outcome = await runTool(call.tool, call.args)
            if (!outcome.ok) {
                return { ok: false, errorMessage: outcome.errorMessage, steps: trace.slice() }
            }
        }
        return { ok: true, steps: trace.slice() }
    }

    const llm = {
        complete: function (request) {
            return engineClient.complete(request, { requestId, onProgress })
        }
    }

    return { scope, agentId: agentId || null, ownModelId: ownModelId || null, debug: Boolean(debug), runTool, runPlan, llm }
}

async function runSkill(skill, argsText, prompt, scope, agentId, ownModelId, debug, requestId, onProgress) {
    const trace = []
    const context = createContext(scope, trace, agentId, ownModelId, debug, requestId, onProgress)

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

async function runSearch(prompt, scope) {
    const trace = []
    const context = createContext(scope, trace)
    const outcome = await context.runTool('search.web', { query: prompt })

    if (!outcome.ok) {
        return { ok: false, route: 'search', message: outcome.errorMessage, trace }
    }

    return {
        ok: true,
        route: 'search',
        message: 'Searching the web.',
        detail: outcome.result.engine + ': ' + outcome.result.url,
        trace
    }
}

async function runURL(url, scope) {
    const trace = []
    const context = createContext(scope, trace)
    const outcome = await context.runTool('tabs.open', { url })

    if (!outcome.ok) {
        return { ok: false, route: 'url', message: outcome.errorMessage, trace }
    }

    return {
        ok: true,
        route: 'url',
        message: 'Opening ' + outcome.result.url,
        trace
    }
}

/*
options.scope - 'read' or 'mutate'. Prompts typed by the user are mutate-capable;
the gate exists so non-interactive callers can stay read-only.
*/
async function handlePrompt(rawPrompt, options = {}) {
    initialize()

    const prompt = String(rawPrompt || '').trim()
    const scope = options.scope === 'read' ? 'read' : 'mutate'
    const mode = options.mode === 'llm' ? 'llm' : 'browser'

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

    const agentId = typeof options.agentId === 'string' ? options.agentId : null
    const ownModelId = typeof options.ownModelId === 'string' ? options.ownModelId : null
    const debug = Boolean(options.debug)
    const requestId = typeof options.requestId === 'string' ? options.requestId : null
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null

    if (mode === 'browser') {
        if (urlParser.isPossibleURL(prompt)) {
            return runURL(prompt, scope)
        }
        return runSearch(prompt, scope)
    }

    if (!prompt.startsWith('/')) {
        const llmSkill = skillRegistry.get('b')
        if (llmSkill) {
            return runSkill(llmSkill, prompt, prompt, scope, agentId, ownModelId, debug, requestId, onProgress)
        }
        return { ok: false, route: 'error', message: 'No LLM model is configured.', trace: [] }
    }

    if (prompt.startsWith('//')) {
        const llmPrompt = prompt.slice(2).trim()

        if (!llmPrompt) {
            return { ok: false, route: 'error', message: 'Type a prompt after //.', trace: [] }
        }

        const llmSkill = skillRegistry.get('b')

        if (llmSkill) {
            return runSkill(llmSkill, llmPrompt, llmPrompt, scope, agentId, ownModelId, debug, requestId, onProgress)
        }

        return { ok: false, route: 'error', message: 'No LLM model is configured.', trace: [] }
    }

    const explicit = skillRegistry.resolveExplicit(prompt)

    if (explicit && !explicit.unknownSkillId) {
        return runSkill(explicit.skill, explicit.argsText, prompt, scope, agentId, ownModelId, debug, requestId, onProgress)
    }

    return {
        ok: false,
        route: 'error',
        message: 'Unknown skill "/' + (explicit ? explicit.unknownSkillId : '') + '". Type / to see the available skills.',
        trace: []
    }
}

module.exports = {
    initialize,
    handlePrompt,
    toolRegistry,
    skillRegistry
}
