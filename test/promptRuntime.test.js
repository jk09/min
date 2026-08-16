const test = require('node:test')
const assert = require('node:assert')

const toolRegistry = require('../js/llmPrompt/tools/toolRegistry.js')
const skillRegistry = require('../js/llmPrompt/skills/skillRegistry.js')
const planParser = require('../js/llmPrompt/planParser.js')
const planningSkill = require('../js/llmPrompt/planningSkill.js')

toolRegistry.register({
    id: 'test.read',
    scope: 'read',
    description: 'echoes its input',
    parameters: {
        value: { type: 'string', required: true },
        count: { type: 'number', default: 1 }
    },
    handler: args => args
})

toolRegistry.register({
    id: 'test.mutate',
    scope: 'mutate',
    description: 'pretends to change something',
    parameters: {},
    handler: () => ({ changed: true })
})

toolRegistry.register({
    id: 'test.throws',
    scope: 'read',
    description: 'always fails',
    parameters: {},
    handler: () => { throw new Error('boom') }
})

test('tool dispatcher rejects unknown tools', async function () {
    const outcome = await toolRegistry.run('does.notExist', {}, { scope: 'read' })
    assert.strictEqual(outcome.ok, false)
    assert.strictEqual(outcome.errorCode, 'unknown_tool')
})

test('tool dispatcher enforces the mutate scope', async function () {
    assert.strictEqual((await toolRegistry.run('test.mutate', {}, { scope: 'read' })).errorCode, 'scope_denied')
    assert.strictEqual((await toolRegistry.run('test.mutate', {}, { scope: 'mutate' })).ok, true)
})

test('tool dispatcher validates arguments', async function () {
    assert.strictEqual((await toolRegistry.run('test.read', {}, { scope: 'read' })).errorCode, 'missing_parameter')
    assert.strictEqual((await toolRegistry.run('test.read', { value: 'a', extra: 1 }, { scope: 'read' })).errorCode, 'unknown_parameter')
    assert.strictEqual((await toolRegistry.run('test.read', { value: 1 }, { scope: 'read' })).errorCode, 'invalid_parameter')

    const outcome = await toolRegistry.run('test.read', { value: 'a', count: '3' }, { scope: 'read' })
    assert.strictEqual(outcome.ok, true)
    assert.deepStrictEqual(outcome.result, { value: 'a', count: 3 })
})

test('tool dispatcher turns thrown errors into structured failures', async function () {
    const outcome = await toolRegistry.run('test.throws', {}, { scope: 'read' })
    assert.strictEqual(outcome.ok, false)
    assert.strictEqual(outcome.errorCode, 'tool_failed')
})

test('a plan stops at the first failing step', async function () {
    const plan = await toolRegistry.runPlan([
        { tool: 'test.read', args: { value: 'a' } },
        { tool: 'test.read', args: {} },
        { tool: 'test.mutate', args: {} }
    ], { scope: 'mutate' })

    assert.strictEqual(plan.ok, false)
    assert.strictEqual(plan.steps.length, 2)
})

test('the tool catalog is serializable', function () {
    const entry = toolRegistry.getCatalog().find(tool => tool.id === 'test.read')
    assert.deepStrictEqual(JSON.parse(JSON.stringify(entry)), entry)
    assert.strictEqual(entry.parameters.find(p => p.name === 'value').required, true)
})

test('explicit skill invocation is resolved by id', function () {
    skillRegistry.register({
        id: 'demo',
        title: 'Demo',
        kind: 'deterministic',
        triggers: [/^do the demo/i],
        run: async () => ({ message: 'done' })
    })

    const explicit = skillRegistry.resolveExplicit('/demo some args')
    assert.strictEqual(explicit.skill.id, 'demo')
    assert.strictEqual(explicit.argsText, 'some args')

    assert.strictEqual(skillRegistry.resolveExplicit('/nope').unknownSkillId, 'nope')
    assert.strictEqual(skillRegistry.resolveExplicit('just a question'), null)
})

test('implicit skill invocation is resolved by trigger', function () {
    assert.strictEqual(skillRegistry.resolveImplicit('do the demo now').skill.id, 'demo')
    assert.strictEqual(skillRegistry.resolveImplicit('what is the capital of France'), null)
})

test('user skills override built-ins with the same id', function () {
    skillRegistry.register({ id: 'override', title: 'built-in', kind: 'deterministic', run: async () => ({}) })
    skillRegistry.register(skillRegistry.compileDeclarativeSkill({
        id: 'override',
        title: 'user',
        steps: [{ tool: 'test.read', args: { value: 'x' } }]
    }))

    assert.strictEqual(skillRegistry.get('override').source, 'user')
})

test('declarative skills fill the input template and run through tools', async function () {
    const skill = skillRegistry.compileDeclarativeSkill({
        id: 'declarative',
        title: 'Declarative',
        triggers: ['open my news'],
        steps: [{ tool: 'test.read', args: { value: '{{input}}' } }]
    })

    const calls = []
    const result = await skill.run({ argsText: 'today' }, {
        runPlan: async function (toolCalls) {
            calls.push(...toolCalls)
            return { ok: true, steps: [] }
        }
    })

    assert.deepStrictEqual(calls, [{ tool: 'test.read', args: { value: 'today' } }])
    assert.match(result.message, /Declarative/)
})

test('plan parser accepts a fenced JSON plan', function () {
    const raw = '```json\n{"message":"ok","toolCalls":[{"tool":"test.read","args":{"value":"a"}}]}\n```'
    const parsed = planParser.parsePlan(raw, ['test.read'])

    assert.strictEqual(parsed.ok, true)
    assert.strictEqual(parsed.plan.message, 'ok')
    assert.strictEqual(parsed.plan.toolCalls.length, 1)
})

test('plan parser rejects malformed and unsafe output', function () {
    assert.strictEqual(planParser.parsePlan('not json').errorCode, 'malformed_plan')
    assert.strictEqual(planParser.parsePlan('{"message":"","toolCalls":[]}').errorCode, 'empty_plan')
    assert.strictEqual(planParser.parsePlan('{"message":"a","toolCalls":"go"}').errorCode, 'malformed_plan')
    assert.strictEqual(planParser.parsePlan('{"message":"a","toolCalls":[{"tool":"evil.exec"}]}', ['test.read']).errorCode, 'unknown_tool')
    assert.strictEqual(planParser.parsePlan('{"message":"a","toolCalls":[{"tool":"test.read","args":[]}]}', ['test.read']).errorCode, 'malformed_plan')

    const tooMany = { message: 'a', toolCalls: new Array(planParser.MAX_TOOL_CALLS + 1).fill({ tool: 'test.read' }) }
    assert.strictEqual(planParser.parsePlan(JSON.stringify(tooMany), ['test.read']).errorCode, 'plan_too_long')
})

test('/b system prompt lists the tool catalog and instructs JSON-only replies', function () {
    const catalog = toolRegistry.getCatalog().filter(tool => tool.id === 'test.read')
    const system = planningSkill.buildSystemPrompt(catalog)

    assert.match(system, /test\.read/)
    assert.match(system, /value:string/)
    assert.match(system, /count:number\?/)
    assert.match(system, /JSON only/)
})

test('/b outcome summary combines the plan message with a step count', function () {
    const plan = { message: 'Opened 2 tabs.', toolCalls: [{ tool: 'tabs.open', args: {} }, { tool: 'tabs.open', args: {} }] }
    const planResult = { ok: true, steps: [{ tool: 'tabs.open' }, { tool: 'tabs.open' }] }

    assert.strictEqual(planningSkill.describePlanOutcome(plan, planResult), 'Opened 2 tabs. 2 steps completed.')
})

test('a well-formed /b-style plan executes through the tool registry end to end', async function () {
    const raw = '{"message":"Reading it back.","toolCalls":[{"tool":"test.read","args":{"value":"hi"}}]}'
    const catalog = toolRegistry.getCatalog().map(tool => tool.id)
    const parsed = planParser.parsePlan(raw, catalog)

    assert.strictEqual(parsed.ok, true)

    const planResult = await toolRegistry.runPlan(parsed.plan.toolCalls, { scope: 'read' })

    assert.strictEqual(planResult.ok, true)
    assert.strictEqual(planningSkill.describePlanOutcome(parsed.plan, planResult), 'Reading it back. 1 step completed.')
})
