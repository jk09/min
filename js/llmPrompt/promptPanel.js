var engineClient = require('llmPrompt/engineClient.js')
var buildInfoView = require('llmPrompt/buildInfo')
var buildInfoData = require('dist/buildInfo.build.js')
var promptRouter = require('llmPrompt/promptRouter.js')
var agentRegistry = require('llmPrompt/agents/agentRegistry')
var ownModelRegistry = require('llmPrompt/ownModels/ownModelRegistry')
var debugTab = require('llmPrompt/debugTab.js')
var webviews = require('webviews.js')
var places = require('places/places.js')

const PLACEHOLDER_REASON = 'llmPrompt'
const RUNNING_MESSAGES = ['Thinking...', 'Reading model output...', 'Waiting for the model...']

const state = {
    open: false,
    sending: false,
    activeRequestId: null,
    progressText: '',
    progressMessageIndex: 0,
    progressTimer: null,
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
        input: document.getElementById('llm-prompt-input'),
        mode: document.getElementById('llm-prompt-mode'),
        send: document.getElementById('llm-prompt-send'),
        buildInfo: document.getElementById('llm-prompt-build-info'),
        history: document.getElementById('llm-prompt-history'),
        debugToggle: document.getElementById('llm-prompt-debug'),
        debugLink: document.getElementById('llm-prompt-debug-link')
    }
}

function createRequestId() {
    return 'prompt-panel-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
}

function getTargetMargins() {
    return [0, 0, 0, 0]
}

function syncWebviewMargins(els) {
    const nextMargins = getTargetMargins()
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
    clearResult(els)
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

function openModeSelector(els) {
    if (!state.open) {
        openPanel(els)
    }

    els.mode.focus()
    if (typeof els.mode.showPicker === 'function') {
        els.mode.showPicker()
    }
}

function trapFocus(els, e) {
    const focusable = Array.from(els.panel.querySelectorAll('textarea, select, button:not([disabled])'))
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
    if (els.mode.value === 'llm') {
        els.input.placeholder = 'Ask the model anything'
    } else {
        els.input.placeholder = 'Type an address or search the web'
    }
}

function updateControls(els) {
    // deterministic skills run without a provider, so the panel is never fully disabled
    const icon = els.send.querySelector && els.send.querySelector('i')
    els.send.classList.toggle('llm-prompt-stop', state.sending)
    els.input.readOnly = state.sending
    els.send.title = state.sending ? 'Stop prompt' : 'Send prompt'
    els.send.setAttribute('aria-label', state.sending ? 'Stop prompt' : 'Send prompt')
    if (icon) {
        icon.className = state.sending ? 'i carbon:stop-filled' : 'i carbon:arrow-up'
    }
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
    els.input.value = text
    els.input.classList.toggle('llm-prompt-error', Boolean(isError))
    autoGrowInput(els.input)
}

function clearResult(els) {
    els.input.value = ''
    els.input.classList.toggle('llm-prompt-error', false)
    autoGrowInput(els.input)
}

function renderResult(els, result) {
    var text = [describeTrace(result.trace), result.message, result.detail].filter(Boolean).join(' \u2014 ')
    setResult(els, text, !result.ok)
}

function shouldCloseAfterSubmit(result) {
    return result && result.ok && !(result.route === 'skill' && result.kind === 'llm')
}

function getRunningText() {
    const progress = state.progressText.trim()
    if (progress) {
        return 'Thinking... ' + progress.slice(-700)
    }
    return RUNNING_MESSAGES[state.progressMessageIndex % RUNNING_MESSAGES.length]
}

function stopProgressRotation() {
    if (state.progressTimer) {
        clearInterval(state.progressTimer)
        state.progressTimer = null
    }
}

function startProgressRotation(els) {
    stopProgressRotation()
    state.progressText = ''
    state.progressMessageIndex = 0
    setResult(els, getRunningText(), false)
    state.progressTimer = setInterval(function () {
        state.progressMessageIndex++
        setResult(els, getRunningText(), false)
    }, 1200)
}

function handleProgress(els, update) {
    if (!state.sending || !update || !update.text) {
        return
    }
    state.progressText = (state.progressText + update.text).slice(-1200)
    setResult(els, getRunningText(), false)
}

function cancelPrompt(els) {
    if (!state.sending) {
        return false
    }

    if (state.activeRequestId) {
        engineClient.cancel(state.activeRequestId).catch(function () { })
    }
    state.sending = false
    state.activeRequestId = null
    stopProgressRotation()
    clearResult(els)
    els.input.value = ''
    autoGrowInput(els.input)
    updateControls(els)
    els.input.focus()
    return true
}

async function sendPrompt(els) {
    var prompt = els.input.value.trim()

    if (!prompt || state.sending) {
        if (state.sending) {
            cancelPrompt(els)
        }
        return
    }

    const requestId = createRequestId()
    state.sending = true
    state.activeRequestId = requestId
    updateControls(els)
    els.input.value = ''
    autoGrowInput(els.input)
    clearHistorySuggestions(els)
    startProgressRotation(els)

    try {
        const result = await promptRouter.handlePrompt(prompt, {
            mode: els.mode.value,
            scope: 'mutate',
            agentId: agentRegistry.DEFAULT_AGENT_ID,
            ownModelId: ownModelRegistry.DEFAULT_OWN_MODEL_ID,
            debug: state.debugEnabled,
            requestId,
            onProgress: function (update) {
                handleProgress(els, update)
            }
        })
        if (state.activeRequestId !== requestId) {
            return
        }
        renderResult(els, result)
        if (shouldCloseAfterSubmit(result)) {
            closePanel(els)
        }
    } catch (e) {
        if (state.activeRequestId !== requestId) {
            return
        }
        setResult(els, 'The prompt runtime failed: ' + (e && e.message ? e.message : 'unknown error'), true)
    } finally {
        if (state.activeRequestId === requestId) {
            state.sending = false
            state.activeRequestId = null
            stopProgressRotation()
            updateControls(els)
        }
    }
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

    if (!query || els.mode.value !== 'browser') {
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
        if (state.sending) {
            cancelPrompt(els)
        } else {
            sendPrompt(els)
        }
    })

    els.scrim.addEventListener('click', function () {
        if (!cancelPrompt(els)) {
            closePanel(els)
        }
    })

    els.debugToggle.addEventListener('click', function () {
        state.debugEnabled = !state.debugEnabled
        updateDebugToggleLabel(els)
    })

    els.debugLink.addEventListener('click', function (e) {
        e.stopPropagation()
        debugTab.open()
    })

    els.mode.addEventListener('change', function () {
        clearHistorySuggestions(els)
        updateControls(els)
        els.input.focus()
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
            if (cancelPrompt(els)) {
                return
            }
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

var promptPanel = {
    getTargetMargins,
    isOpen: function () {
        return state.open
    },
    open: function () {
        openPanel(getPanelElements())
    },
    openModeSelector: function () {
        openModeSelector(getPanelElements())
    },
    close: function () {
        const els = getPanelElements()
        if (!cancelPrompt(els)) {
            closePanel(els)
        }
    },
    cancel: function () {
        return cancelPrompt(getPanelElements())
    },
    isSending: function () {
        return state.sending
    },
    toggle: function () {
        const els = getPanelElements()
        if (state.open) {
            if (!cancelPrompt(els)) {
                closePanel(els)
            }
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
    }
}

module.exports = promptPanel
