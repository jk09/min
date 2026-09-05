/*
Registry of web search engines the LLM prompt toolbar lets a user pick from.

Only 'bing' is functional today, matching the LLM prompt's current default
search destination. The others are safe, inert placeholders until their own
hand-off conventions are wired up.
*/

export interface SearchEngineOption {
  id: string
  title: string
  shortTitle: string
  functional: boolean
}

export const SEARCH_ENGINES: SearchEngineOption[] = [
  {
    id: 'bing',
    title: 'Bing',
    shortTitle: 'Bing',
    functional: true
  },
  {
    id: 'google',
    title: 'Google',
    shortTitle: 'Google',
    functional: false
  },
  {
    id: 'ecosia',
    title: 'Ecosia',
    shortTitle: 'Ecosia',
    functional: false
  },
  {
    id: 'startpage',
    title: 'Startpage',
    shortTitle: 'Startpage',
    functional: false
  }
]

export const DEFAULT_SEARCH_ENGINE_ID: string = 'bing'

export function list (): SearchEngineOption[] {
  return SEARCH_ENGINES.slice()
}

export function get (id: string): SearchEngineOption | null {
  return SEARCH_ENGINES.find(searchEngine => searchEngine.id === id) || null
}

export function getDefault (): SearchEngineOption | null {
  return get(DEFAULT_SEARCH_ENGINE_ID)
}

module.exports = {
  DEFAULT_SEARCH_ENGINE_ID,
  list,
  get,
  getDefault
}
