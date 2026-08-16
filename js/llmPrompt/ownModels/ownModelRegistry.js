/*
Registry of "own model" options the LLM prompt toolbar lets a user pick from to
handle /b <command> planning (bring-your-own-model - see spec/backlog/feat-h4qz2r-nl-browser-commands/SPEC.md).

Only 'configured' is functional today: it uses whatever provider the user has
already set up for the whole LLM prompt (llmProvider/llmModel/llmBaseURL/
llmApiKey, see main/llmEngine.js). The others are safe, inert placeholders
reserved for a future per-purpose model configuration.
*/

const OWN_MODELS = [
    {
        id: 'configured',
        title: 'Configured model (Settings)',
        shortTitle: 'Configured',
        functional: true
    },
    {
        id: 'openai',
        title: 'OpenAI (direct)',
        shortTitle: 'OpenAI',
        functional: false
    },
    {
        id: 'claude',
        title: 'Anthropic Claude (via OpenRouter)',
        shortTitle: 'Claude',
        functional: false
    },
    {
        id: 'ollama',
        title: 'Local model (Ollama)',
        shortTitle: 'Ollama',
        functional: false
    }
]

const DEFAULT_OWN_MODEL_ID = 'configured'

function list () {
    return OWN_MODELS.slice()
}

function get (id) {
    return OWN_MODELS.find(ownModel => ownModel.id === id) || null
}

function getDefault () {
    return get(DEFAULT_OWN_MODEL_ID)
}

module.exports = {
    DEFAULT_OWN_MODEL_ID,
    list,
    get,
    getDefault
}
