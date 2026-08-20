var engineClient = require('llmPrompt/engineClient.js')
var buildInfoView = require('llmPrompt/buildInfo.js')
var buildInfoData = require('dist/buildInfo.build.js')
var promptRouter = require('llmPrompt/promptRouter.js')
var agentRegistry = require('llmPrompt/agents/agentRegistry.js')
var ownModelRegistry = require('llmPrompt/ownModels/ownModelRegistry.js')
var debugTab = require('llmPrompt/debugTab.js')
var webviews = require('webviews.js')
var places = require('places/places.js')

const PLACEHOLDER_REASON = 'llmPrompt'

const state = {
    open: false,
    providerConfigured: false,
    sending: false,
    hasResult: false,
    engineStatus: null,
    appliedMargins: [0, 0, 0, 0],
    previouslyFocused: null,
    historySuggestions: [],
    selectedHistorySuggestion: -1,
    historyRequestId: 0,
    debugEnabled: false
}

function getPanelElements() {
    return {
        overlay: document.getElementById('llm-prompt-overlay'),
        scrim: document.getElementById('llm-prompt-scrim'),
        panel: document.getElementById('llm-prompt-panel'),
        statusBar: document.getElementById('status-bar'),
        promptButton: document.getElementById('status-bar-prompt-button'),
        input: document.getElementById('llm-prompt-input'),
        send: document.getElementById('llm-prompt-send'),
        result: document.getElementById('llm-prompt-result'),
        engineState: document.getElementById('llm-prompt-engine-state'),
        buildInfo: document.getElementById('llm-prompt-build-info'),
        history: document.getElementById('llm-prompt-history'),
        debugToggle: document.getElementById('llm-prompt-debug'),
        debugLink: document.getElementById('llm-prompt-debug-link')
    }
}

// the overlay floats above the page, so only the status bar reduces the webview area
function getTargetMargins(statusBarRect) {
    return [0, 0, Math.round(statusBarRect.height), 0]
}

function syncWebviewMargins(els) {
    const nextMargins = getTargetMargins(els.statusBar.getBoundingClientRect())
    const delta = nextMargins.map(function (value, idx) {
        return value - state.appliedMargins[idx]
    })

    if (delta.some(value => value !== 0)) {
        webviews.adjustMargin(delta)
        state.appliedMargins = nextMargins
    }
}

function autoGrowInput(input) {
    input.style.height = 'auto'
    input.style.height = input.scrollHeight + 'px'
}

function openPanel(els) {
    if (state.open || !els.panel) {
        return
    }

    state.open = true
    state.previouslyFocused = document.activeElement
    els.overlay.hidden = false
    document.body.classList.add('llm-prompt-overlay-open')
    webviews.requestPlaceholder(PLACEHOLDER_REASON)
    autoGrowInput(els.input)
    els.input.focus()
}

function closePanel(els) {
    if (!state.open) {
        return
    }

    state.open = false
    clearHistorySuggestions(els)
    els.overlay.hidden = true
    document.body.classList.remove('llm-prompt-overlay-open')
    webviews.hidePlaceholder(PLACEHOLDER_REASON)

    const restoreTarget = state.previouslyFocused
    state.previouslyFocused = null

    if (restoreTarget && restoreTarget !== document.body && restoreTarget.focus && document.contains(restoreTarget)) {
        restoreTarget.focus()
    } else {
        webviews.focus()
    }
}

function trapFocus(els, e) {
    const focusable = Array.from(els.panel.querySelectorAll('textarea, button:not([disabled])'))
    if (focusable.length === 0) {
        return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
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
    els.input.value = ''
    autoGrowInput(els.input)
    setResult(els, 'Working\u2026', false)
    // results are reported in the status bar, so the overlay gets out of the way immediately
    closePanel(els)

    try {
        const result = await promptRouter.handlePrompt(prompt, {
            scope: 'mutate',
            agentId: agentRegistry.DEFAULT_AGENT_ID,
            ownModelId: ownModelRegistry.DEFAULT_OWN_MODEL_ID,
            debug: state.debugEnabled
        })
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

    els.input.value = ''
    autoGrowInput(els.input)
    closePanel(els)
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

function updateDebugToggleLabel(els) {
    els.debugToggle.classList.toggle('active', state.debugEnabled)
    els.debugToggle.setAttribute('aria-pressed', String(state.debugEnabled))
    els.debugToggle.title = state.debugEnabled
        ? 'Debug: on - /b opens a debug tab with the full model exchange'
        : 'Debug: off - turn on to inspect /b runs in a dedicated tab'
    els.debugLink.hidden = !state.debugEnabled
}

function bindEvents(els) {
    els.send.addEventListener('click', function () {
        sendPrompt(els)
    })

    els.promptButton.addEventListener('click', function () {
        openPanel(els)
    })

    els.scrim.addEventListener('click', function () {
        closePanel(els)
    })

    els.debugToggle.addEventListener('click', function () {
        state.debugEnabled = !state.debugEnabled
        updateDebugToggleLabel(els)
    })

    els.debugLink.addEventListener('click', function (e) {
        e.stopPropagation()
        debugTab.open()
    })

    els.panel.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            trapFocus(els, e)
        }
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

        if (e.key === 'Escape') {
            e.preventDefault()
            if (state.historySuggestions.length > 0) {
                clearHistorySuggestions(els)
            } else {
                closePanel(els)
            }
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
        autoGrowInput(els.input)
        updateHistorySuggestions(els)
    })

    window.addEventListener('resize', function () {
        syncWebviewMargins(els)
    })
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
    getTargetMargins,
    isOpen: function () {
        return state.open
    },
    open: function () {
        openPanel(getPanelElements())
    },
    close: function () {
        closePanel(getPanelElements())
    },
    toggle: function () {
        const els = getPanelElements()
        if (state.open) {
            closePanel(els)
        } else {
            openPanel(els)
        }
    },
    initialize: function () {
        const els = getPanelElements()
        if (!els.panel) {
            return
        }

        buildInfoView.render(els.buildInfo, buildInfoData)
        promptRouter.initialize()
        bindEvents(els)
        updateControls(els)
        updateDebugToggleLabel(els)
        syncWebviewMargins(els)
        initializeEngineState(els)
    }
}

module.exports = promptPanel
