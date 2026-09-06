/* Built-in tools: thin, validated wrappers around existing Min subsystems. */

import type { TabItem } from '../../../types/min'

type ToolParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object'
type ToolScope = 'read' | 'mutate'

interface ToolParameter {
  type: ToolParameterType
  required?: boolean
  default?: unknown
  description?: string
}

interface BrowserTool {
  id: string
  scope: ToolScope
  description: string
  parameters: Record<string, ToolParameter>
  handler: (args: any) => unknown | Promise<unknown>
}

const browserUI = require('browserUI.js')
const searchEngine = require('util/searchEngine.js')
const urlParser = require('util/urlParser.js')
const places = require('places/places.js')
const webviews = require('webviews.js')
const settings = require('util/settings/settings.js')

const READABLE_SETTINGS = ['searchEngine', 'llmProvider', 'llmModel']
const WRITABLE_SETTINGS = ['llmProvider', 'llmModel']
const MAX_PAGE_TEXT_LENGTH = 12000
const MAX_TABS_OPEN_MANY = 10

function buildSearchURL (query: string): string {
  const engine = searchEngine.getCurrent()
  return engine.searchURL.replace('%s', encodeURIComponent(query))
}

function describeTab (tab: TabItem) {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title || '',
    selected: tab.id === tabs.getSelected()
  }
}

function openTab (url: string, background: boolean): string {
  const tabId = tabs.add({ url: urlParser.parse(url) })
  browserUI.addTab(tabId, { openPrompt: false, openInBackground: Boolean(background) })
  return tabId
}

function getPageText (tabId: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    webviews.callAsync(tabId, 'executeJavaScript', 'document.body ? document.body.innerText : ""', function (err: Error | null, result: unknown) {
      if (err) {
        reject(new Error('could not read the page contents'))
        return
      }
      resolve(typeof result === 'string' ? result : '')
    })
  })
}

const browserTools: BrowserTool[] = [
  {
    id: 'tabs.list',
    scope: 'read',
    description: 'List the tabs open in the current task.',
    parameters: {},
    handler: function () {
      return { tabs: tabs.map(describeTab) }
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
    handler: function (args: { url: string; background: boolean }) {
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
    handler: function (args: { tabId: string }) {
      // Model-generated plans occasionally use placeholders; skip these safely.
      if (args.tabId === '*' || args.tabId === '<id>' || args.tabId === 'any') {
        return { closed: null, skipped: true, reason: 'placeholder tab id' }
      }

      if (!tabs.has(args.tabId)) {
        throw new Error('no tab with id ' + args.tabId)
      }
      browserUI.closeTab(args.tabId)
      return { closed: args.tabId }
    }
  },
  {
    id: 'tabs.openMany',
    scope: 'mutate',
    description: 'Open several URLs at once, each in its own new tab.',
    parameters: {
      urls: { type: 'array', required: true, description: 'list of URLs or search terms to open' },
      background: { type: 'boolean', default: false, description: 'open without switching to the tabs' }
    },
    handler: function (args: { urls: string[]; background: boolean }) {
      if (!Array.isArray(args.urls) || args.urls.length === 0) {
        throw new Error('urls must be a non-empty list')
      }
      if (args.urls.length > MAX_TABS_OPEN_MANY) {
        throw new Error('cannot open more than ' + MAX_TABS_OPEN_MANY + ' tabs at once')
      }

      const tabIds = args.urls.map(url => openTab(url, args.background))
      return { tabIds, count: tabIds.length }
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
    handler: function (args: { query: string; background: boolean }) {
      const url = buildSearchURL(args.query)
      openTab(url, args.background)
      return { engine: searchEngine.getCurrent().name, url }
    }
  },
  {
    id: 'history.search',
    scope: 'read',
    description: 'Search visited pages, page digests, and personal notes.',
    parameters: {
      query: { type: 'string', required: true, description: 'text to look for' },
      limit: { type: 'number', default: 10, description: 'maximum number of results' }
    },
    handler: async function (args: { query: string; limit: number }) {
      const results = await places.searchHistoryGraph(args.query)
      return { results: (results || []).slice(0, args.limit).map((place: any) => ({
        id: place.id,
        url: place.url,
        canonicalURL: place.canonicalURL,
        title: place.title,
        contentDigest: place.contentDigest,
        notes: (place.notes || []).map((note: any) => note.text),
        lastVisit: place.lastVisit,
        visitCount: place.visitCount,
        relationshipCount: place.relationshipCount,
        relevance: place.relevance
      })) }
    }
  },
  {
    id: 'history.searchFullText',
    scope: 'read',
    description: 'Search visited page content, digests, and personal notes.',
    parameters: {
      query: { type: 'string', required: true, description: 'text to look for' },
      limit: { type: 'number', default: 10, description: 'maximum number of results' }
    },
    handler: async function (args: { query: string; limit: number }) {
      const results = await places.searchHistoryGraph(args.query)
      return { results: (results || []).slice(0, args.limit).map((place: any) => ({
        id: place.id,
        url: place.url,
        title: place.title,
        contentDigest: place.contentDigest,
        notes: (place.notes || []).map((note: any) => note.text),
        lastVisit: place.lastVisit,
        relevance: place.relevance
      })) }
    }
  },
  {
    id: 'page.getText',
    scope: 'read',
    description: 'Read the visible text of a tab, defaulting to the active one.',
    parameters: {
      tabId: { type: 'string', description: 'id of the tab to read' }
    },
    handler: async function (args: { tabId?: string }) {
      const tabId = args.tabId || tabs.getSelected()

      if (!tabId) {
        throw new Error('there is no page to read')
      }

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
    id: 'settings.get',
    scope: 'read',
    description: 'Read a browser setting. Allowed keys: ' + READABLE_SETTINGS.join(', ') + '.',
    parameters: {
      key: { type: 'string', required: true, description: 'setting name' }
    },
    handler: function (args: { key: string }) {
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
    handler: function (args: { key: string; value: string }) {
      if (!WRITABLE_SETTINGS.includes(args.key)) {
        throw new Error('setting "' + args.key + '" is not writable from the prompt')
      }
      settings.set(args.key, args.value)
      return { key: args.key, value: args.value }
    }
  }
]

module.exports = browserTools