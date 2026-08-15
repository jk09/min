/* Built-in skills. Everything here is expressed as tool calls plus, for llm skills, a model call. */

const skillRegistry = require('llmPrompt/skills/skillRegistry.js')

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
    }
]

module.exports = builtinSkills
