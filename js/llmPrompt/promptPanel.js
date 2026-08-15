var settings = require('util/settings/settings.js')
var engineClient = require('llmPrompt/engineClient.js')
var promptRouter = require('llmPrompt/promptRouter.js')
var webviews = require('webviews.js')
var browserUI = require('browserUI.js')
var places = require('places/places.js')
var urlParser = require('util/urlParser.js')

const ALLOWED_POSITIONS = ['bottom', 'top', 'left', 'right']
const HISTORY_SUGGESTIONS_DEBOUNCE = 120
const HISTORY_SUGGESTIONS_LIMIT = 6

const state = {
    position: 'bottom',
    providerConfigured: false,
    sending: false,
    engineStatus: null,
    appliedMargins: [0, 0, 0, 0],
    observer: null,
    historyResults: [],
    historyActiveIndex: -1,
    historyRequestToken: 0,
    historyDebounceTimer: null
}

function getPanelElements() {
    return {
        panel: document.getElementById('llm-prompt-panel'),
        input: document.getElementById('llm-prompt-input'),
        send: document.getElementById('llm-prompt-send'),
        response: document.getElementById('llm-prompt-response'),
        guidance: document.getElementById('llm-prompt-guidance'),
        engineState: document.getElementById('llm-prompt-engine-state'),
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

function getTargetMargins(panelRect) {
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

    return [0, 0, Math.round(panelRect.height), 0]
}

function syncWebviewMargins(els) {
    const panelRect = els.panel.getBoundingClientRect()
    const nextMargins = getTargetMargins(panelRect)
    const delta = nextMargins.map(function (value, idx) {
        return value - state.appliedMargins[idx]
    })

    if (delta.some(value => value !== 0)) {
        webviews.adjustMargin(delta)
        state.appliedMargins = nextMargins
    }
}

function updateGuidance(els) {
    if (!state.providerConfigured) {
        els.guidance.textContent = 'Skills work without a model. For general questions, configure llmProvider, llmModel and llmApiKey.'
        return
    }

    els.guidance.textContent = 'Type / to list skills.'
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

function appendEntry(els, className, text) {
    if (!text) {
        return null
    }

    var entry = document.createElement('div')
    entry.className = 'llm-prompt-entry ' + className
    entry.textContent = text
    els.response.appendChild(entry)
    els.response.scrollTop = els.response.scrollHeight
    return entry
}

/*
Address-bar-style history suggestions. Purely advisory - selecting one navigates
directly, typing past it and submitting still falls through to the prompt router.
*/
function hideHistoryDropdown(els) {
    state.historyResults = []
    state.historyActiveIndex = -1
    els.history.hidden = true
    els.history.innerHTML = ''
    els.input.setAttribute('aria-expanded', 'false')
}

function openHistoryItem(els, item) {
    var tabId = tabs.add({ url: urlParser.parse(item.url) })
    browserUI.addTab(tabId, { enterEditMode: false, openInBackground: false })
    els.input.value = ''
    hideHistoryDropdown(els)
}

function setHistoryActiveIndex(els, index) {
    var items = els.history.querySelectorAll('.llm-prompt-history-item')
    items.forEach(function (item, idx) {
        item.classList.toggle('llm-prompt-history-item-active', idx === index)
    })
    state.historyActiveIndex = index
}

function renderHistoryDropdown(els, results) {
    state.historyResults = results
    state.historyActiveIndex = -1
    els.history.innerHTML = ''

    if (results.length === 0) {
        els.history.hidden = true
        return
    }

    results.forEach(function (place, index) {
        var item = document.createElement('div')
        item.className = 'llm-prompt-history-item'
        item.setAttribute('role', 'option')

        var title = document.createElement('div')
        title.className = 'llm-prompt-history-item-title'
        title.textContent = place.title || urlParser.prettyURL(place.url)
        item.appendChild(title)

        var url = document.createElement('div')
        url.className = 'llm-prompt-history-item-url'
        url.textContent = urlParser.prettyURL(place.url)
        item.appendChild(url)

        item.addEventListener('mousedown', function (e) {
            // mousedown, not click - fires before the input blurs the dropdown away
            e.preventDefault()
            openHistoryItem(els, place)
        })

        item.addEventListener('mouseenter', function () {
            setHistoryActiveIndex(els, index)
        })

        els.history.appendChild(item)
    })

    els.history.hidden = false
    els.input.setAttribute('aria-expanded', 'true')
}

function fetchHistorySuggestions(els, text) {
    if (state.historyDebounceTimer) {
        clearTimeout(state.historyDebounceTimer)
    }

    // '/' starts skill mode, not a search or history navigation
    if (!text || text.indexOf('/') === 0) {
        hideHistoryDropdown(els)
        return
    }

    state.historyDebounceTimer = setTimeout(function () {
        var requestToken = ++state.historyRequestToken

        places.searchPlaces(text, { limit: HISTORY_SUGGESTIONS_LIMIT }).then(function (results) {
            // ignore stale responses from a superseded keystroke
            if (requestToken !== state.historyRequestToken) {
                return
            }
            renderHistoryDropdown(els, (results || []).slice(0, HISTORY_SUGGESTIONS_LIMIT))
        }).catch(function () {
            if (requestToken === state.historyRequestToken) {
                hideHistoryDropdown(els)
            }
        })
    }, HISTORY_SUGGESTIONS_DEBOUNCE)
}

function describeTrace(trace) {
    if (!trace || trace.length === 0) {
        return ''
    }

    return trace.map(function (step) {
        return (step.ok ? '' : '\u2717 ') + step.tool
    }).join(' \u2192 ')
}

function renderResult(els, result) {
    appendEntry(els, 'llm-prompt-trace', describeTrace(result.trace))
    appendEntry(els, result.ok ? 'llm-prompt-answer' : 'llm-prompt-error', result.message)
    appendEntry(els, 'llm-prompt-detail', result.detail)
}

async function sendPrompt(els) {
    var prompt = els.input.value.trim()

    if (!prompt || state.sending) {
        return
    }

    state.sending = true
    updateControls(els)
    appendEntry(els, 'llm-prompt-request', prompt)
    els.input.value = ''
    hideHistoryDropdown(els)

    var pending = appendEntry(els, 'llm-prompt-detail', 'Working\u2026')

    try {
        const result = await promptRouter.handlePrompt(prompt, { scope: 'mutate' })
        pending.remove()
        renderResult(els, result)
    } catch (e) {
        pending.remove()
        appendEntry(els, 'llm-prompt-error', 'The prompt runtime failed: ' + (e && e.message ? e.message : 'unknown error'))
    }

    state.sending = false
    updateControls(els)
}

function bindEvents(els) {
    els.send.addEventListener('click', function () {
        sendPrompt(els)
    })

    els.input.addEventListener('keydown', function (e) {
        var hasSuggestions = !els.history.hidden && state.historyResults.length > 0

        if (hasSuggestions && e.key === 'ArrowDown') {
            e.preventDefault()
            setHistoryActiveIndex(els, Math.min(state.historyActiveIndex + 1, state.historyResults.length - 1))
            return
        }

        if (hasSuggestions && e.key === 'ArrowUp') {
            e.preventDefault()
            setHistoryActiveIndex(els, Math.max(state.historyActiveIndex - 1, 0))
            return
        }

        if (hasSuggestions && e.key === 'Escape') {
            e.preventDefault()
            hideHistoryDropdown(els)
            return
        }

        // Enter submits, or navigates to the highlighted suggestion; Shift+Enter inserts a newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (hasSuggestions && state.historyActiveIndex >= 0) {
                openHistoryItem(els, state.historyResults[state.historyActiveIndex])
                return
            }
            sendPrompt(els)
        }
    })

    els.input.addEventListener('input', function () {
        fetchHistorySuggestions(els, els.input.value.trim())
    })

    els.input.addEventListener('blur', function () {
        // let mousedown on a suggestion register before the dropdown disappears
        setTimeout(function () { hideHistoryDropdown(els) }, 100)
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
        promptRouter.initialize()
        bindEvents(els)
        updateControls(els)
        syncWebviewMargins(els)
        initializeEngineState(els)
    }
}

module.exports = promptPanel
