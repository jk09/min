/*
Registry of web search engines the LLM prompt toolbar lets a user pick from.

Only 'bing' is functional today, matching the LLM prompt's current default
search destination. The others are safe, inert placeholders until their own
hand-off conventions are wired up.
*/

const SEARCH_ENGINES = [
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

const DEFAULT_SEARCH_ENGINE_ID = 'bing'

function list () {
    return SEARCH_ENGINES.slice()
}

function get (id) {
    return SEARCH_ENGINES.find(searchEngine => searchEngine.id === id) || null
}

function getDefault () {
    return get(DEFAULT_SEARCH_ENGINE_ID)
}

module.exports = {
    DEFAULT_SEARCH_ENGINE_ID,
    list,
    get,
    getDefault
}
