/*
Capability layer for the prompt runtime.

A tool is the only way the prompt runtime (deterministic skills or LLM plans) is
allowed to touch the browser. Tools are declared as:

  {
    id: 'tabs.open',              // namespaced identifier
    scope: 'read' | 'mutate',     // capability scope required to run it
    description: 'short text',    // used in the LLM catalog
    parameters: {
      url: { type: 'string', required: true, description: 'page to open' }
    },
    handler: async function (args, context) { ... }
  }
*/

const SCOPES = ['read', 'mutate']
const PARAMETER_TYPES = ['string', 'number', 'boolean', 'array', 'object']

const tools = new Map()

function assertValidTool (tool) {
    if (!tool || typeof tool.id !== 'string' || !tool.id) {
        throw new Error('a tool must have a string id')
    }
    if (!SCOPES.includes(tool.scope)) {
        throw new Error('tool ' + tool.id + ' must declare scope read or mutate')
    }
    if (typeof tool.handler !== 'function') {
        throw new Error('tool ' + tool.id + ' must have a handler function')
    }

    const parameters = tool.parameters || {}
    Object.keys(parameters).forEach(function (name) {
        const type = parameters[name].type
        if (!PARAMETER_TYPES.includes(type)) {
            throw new Error('tool ' + tool.id + ' parameter ' + name + ' has unsupported type ' + type)
        }
    })
}

function register (tool) {
    assertValidTool(tool)
    tools.set(tool.id, Object.assign({ parameters: {} }, tool))
}

function registerAll (list) {
    list.forEach(register)
}

function get (id) {
    return tools.get(id) || null
}

function list () {
    return Array.from(tools.values())
}

/* compact, serializable description of the capability surface, used as LLM context */
function getCatalog () {
    return list().map(function (tool) {
        return {
            id: tool.id,
            scope: tool.scope,
            description: tool.description || '',
            parameters: Object.keys(tool.parameters).map(function (name) {
                const parameter = tool.parameters[name]
                return {
                    name,
                    type: parameter.type,
                    required: Boolean(parameter.required),
                    description: parameter.description || ''
                }
            })
        }
    })
}

function matchesType (value, type) {
    if (type === 'array') {
        return Array.isArray(value)
    }
    if (type === 'object') {
        return value !== null && typeof value === 'object' && !Array.isArray(value)
    }
    return typeof value === type // eslint-disable-line valid-typeof
}

function coerce (value, type) {
    if (type === 'number' && typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
        return Number(value)
    }
    if (type === 'boolean' && (value === 'true' || value === 'false')) {
        return value === 'true'
    }
    if (type === 'array' && typeof value === 'string') {
        return [value]
    }
    return value
}

function validateArguments (tool, args) {
    const provided = args || {}
    const values = {}

    const unknown = Object.keys(provided).filter(name => !(name in tool.parameters))
    if (unknown.length > 0) {
        return { ok: false, errorCode: 'unknown_parameter', errorMessage: tool.id + ': unknown parameter(s) ' + unknown.join(', ') }
    }

    for (const name of Object.keys(tool.parameters)) {
        const parameter = tool.parameters[name]
        let value = provided[name]

        if (value === undefined || value === null || value === '') {
            if (parameter.required) {
                return { ok: false, errorCode: 'missing_parameter', errorMessage: tool.id + ': missing required parameter "' + name + '"' }
            }
            if (parameter.default !== undefined) {
                values[name] = parameter.default
            }
            continue
        }

        value = coerce(value, parameter.type)

        if (!matchesType(value, parameter.type)) {
            return { ok: false, errorCode: 'invalid_parameter', errorMessage: tool.id + ': parameter "' + name + '" must be a ' + parameter.type }
        }

        values[name] = value
    }

    return { ok: true, values }
}

/*
Single dispatcher for every tool call. Validates the id, the arguments and the
capability scope before anything is allowed to run, and always resolves to a
structured result so callers never have to interpret thrown errors.
*/
async function run (id, args, context = {}) {
    const tool = get(id)

    if (!tool) {
        return { ok: false, errorCode: 'unknown_tool', errorMessage: 'Unknown tool "' + id + '"' }
    }

    const grantedScope = context.scope === 'mutate' ? 'mutate' : 'read'

    if (tool.scope === 'mutate' && grantedScope !== 'mutate') {
        return { ok: false, errorCode: 'scope_denied', errorMessage: tool.id + ' requires the mutate scope' }
    }

    const validation = validateArguments(tool, args)
    if (!validation.ok) {
        return validation
    }

    try {
        const result = await tool.handler(validation.values, context)
        return { ok: true, toolId: tool.id, result }
    } catch (e) {
        return { ok: false, toolId: tool.id, errorCode: 'tool_failed', errorMessage: tool.id + ': ' + (e && e.message ? e.message : String(e)) }
    }
}

/* runs an ordered plan, stopping at the first failure so the UI is never left half-applied */
async function runPlan (toolCalls, context = {}) {
    const steps = []

    for (const call of toolCalls) {
        const outcome = await run(call.tool, call.args, context)
        steps.push({ tool: call.tool, args: call.args, outcome })

        if (!outcome.ok) {
            return { ok: false, steps, errorCode: outcome.errorCode, errorMessage: outcome.errorMessage }
        }
    }

    return { ok: true, steps }
}

module.exports = {
    SCOPES,
    register,
    registerAll,
    get,
    list,
    getCatalog,
    run,
    runPlan
}
