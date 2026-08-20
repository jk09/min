const { ipcMain: ipc } = require('electron')
const { TextDecoder } = require('util')
const settings = require('../js/util/settings/settingsMain')
const AbortController = global.AbortController

/*
Provider adapter for the prompt runtime. This module only talks to the model -
browser capabilities live in the renderer tool registry, so nothing here can act
on the browser.
*/

const LLM_ENGINE_SCOPES = ['read', 'mutate']
const REQUEST_TIMEOUT = 60000
const MAX_PROMPT_LENGTH = 24000

const PROVIDER_DEFAULTS = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    ollama: 'http://localhost:11434/v1',
    lmstudio: 'http://localhost:1234/v1'
}

const activeRequests = new Map()

function readConfig (key, envName) {
    return process.env[envName] || settings.get(key) || null
}

function getConfiguredProvider () {
    return readConfig('llmProvider', 'MIN_LLM_PROVIDER')
}

function getConfiguredModel () {
    return readConfig('llmModel', 'MIN_LLM_MODEL')
}

function getBaseURL (provider) {
    return readConfig('llmBaseURL', 'MIN_LLM_BASE_URL') || PROVIDER_DEFAULTS[provider] || null
}

function getApiKey () {
    return readConfig('llmApiKey', 'MIN_LLM_API_KEY')
}

function getEngineStatus () {
    const provider = getConfiguredProvider()
    const model = getConfiguredModel()
    const baseURL = provider ? getBaseURL(provider) : null

    return {
        providerConfigured: Boolean(provider && model && baseURL),
        provider,
        model,
        capabilities: LLM_ENGINE_SCOPES
    }
}

function readStreamMessages (text) {
    return text.split('\n').map(function (line) {
        return line.trim()
    }).filter(function (line) {
        return line.startsWith('data: ')
    }).map(function (line) {
        return line.slice(6).trim()
    })
}

function parseStreamDelta (message) {
    try {
        const data = JSON.parse(message)
        return data && data.choices && data.choices[0] && data.choices[0].delta
            ? data.choices[0].delta.content || ''
            : ''
    } catch (e) {
        return ''
    }
}

function appendStreamMessage (message, requestId, webContents, currentOutput) {
    if (message === '[DONE]') {
        return currentOutput
    }

    const delta = parseStreamDelta(message)
    if (!delta) {
        return currentOutput
    }

    webContents.send('llmEngine:progress:' + requestId, { text: delta })
    return currentOutput + delta
}

async function readStreamingResponse (response, requestId, webContents) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let output = ''

    while (true) {
        const next = await reader.read()
        if (next.done) {
            break
        }

        buffer += decoder.decode(next.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        readStreamMessages(lines.join('\n')).forEach(function (message) {
            output = appendStreamMessage(message, requestId, webContents, output)
        })
    }

    buffer += decoder.decode()
    readStreamMessages(buffer).forEach(function (message) {
        output = appendStreamMessage(message, requestId, webContents, output)
    })

    return output
}

async function requestCompletion (request, event) {
    const provider = getConfiguredProvider()
    const model = getConfiguredModel()
    const baseURL = getBaseURL(provider)
    const apiKey = getApiKey()
    const requestId = typeof request.requestId === 'string' ? request.requestId : null

    const messages = []
    if (request.system) {
        messages.push({ role: 'system', content: String(request.system) })
    }
    messages.push({ role: 'user', content: String(request.prompt).slice(0, MAX_PROMPT_LENGTH) })

    const body = { model, messages, stream: Boolean(request.stream && requestId) }
    if (request.responseFormat === 'json') {
        body.response_format = { type: 'json_object' }
    }

    const controller = new AbortController()
    const activeRequest = { controller, cancelled: false }
    if (requestId) {
        activeRequests.set(requestId, activeRequest)
    }
    const timeout = setTimeout(function () {
        controller.abort()
    }, REQUEST_TIMEOUT)

    try {
        const response = await fetch(baseURL.replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: Object.assign(
                { 'Content-Type': 'application/json' },
                apiKey ? { Authorization: 'Bearer ' + apiKey } : {}
            ),
            body: JSON.stringify(body),
            signal: controller.signal
        })

        if (!response.ok) {
            return {
                ok: false,
                errorCode: 'provider_error',
                errorMessage: 'The model provider returned status ' + response.status + '.'
            }
        }

        const output = body.stream
            ? await readStreamingResponse(response, requestId, event.sender)
            : await response.json().then(function (data) {
                return data && data.choices && data.choices[0] && data.choices[0].message
                    ? data.choices[0].message.content
                    : null
            })

        if (!output) {
            return { ok: false, errorCode: 'empty_response', errorMessage: 'The model returned an empty response.' }
        }

        return { ok: true, output }
    } catch (e) {
        if (e.name === 'AbortError') {
            if (activeRequest.cancelled) {
                return { ok: false, errorCode: 'cancelled', errorMessage: 'The model request was stopped.' }
            }
            return { ok: false, errorCode: 'timeout', errorMessage: 'The model did not respond in time.' }
        }
        return { ok: false, errorCode: 'request_failed', errorMessage: 'Could not reach the model provider.' }
    } finally {
        clearTimeout(timeout)
        if (requestId) {
            activeRequests.delete(requestId)
        }
    }
}

ipc.handle('llmEngine:getStatus', function () {
    return getEngineStatus()
})

ipc.handle('llmEngine:complete', async function (event, request = {}) {
    const prompt = typeof request.prompt === 'string' ? request.prompt.trim() : ''

    if (!prompt) {
        return { ok: false, errorCode: 'empty_prompt', errorMessage: 'Prompt is empty.' }
    }

    if (!getEngineStatus().providerConfigured) {
        return {
            ok: false,
            errorCode: 'provider_not_configured',
            errorMessage: 'No model is configured. Set llmProvider, llmModel and llmApiKey in settings, or the MIN_LLM_* environment variables.'
        }
    }

    return requestCompletion(Object.assign({}, request, { prompt }), event)
})

ipc.handle('llmEngine:cancel', function (event, request = {}) {
    const requestId = typeof request.requestId === 'string' ? request.requestId : null
    const activeRequest = requestId ? activeRequests.get(requestId) : null

    if (!activeRequest) {
        return { ok: false, errorCode: 'not_found' }
    }

    activeRequest.cancelled = true
    activeRequest.controller.abort()
    return { ok: true }
})
