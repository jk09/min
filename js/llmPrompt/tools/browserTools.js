/* Built-in tools: thin, validated wrappers around existing Min subsystems. */

const browserUI = require('browserUI.js')
const searchEngine = require('util/searchEngine.js')
const urlParser = require('util/urlParser.js')
const places = require('places/places.js')
const webviews = require('webviews.js')
const settings = require('util/settings/settings.js')

const READABLE_SETTINGS = ['searchEngine', 'llmProvider', 'llmModel', 'llmPromptPanelPosition']
const WRITABLE_SETTINGS = ['llmPromptPanelPosition', 'llmProvider', 'llmModel']
const MAX_PAGE_TEXT_LENGTH = 12000

function buildSearchURL (query) {
    const engine = searchEngine.getCurrent()
    return engine.searchURL.replace('%s', encodeURIComponent(query))
}

function describeTab (tab) {
    return {
        id: tab.id,
        url: tab.url,
        title: tab.title || '',
        selected: tab.id === tabs.getSelected()
    }
}

function openTab (url, background) {
    const tabId = tabs.add({ url: urlParser.parse(url) })
    browserUI.addTab(tabId, { enterEditMode: false, openInBackground: Boolean(background) })
    return tabId
}

function getPageText (tabId) {
    return new Promise(function (resolve, reject) {
        webviews.callAsync(tabId, 'executeJavaScript', 'document.body ? document.body.innerText : ""', function (err, result) {
            if (err) {
                reject(new Error('could not read the page contents'))
                return
            }
            resolve(typeof result === 'string' ? result : '')
        })
    })
}

const browserTools = [
    {
        id: 'tabs.list',
        scope: 'read',
        description: 'List the tabs open in the current task.',
        parameters: {},
        handler: function () {
            return { tabs: tabs.get().map(describeTab) }
        }
    },
    {
        id: 'tabs.open',
        scope: 'mutate',
        description: 'Open a URL in a new tab.',
        parameters: {
            url: { type: 'string', required: true, description: 'the URL or search term to open' },
            background: { type: 'boolean', default: false, description: 'open without switching to the tab' }
        },
        handler: function (args) {
            return { tabId: openTab(args.url, args.background), url: args.url }
        }
    },
    {
        id: 'tabs.close',
        scope: 'mutate',
        description: 'Close a tab by id.',
        parameters: {
            tabId: { type: 'string', required: true, description: 'id of the tab to close' }
        },
        handler: function (args) {
            if (!tabs.has(args.tabId)) {
                throw new Error('no tab with id ' + args.tabId)
            }
            browserUI.closeTab(args.tabId)
            return { closed: args.tabId }
        }
    },
    {
        id: 'search.web',
        scope: 'mutate',
        description: 'Search the web with the configured search engine and open the results in a tab.',
        parameters: {
            query: { type: 'string', required: true, description: 'what to search for' },
            background: { type: 'boolean', default: false, description: 'open without switching to the tab' }
        },
        handler: function (args) {
            const url = buildSearchURL(args.query)
            openTab(url, args.background)
            return { engine: searchEngine.getCurrent().name, url }
        }
    },
    {
        id: 'history.search',
        scope: 'read',
        description: 'Search visited pages by title and URL.',
        parameters: {
            query: { type: 'string', required: true, description: 'text to look for' },
            limit: { type: 'number', default: 10, description: 'maximum number of results' }
        },
        handler: async function (args) {
            const results = await places.searchPlaces(args.query, { limit: args.limit })
            return { results: (results || []).slice(0, args.limit).map(place => ({ url: place.url, title: place.title, lastVisit: place.lastVisit })) }
        }
    },
    {
        id: 'history.searchFullText',
        scope: 'read',
        description: 'Search the full text of visited pages.',
        parameters: {
            query: { type: 'string', required: true, description: 'text to look for' },
            limit: { type: 'number', default: 10, description: 'maximum number of results' }
        },
        handler: async function (args) {
            const results = await places.searchPlacesFullText(args.query)
            return { results: (results || []).slice(0, args.limit).map(place => ({ url: place.url, title: place.title, lastVisit: place.lastVisit })) }
        }
    },
    {
        id: 'page.getText',
        scope: 'read',
        description: 'Read the visible text of a tab, defaulting to the active one.',
        parameters: {
            tabId: { type: 'string', description: 'id of the tab to read' }
        },
        handler: async function (args) {
            const tabId = args.tabId || tabs.getSelected()
            const tab = tabs.get(tabId)

            if (!tab || !tab.url) {
                throw new Error('there is no page to read')
            }

            const text = (await getPageText(tabId)).trim()

            if (!text) {
                throw new Error('this page has no readable text')
            }

            return { url: tab.url, title: tab.title || '', text: text.slice(0, MAX_PAGE_TEXT_LENGTH), truncated: text.length > MAX_PAGE_TEXT_LENGTH }
        }
    },
    {
        id: 'tasks.list',
        scope: 'read',
        description: 'List the tasks (tab groups) in this window.',
        parameters: {},
        handler: function () {
            const selected = tasks.getSelected()
            return {
                tasks: tasks.map(task => ({
                    id: task.id,
                    name: task.name || '',
                    tabCount: task.tabs.count(),
                    selected: Boolean(selected && task.id === selected.id)
                }))
            }
        }
    },
    {
        id: 'tasks.createWithTabs',
        scope: 'mutate',
        description: 'Group a set of URLs into a new task and switch to it.',
        parameters: {
            name: { type: 'string', description: 'name for the new task' },
            urls: { type: 'array', required: true, description: 'URLs to open in the new task' }
        },
        handler: function (args) {
            const urls = args.urls.filter(url => typeof url === 'string' && url)

            if (urls.length === 0) {
                throw new Error('no URLs to group')
            }

            const currentTask = tasks.getSelected()
            const index = currentTask ? tasks.getIndex(currentTask.id) + 1 : undefined
            const taskId = tasks.add({ name: args.name || null }, index)

            browserUI.switchToTask(taskId)

            urls.forEach(function (url, i) {
                // the first tab replaces the empty tab switchToTask created
                openTab(url, i > 0)
            })

            return { taskId, name: args.name || '', tabCount: urls.length }
        }
    },
    {
        id: 'settings.get',
        scope: 'read',
        description: 'Read a browser setting. Allowed keys: ' + READABLE_SETTINGS.join(', ') + '.',
        parameters: {
            key: { type: 'string', required: true, description: 'setting name' }
        },
        handler: function (args) {
            if (!READABLE_SETTINGS.includes(args.key)) {
                throw new Error('setting "' + args.key + '" is not readable from the prompt')
            }
            return { key: args.key, value: settings.get(args.key) ?? null }
        }
    },
    {
        id: 'settings.set',
        scope: 'mutate',
        description: 'Change a browser setting. Allowed keys: ' + WRITABLE_SETTINGS.join(', ') + '.',
        parameters: {
            key: { type: 'string', required: true, description: 'setting name' },
            value: { type: 'string', required: true, description: 'new value' }
        },
        handler: function (args) {
            if (!WRITABLE_SETTINGS.includes(args.key)) {
                throw new Error('setting "' + args.key + '" is not writable from the prompt')
            }
            settings.set(args.key, args.value)
            return { key: args.key, value: args.value }
        }
    }
]

module.exports = browserTools
