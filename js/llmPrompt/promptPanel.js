var settings = require('util/settings/settings.js')
var engineClient = require('llmPrompt/engineClient.js')
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
        els.guidance.textContent = 'No LLM provider configured. Set MIN_LLM_PROVIDER and MIN_LLM_MODEL or configure llmProvider in settings.'
        return
    }

    if (state.engineStatus && state.engineStatus.capabilities) {
        els.guidance.textContent = 'Engine scopes available: ' + state.engineStatus.capabilities.join(', ')
    } else {
        els.guidance.textContent = ''
    }
}

function updateEngineStateLabel(els) {
    if (!state.engineStatus) {
        els.engineState.textContent = 'Checking engine...'
        return
    }

    if (!state.providerConfigured) {
        els.engineState.textContent = 'Provider unavailable'
        return
    }

    var providerLabel = state.engineStatus.provider || 'configured'
    var modelLabel = state.engineStatus.model ? (' / ' + state.engineStatus.model) : ''
    els.engineState.textContent = providerLabel + modelLabel
}

function updateControls(els) {
    els.send.disabled = !state.providerConfigured || state.sending
    updateEngineStateLabel(els)
    updateGuidance(els)
}

function setResponse(els, value) {
    els.response.textContent = value || ''
}

function normalizeResponse(response) {
    if (!response) {
        return ''
    }

    if (response.output) {
        return response.output
    }

    if (response.message) {
        return response.message
    }

    if (response.errorMessage) {
        return response.errorMessage
    }

    return ''
}

async function sendPrompt(els) {
    var prompt = els.input.value.trim()

    if (!prompt || state.sending) {
        return
    }

    state.sending = true
    updateControls(els)
    setResponse(els, 'Sending prompt...')

    try {
        const result = await engineClient.submitPrompt({
            prompt,
            capabilityScope: 'read',
            metadata: {
                panelPosition: state.position
            }
        })

        if (result && result.ok === false) {
            setResponse(els, result.errorMessage || 'Request failed')
        } else {
            setResponse(els, normalizeResponse(result) || 'Prompt sent.')
        }
    } catch (e) {
        setResponse(els, 'Unable to reach LLM engine bridge.')
    }

    state.sending = false
    updateControls(els)
}

function bindEvents(els) {
    els.send.addEventListener('click', function () {
        sendPrompt(els)
    })

    els.input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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
        bindEvents(els)
        updateControls(els)
        syncWebviewMargins(els)
        initializeEngineState(els)
    }
}

module.exports = promptPanel
