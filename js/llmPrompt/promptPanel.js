var settings = require('util/settings/settings.js')
var engineClient = require('llmPrompt/engineClient.js')
var promptRouter = require('llmPrompt/promptRouter.js')
var webviews = require('webviews.js')

const ALLOWED_POSITIONS = ['bottom', 'top', 'left', 'right']

const state = {
    position: 'bottom',
    providerConfigured: false,
    sending: false,
    engineStatus: null,
    appliedMargins: [0, 0, 0, 0],
    observer: null
}

function getPanelElements() {
    return {
        panel: document.getElementById('llm-prompt-panel'),
        input: document.getElementById('llm-prompt-input'),
        send: document.getElementById('llm-prompt-send'),
        response: document.getElementById('llm-prompt-response'),
        guidance: document.getElementById('llm-prompt-guidance'),
        engineState: document.getElementById('llm-prompt-engine-state')
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
        // Enter submits; Shift+Enter inserts a newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendPrompt(els)
        }
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
