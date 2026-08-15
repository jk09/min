var settings = require('util/settings/settings.js')
var engineClient = require('llmPrompt/engineClient.js')
var buildInfoView = require('llmPrompt/buildInfo.js')
var buildInfoData = require('dist/buildInfo.build.js')
var promptRouter = require('llmPrompt/promptRouter.js')
var webviews = require('webviews.js')
var places = require('places/places.js')

const ALLOWED_POSITIONS = ['bottom', 'top', 'left', 'right']

const state = {
    position: 'bottom',
    providerConfigured: false,
    sending: false,
    hasResult: false,
    engineStatus: null,
    appliedMargins: [0, 0, 0, 0],
    observer: null,
    historySuggestions: [],
    selectedHistorySuggestion: -1,
    historyRequestId: 0
}

function getPanelElements() {
    return {
        panel: document.getElementById('llm-prompt-panel'),
        input: document.getElementById('llm-prompt-input'),
        send: document.getElementById('llm-prompt-send'),
        result: document.getElementById('llm-prompt-result'),
        engineState: document.getElementById('llm-prompt-engine-state'),
        buildInfo: document.getElementById('llm-prompt-build-info'),
        history: document.getElementById('llm-prompt-history')
    }
}

function getConfiguredPosition() {
    var configuredPosition = settings.get('llmPromptPanelPosition') || 'bottom'
    if (!ALLOWED_POSITIONS.includes(configuredPosition)) {
        configuredPosition = 'bottom'
    }
    return configuredPosition
}

function applyPosition(panel, position) {
    state.position = position
    panel.setAttribute('data-position', position)
    document.body.setAttribute('data-llm-panel-position', position)
    document.body.classList.add('llm-prompt-panel-visible')
}

function isPanelVisibleForCurrentMode() {
    // show the panel only when a page webview is active, not in the new-tab/address-selection UI mode
    return !document.body.classList.contains('is-ntp')
}

function getTargetMargins(panelRect, history) {
    if (!isPanelVisibleForCurrentMode()) {
        return [0, 0, 0, 0]
    }

    if (state.position === 'top') {
        return [Math.round(panelRect.height), 0, 0, 0]
    }

    if (state.position === 'left') {
        return [0, 0, 0, Math.round(panelRect.width)]
    }

    if (state.position === 'right') {
        return [0, Math.round(panelRect.width), 0, 0]
    }

    const historyHeight = history && !history.hidden
        ? Math.max(0, Math.round(panelRect.top - history.getBoundingClientRect().top))
        : 0
    return [0, 0, Math.round(panelRect.height) + historyHeight, 0]
}

function syncWebviewMargins(els) {
    const panelRect = els.panel.getBoundingClientRect()
    const nextMargins = getTargetMargins(panelRect, els.history)
    const delta = nextMargins.map(function (value, idx) {
        return value - state.appliedMargins[idx]
    })

    if (delta.some(value => value !== 0)) {
        webviews.adjustMargin(delta)
        state.appliedMargins = nextMargins
    }
}

function updateGuidance(els) {
    // the result line doubles as guidance until the first prompt is sent
    if (state.hasResult) {
        return
    }

    els.result.textContent = state.providerConfigured
        ? 'Type / to list skills.'
        : 'Search and skills work without a model.'
}

function updateEngineStateLabel(els) {
    if (!state.engineStatus) {
        els.engineState.textContent = 'Checking engine...'
        return
    }

    if (!state.providerConfigured) {
        els.engineState.textContent = 'Skills only'
        return
    }

    var providerLabel = state.engineStatus.provider || 'configured'
    var modelLabel = state.engineStatus.model ? (' / ' + state.engineStatus.model) : ''
    els.engineState.textContent = providerLabel + modelLabel
}

function updateControls(els) {
    // deterministic skills run without a provider, so the panel is never fully disabled
    els.send.disabled = state.sending
    updateEngineStateLabel(els)
    updateGuidance(els)
}

function describeTrace(trace) {
    if (!trace || trace.length === 0) {
        return ''
    }

    return trace.map(function (step) {
        return (step.ok ? '' : '\u2717 ') + step.tool
    }).join(' \u2192 ')
}

function setResult(els, text, isError) {
    state.hasResult = true
    els.result.textContent = text
    els.result.classList.toggle('llm-prompt-error', Boolean(isError))
}

function renderResult(els, result) {
    var text = [describeTrace(result.trace), result.message, result.detail].filter(Boolean).join(' \u2014 ')
    setResult(els, text, !result.ok)
}

async function sendPrompt(els) {
    var prompt = els.input.value.trim()

    if (!prompt || state.sending) {
        return
    }

    state.sending = true
    updateControls(els)
    clearHistorySuggestions(els)
    els.input.value = ''
    setResult(els, 'Working\u2026', false)

    try {
        const result = await promptRouter.handlePrompt(prompt, { scope: 'mutate' })
        renderResult(els, result)
    } catch (e) {
        setResult(els, 'The prompt runtime failed: ' + (e && e.message ? e.message : 'unknown error'), true)
    }

    state.sending = false
    updateControls(els)
}

function clearHistorySuggestions(els) {
    state.historyRequestId++
    state.historySuggestions = []
    state.selectedHistorySuggestion = -1
    els.history.replaceChildren()
    els.history.hidden = true
    syncWebviewMargins(els)
}

function updateHistorySelection(els, index) {
    state.selectedHistorySuggestion = index

    Array.from(els.history.children).forEach(function (item, itemIndex) {
        const selected = itemIndex === index
        item.classList.toggle('selected', selected)
        item.setAttribute('aria-selected', String(selected))
        if (selected) {
            item.scrollIntoView({ block: 'nearest' })
        }
    })
}

async function openHistorySuggestion(els, suggestion) {
    if (!suggestion) {
        return
    }

    clearHistorySuggestions(els)
    els.input.value = ''
    await promptRouter.toolRegistry.run('tabs.open', { url: suggestion.url }, { scope: 'mutate' })
}

function renderHistorySuggestions(els, suggestions) {
    state.historySuggestions = suggestions
    state.selectedHistorySuggestion = -1
    els.history.replaceChildren()

    suggestions.forEach(function (suggestion, index) {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'llm-prompt-history-item'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', 'false')

        const title = document.createElement('span')
        title.className = 'llm-prompt-history-title'
        title.textContent = suggestion.title || suggestion.url

        const url = document.createElement('span')
        url.className = 'llm-prompt-history-url'
        url.textContent = suggestion.url

        item.append(title, url)
        item.addEventListener('mouseenter', function () {
            updateHistorySelection(els, index)
        })
        item.addEventListener('click', function () {
            openHistorySuggestion(els, suggestion)
        })
        els.history.appendChild(item)
    })

    els.history.hidden = suggestions.length === 0
    syncWebviewMargins(els)
}

async function updateHistorySuggestions(els) {
    const query = els.input.value.trim()
    const requestId = ++state.historyRequestId

    if (!query || query.startsWith('/')) {
        clearHistorySuggestions(els)
        return
    }

    try {
        const results = await places.searchPlaces(query, { limit: 6 })
        if (requestId !== state.historyRequestId) {
            return
        }
        renderHistorySuggestions(els, (results || []).filter(result => result && result.url))
    } catch (e) {
        if (requestId === state.historyRequestId) {
            clearHistorySuggestions(els)
        }
    }
}

function bindEvents(els) {
    els.send.addEventListener('click', function () {
        sendPrompt(els)
    })

    els.input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' && state.historySuggestions.length > 0) {
            e.preventDefault()
            updateHistorySelection(els, Math.min(state.selectedHistorySuggestion + 1, state.historySuggestions.length - 1))
            return
        }

        if (e.key === 'ArrowUp' && state.historySuggestions.length > 0) {
            e.preventDefault()
            updateHistorySelection(els, Math.max(state.selectedHistorySuggestion - 1, 0))
            return
        }

        if (e.key === 'Escape' && state.historySuggestions.length > 0) {
            e.preventDefault()
            clearHistorySuggestions(els)
            return
        }

        // Enter submits; Shift+Enter inserts a newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (state.selectedHistorySuggestion >= 0) {
                openHistorySuggestion(els, state.historySuggestions[state.selectedHistorySuggestion])
                return
            }
            sendPrompt(els)
        }
    })

    els.input.addEventListener('input', function () {
        updateHistorySuggestions(els)
    })

    settings.listen('llmPromptPanelPosition', function (nextPosition) {
        if (!nextPosition) {
            return
        }

        if (ALLOWED_POSITIONS.includes(nextPosition)) {
            applyPosition(els.panel, nextPosition)
            syncWebviewMargins(els)
        }
    })

    window.addEventListener('resize', function () {
        syncWebviewMargins(els)
    })

    if (!state.observer) {
        state.observer = new MutationObserver(function () {
            syncWebviewMargins(els)
        })

        state.observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        })
    }
}

async function initializeEngineState(els) {
    try {
        const status = await engineClient.getStatus()
        state.engineStatus = status
        state.providerConfigured = Boolean(status && status.providerConfigured)
    } catch (e) {
        state.engineStatus = {
            providerConfigured: false,
            capabilities: ['read', 'mutate']
        }
        state.providerConfigured = false
    }

    updateControls(els)
}

var promptPanel = {
    initialize: function () {
        const els = getPanelElements()
        if (!els.panel) {
            return
        }

        applyPosition(els.panel, getConfiguredPosition())
        buildInfoView.render(els.buildInfo, buildInfoData)
        promptRouter.initialize()
        bindEvents(els)
        updateControls(els)
        syncWebviewMargins(els)
        initializeEngineState(els)
    }
}

module.exports = promptPanel
