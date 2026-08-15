/*
Skill layer for the prompt runtime.

A skill is a named unit of work resolved from prompt text. It is either:
  - 'deterministic': it only calls tools, never a model, so it runs at native UI speed
  - 'llm': it uses the configured model, usually combined with tool calls

  {
    id: 'search',
    title: 'Search the web',
    description: 'short text shown in the skill list',
    kind: 'deterministic' | 'llm',
    usage: '/search <query>',
    triggers: [/^search /i],                 // regexes matched against the raw prompt
    run: async function (input, context)     // input: { prompt, argsText }
  }

`run` resolves to { message, detail? }. Context provides { scope, runTool, runPlan, llm }.
*/

const KINDS = ['deterministic', 'llm']

const skills = new Map()

function assertValidSkill (skill) {
    if (!skill || typeof skill.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(skill.id)) {
        throw new Error('a skill id must be lowercase alphanumeric')
    }
    if (!KINDS.includes(skill.kind)) {
        throw new Error('skill ' + skill.id + ' must be deterministic or llm')
    }
    if (typeof skill.run !== 'function') {
        throw new Error('skill ' + skill.id + ' must have a run function')
    }
}

/* user skills override built-ins with the same id */
function register (skill) {
    assertValidSkill(skill)
    skills.set(skill.id, Object.assign({ triggers: [] }, skill))
}

function registerAll (list) {
    list.forEach(register)
}

function get (id) {
    return skills.get(id) || null
}

function list () {
    return Array.from(skills.values())
}

function getCatalog () {
    return list().map(skill => ({
        id: skill.id,
        title: skill.title || skill.id,
        description: skill.description || '',
        kind: skill.kind,
        usage: skill.usage || ('/' + skill.id)
    }))
}

/* '/search rust async' -> { skill, argsText: 'rust async' } */
function resolveExplicit (prompt) {
    const match = /^\/([a-z][a-z0-9-]*)\s*([\s\S]*)$/i.exec(prompt.trim())

    if (!match) {
        return null
    }

    const skill = get(match[1].toLowerCase())

    if (!skill) {
        return { unknownSkillId: match[1] }
    }

    return { skill, argsText: match[2].trim() }
}

/*
Lexical trigger matching only - no model round-trip, so an implicit match stays
as fast as an explicit one. The longest match wins; ties are unresolved and fall
through to the general LLM path.
*/
function resolveImplicit (prompt) {
    const text = prompt.trim()
    let best = null

    for (const skill of skills.values()) {
        for (const trigger of skill.triggers) {
            const match = trigger.exec(text)
            if (match && match.index === 0) {
                if (!best || match[0].length > best.length) {
                    best = { skill, argsText: text.slice(match[0].length).trim(), length: match[0].length }
                } else if (match[0].length === best.length && skill.id !== best.skill.id) {
                    best.ambiguous = true
                }
            }
        }
    }

    if (!best || best.ambiguous) {
        return null
    }

    return { skill: best.skill, argsText: best.argsText || text }
}

/*
Compiles a declarative skill definition (from settings, i.e. user-authored) into a
runnable skill. Definitions are data only - they can never execute arbitrary code.

  { id, title, description, triggers: ['open my news'], steps: [{ tool, args }] }

String arguments support the {{input}} placeholder, replaced with the prompt text
that follows the skill name.
*/
function compileDeclarativeSkill (definition) {
    if (!definition || !Array.isArray(definition.steps) || definition.steps.length === 0) {
        throw new Error('a declarative skill needs a steps array')
    }

    const triggers = (definition.triggers || [])
        .filter(trigger => typeof trigger === 'string' && trigger)
        .map(trigger => new RegExp('^' + trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))

    function fillTemplate (value, input) {
        if (typeof value === 'string') {
            return value.replace(/\{\{\s*input\s*\}\}/g, input)
        }
        if (Array.isArray(value)) {
            return value.map(item => fillTemplate(item, input))
        }
        if (value && typeof value === 'object') {
            const filled = {}
            Object.keys(value).forEach(key => { filled[key] = fillTemplate(value[key], input) })
            return filled
        }
        return value
    }

    return {
        id: definition.id,
        title: definition.title || definition.id,
        description: definition.description || 'User-defined skill',
        kind: 'deterministic',
        usage: definition.usage || ('/' + definition.id + ' <input>'),
        source: 'user',
        triggers,
        run: async function (input, context) {
            const toolCalls = definition.steps.map(step => ({
                tool: step.tool,
                args: fillTemplate(step.args || {}, input.argsText)
            }))

            const plan = await context.runPlan(toolCalls)

            if (!plan.ok) {
                throw new Error(plan.errorMessage)
            }

            return { message: (definition.title || definition.id) + ' completed', steps: plan.steps }
        }
    }
}

module.exports = {
    KINDS,
    register,
    registerAll,
    get,
    list,
    getCatalog,
    resolveExplicit,
    resolveImplicit,
    compileDeclarativeSkill
}
