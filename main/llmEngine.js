const { app, ipcMain: ipc } = require('electron')
const settings = require('../js/util/settings/settingsMain')
const { windows } = require('./windowManagement')

const LLM_ENGINE_SCOPES = ['read', 'mutate']

const INTERNAL_ACTIONS = {
    read: [
        'browser.getWindowBounds',
        'browser.getFocusedState',
        'browser.getVersion'
    ],
    mutate: [
        'browser.openTab',
        'browser.closeTab',
        'browser.navigateCurrentTab'
    ]
}

function getConfiguredProvider() {
    return process.env.MIN_LLM_PROVIDER || settings.get('llmProvider') || null
}

function getConfiguredModel() {
    return process.env.MIN_LLM_MODEL || settings.get('llmModel') || null
}

function getEngineStatus() {
    const provider = getConfiguredProvider()
    const model = getConfiguredModel()

    return {
        providerConfigured: Boolean(provider),
        provider,
        model,
        capabilities: LLM_ENGINE_SCOPES,
        internalActionCatalog: INTERNAL_ACTIONS
    }
}

async function submitPromptToProvider(prompt, context) {
    return {
        ok: true,
        output: 'Provider bridge is configured but external model execution is not implemented yet.',
        engineContext: context,
        promptPreview: prompt.slice(0, 120)
    }
}

ipc.handle('llmEngine:getStatus', function () {
    return getEngineStatus()
})

ipc.handle('llmEngine:submitPrompt', async function (event, request = {}) {
    const status = getEngineStatus()
    const prompt = typeof request.prompt === 'string' ? request.prompt.trim() : ''
    const scope = request.capabilityScope === 'mutate' ? 'mutate' : 'read'

    if (!prompt) {
        return {
            ok: false,
            errorCode: 'empty_prompt',
            errorMessage: 'Prompt is empty.'
        }
    }

    if (!status.providerConfigured) {
        return {
            ok: false,
            errorCode: 'provider_not_configured',
            errorMessage: 'No external LLM provider is configured for Min.',
            capabilities: status.capabilities,
            allowedInternalActions: INTERNAL_ACTIONS[scope],
            metadata: {
                requestedScope: scope
            }
        }
    }

    const context = {
        requestedScope: scope,
        allowedInternalActions: INTERNAL_ACTIONS[scope],
        windowId: windows.windowFromContents(event.sender).id,
        appVersion: app.getVersion()
    }

    return submitPromptToProvider(prompt, context)
})
