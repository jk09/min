/* Built-in skills. Everything here is expressed as tool calls plus, for llm skills, a model call. */

const skillRegistry = require('llmPrompt/skills/skillRegistry.js')
const agentRegistry = require('llmPrompt/agents/agentRegistry.js')
const ownModelRegistry = require('llmPrompt/ownModels/ownModelRegistry.js')
const toolRegistry = require('llmPrompt/tools/toolRegistry.js')
const planParser = require('llmPrompt/planParser.js')
const planningSkill = require('llmPrompt/planningSkill.js')
const debugTab = require('llmPrompt/debugTab.js')

function requireArgs (argsText, usage) {
    if (!argsText) {
        throw new Error('Usage: ' + usage)
    }
    return argsText
}

function formatPlaces (results) {
    return results.map(place => '· ' + (place.title || place.url) + '\n  ' + place.url).join('\n')
}

const builtinSkills = [
    {
        id: 'search',
        title: 'Search the web',
        description: 'Search with the configured search engine and open the results.',
        kind: 'deterministic',
        usage: '/search <query>',
        triggers: [/^search (for )?/i, /^google /i, /^look up /i],
        run: async function (input, context) {
            const query = requireArgs(input.argsText, '/search <query>')
            const outcome = await context.runTool('search.web', { query })

            if (!outcome.ok) {
                throw new Error(outcome.errorMessage)
            }

            return { message: 'Searching ' + outcome.result.engine + ' for "' + query + '"' }
        }
    },
    {
        id: 'history',
        title: 'Search history',
        description: 'Find pages you have visited before.',
        kind: 'deterministic',
        usage: '/history <query>',
        triggers: [/^history:?\s+/i, /^find in history /i],
        run: async function (input, context) {
            const query = requireArgs(input.argsText, '/history <query>')
            const outcome = await context.runTool('history.search', { query, limit: 10 })

            if (!outcome.ok) {
                throw new Error(outcome.errorMessage)
            }

            const results = outcome.result.results

            if (results.length === 0) {
                return { message: 'No visited pages match "' + query + '".' }
            }

            return {
                message: results.length + ' page(s) matching "' + query + '":\n' + formatPlaces(results),
                detail: 'Use /collect ' + query + ' to open them together.'
            }
        }
    },
    {
        id: 'tabs',
        title: 'List open tabs',
        description: 'Show the tabs open in the current task.',
        kind: 'deterministic',
        usage: '/tabs',
        triggers: [/^list tabs$/i, /^what tabs are open\??$/i],
        run: async function (input, context) {
            const outcome = await context.runTool('tabs.list', {})

            if (!outcome.ok) {
                throw new Error(outcome.errorMessage)
            }

            const open = outcome.result.tabs.filter(tab => tab.url)

            if (open.length === 0) {
                return { message: 'No pages are open.' }
            }

            return { message: open.map(tab => (tab.selected ? '› ' : '· ') + (tab.title || tab.url)).join('\n') }
        }
    },
    {
        id: 'summarize',
        title: 'Summarize this page',
        description: 'Summarize the page in the active tab (needs a configured model).',
        kind: 'llm',
        usage: '/summarize',
        triggers: [/^summari[sz]e (this|the) page$/i, /^summari[sz]e$/i, /^tl;?dr$/i],
        run: async function (input, context) {
            const page = await context.runTool('page.getText', {})

            if (!page.ok) {
                throw new Error(page.errorMessage)
            }

            const answer = await context.llm.complete({
                system: 'You summarize web pages. Reply with at most five short bullet points. Do not add commentary.',
                prompt: 'Title: ' + page.result.title + '\nURL: ' + page.result.url + '\n\n' + page.result.text
            })

            if (!answer.ok) {
                throw new Error(answer.errorMessage)
            }

            return { message: answer.output, detail: page.result.truncated ? 'Summarized the first part of a long page.' : '' }
        }
    },
    {
        id: 'skills',
        title: 'List skills',
        description: 'Show everything the prompt can do.',
        kind: 'deterministic',
        usage: '/skills',
        triggers: [/^what can you do\??$/i, /^help$/i],
        run: async function () {
            const lines = skillRegistry.getCatalog().map(skill => skill.usage + ' — ' + skill.description)
            return { message: lines.join('\n') }
        }
    },
    {
        id: 'b',
        title: 'Run a browser command',
        description: 'Plan and run a browser action (open pages, search history, manage tabs) from a plain instruction.',
        kind: 'llm',
        usage: '//<instruction>',
        triggers: [],
        run: async function (input, context) {
            const instruction = requireArgs(input.argsText, '//<instruction>')
            const ownModel = ownModelRegistry.get(context.ownModelId) || ownModelRegistry.getDefault()

            const record = { instruction, ownModelId: ownModel.id }
            const publishDebug = function () {
                if (context.debug) {
                    debugTab.publish(planningSkill.buildDebugRecord(record))
                }
            }

            if (!ownModel.functional) {
                record.failureMessage = ownModel.title + ' is not wired up yet.'
                publishDebug()
                return { message: ownModel.title + ' is not wired up yet. Try ' + ownModelRegistry.getDefault().title + ' instead.' }
            }

            const catalog = toolRegistry.getCatalog()
            const knownToolIds = catalog.map(tool => tool.id)
            record.systemPrompt = planningSkill.buildSystemPrompt(catalog)

            const answer = await context.llm.complete({
                system: record.systemPrompt,
                prompt: instruction,
                responseFormat: 'json'
            })

            if (!answer.ok) {
                record.failureMessage = answer.errorMessage
                publishDebug()
                throw new Error(answer.errorMessage)
            }

            record.modelResponse = answer.output

            const parsed = planParser.parsePlan(answer.output, knownToolIds)

            if (!parsed.ok) {
                record.failureMessage = parsed.errorMessage
                publishDebug()
                throw new Error(parsed.errorMessage)
            }

            record.parsedPlan = parsed.plan

            if (parsed.plan.toolCalls.length === 0) {
                publishDebug()
                return { message: parsed.plan.message || 'Nothing to do.' }
            }

            const planResult = await context.runPlan(parsed.plan.toolCalls)
            record.trace = planResult.steps

            if (!planResult.ok) {
                record.failureMessage = planResult.errorMessage
                publishDebug()
                throw new Error(planResult.errorMessage)
            }

            publishDebug()
            return { message: planningSkill.describePlanOutcome(parsed.plan, planResult) }
        }
    },
    {
        id: 'ai',
        title: 'Ask an AI agent',
        description: 'Open the selected AI agent with this prompt and the current page as context.',
        kind: 'deterministic',
        usage: '/ai <prompt>',
        triggers: [/^ask (claude|the ai)\s+/i],
        run: async function (input, context) {
            const prompt = requireArgs(input.argsText, '/ai <prompt>')
            const agent = agentRegistry.get(context.agentId) || agentRegistry.getDefault()

            if (!agent.functional) {
                return { message: agent.title + ' is not wired up yet. Try Claude.ai instead.' }
            }

            const tabsOutcome = await context.runTool('tabs.list', {})
            const selectedTab = tabsOutcome.ok ? tabsOutcome.result.tabs.find(tab => tab.selected && tab.url) : null
            const contextURL = selectedTab ? selectedTab.url : ''

            const outcome = await context.runTool('tabs.open', { url: agent.buildURL(prompt, contextURL) })

            if (!outcome.ok) {
                throw new Error(outcome.errorMessage)
            }

            return { message: 'Opening ' + agent.title + ' with your prompt.' }
        }
    }
]

module.exports = builtinSkills
