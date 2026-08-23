const test = require('node:test')
const assert = require('node:assert')
const Module = require('node:module')

function loadPromptRouter () {
    const registeredTools = new Map()
    let llmCalls = 0
    const searchCalls = []
    const openCalls = []

    const toolRegistry = {
        registerAll: tools => tools.forEach(tool => registeredTools.set(tool.id, tool)),
        run: async function (id, args) {
            const tool = registeredTools.get(id)
            return { ok: true, result: await tool.handler(args) }
        }
    }

    const skill = {
        id: 'known',
        kind: 'deterministic',
        run: async () => ({ message: 'skill completed' })
    }

    const llmSkill = {
        id: 'b',
        kind: 'llm',
        run: async function (input, context) {
            const answer = await context.llm.complete({ prompt: input.argsText })
            return { message: answer.ok ? answer.output : 'no model configured' }
        }
    }

    const skillRegistry = {
        registerAll: () => {},
        resolveExplicit: function (prompt) {
            if (prompt === '/known args') {
                return { skill, argsText: 'args' }
            }
            if (prompt.startsWith('/')) {
                return { unknownSkillId: prompt.slice(1) }
            }
            return null
        },
        get: function (id) {
            return id === 'b' ? llmSkill : null
        },
        getCatalog: () => []
    }

    const modules = {
        'llmPrompt/tools/toolRegistry.js': toolRegistry,
        'llmPrompt/tools/browserTools.js': [{
            id: 'tabs.open',
            handler: async function (args) {
                openCalls.push(args)
                return { tabId: 'tab-1', url: args.url }
            }
        }, {
            id: 'search.web',
            handler: async function (args) {
                searchCalls.push(args)
                return { engine: 'Test', url: 'https://search.test/?q=' + encodeURIComponent(args.query) }
            }
        }],
        'llmPrompt/skills/skillRegistry.js': skillRegistry,
        'llmPrompt/skills/builtinSkills.js': [],
        'llmPrompt/engineClient.js': {
            complete: async function () {
                llmCalls++
                return { ok: false }
            }
        },
        'util/urlParser.js': { isPossibleURL: url => url === 'https://example.com' || url === 'example.com' },
        'util/settings/settings.js': { get: () => null }
    }
    const originalLoad = Module._load

    Module._load = function (request, parent, isMain) {
        return modules[request] || originalLoad.call(this, request, parent, isMain)
    }

    const routerPath = require.resolve('../js/llmPrompt/promptRouter.js')
    delete require.cache[routerPath]
    const router = require(routerPath)
    Module._load = originalLoad

    return { router, searchCalls, openCalls, getLlmCalls: () => llmCalls }
}

test('possible URLs, including protocol-less domains, open in a new tab without a search', async function () {
    const runtime = loadPromptRouter()
    const strictResult = await runtime.router.handlePrompt('https://example.com', { scope: 'mutate' })
    const protocolLessResult = await runtime.router.handlePrompt('example.com', { scope: 'mutate' })

    assert.strictEqual(strictResult.ok, true)
    assert.strictEqual(strictResult.route, 'url')
    assert.strictEqual(protocolLessResult.ok, true)
    assert.strictEqual(protocolLessResult.route, 'url')
    assert.deepStrictEqual(runtime.openCalls, [{ url: 'https://example.com' }, { url: 'example.com' }])
    assert.deepStrictEqual(runtime.searchCalls, [])
    assert.strictEqual(runtime.getLlmCalls(), 0)
})

test('plain text without a leading / searches the configured engine without asking the model', async function () {
    const runtime = loadPromptRouter()
    const result = await runtime.router.handlePrompt('privacy focused browser', { scope: 'mutate' })

    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.route, 'search')
    assert.deepStrictEqual(runtime.searchCalls, [{ query: 'privacy focused browser' }])
    assert.strictEqual(runtime.getLlmCalls(), 0)
})

test('a leading // feeds the prompt to the configured LLM model', async function () {
    const runtime = loadPromptRouter()
    const result = await runtime.router.handlePrompt('//privacy focused browser', { scope: 'mutate' })

    assert.strictEqual(result.route, 'skill')
    assert.strictEqual(result.skillId, 'b')
    assert.deepStrictEqual(runtime.searchCalls, [])
    assert.strictEqual(runtime.getLlmCalls(), 1)
})

test('unknown slash text is rejected without asking the model, known explicit skills still run', async function () {
    const runtime = loadPromptRouter()
    const unknownResult = await runtime.router.handlePrompt('/not-a-skill', { scope: 'mutate' })
    const skillResult = await runtime.router.handlePrompt('/known args', { scope: 'mutate' })

    assert.strictEqual(unknownResult.ok, false)
    assert.strictEqual(unknownResult.route, 'error')
    assert.strictEqual(skillResult.route, 'skill')
    assert.strictEqual(skillResult.skillId, 'known')
    assert.strictEqual(runtime.getLlmCalls(), 0)
})