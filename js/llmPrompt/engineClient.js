var requestCounter = 0

function callEngine(method, payload) {
    return ipc.invoke(method, payload || {})
}

function createRequestId () {
    requestCounter++
    return 'llm-prompt-' + Date.now() + '-' + requestCounter
}

module.exports = {
    getStatus: function () {
        return callEngine('llmEngine:getStatus')
    },
    /* request: { system, prompt, responseFormat } -> { ok, output } | { ok: false, errorCode, errorMessage } */
    complete: function (request, options = {}) {
        const requestId = options.requestId || createRequestId()
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null
        const progressChannel = 'llmEngine:progress:' + requestId

        function progressListener (e, update) {
            onProgress(update || {})
        }

        if (onProgress) {
            ipc.on(progressChannel, progressListener)
        }

        return callEngine('llmEngine:complete', Object.assign({}, request, {
            requestId,
            stream: Boolean(onProgress)
        })).finally(function () {
            if (onProgress && ipc.removeListener) {
                ipc.removeListener(progressChannel, progressListener)
            }
        })
    },
    cancel: function (requestId) {
        return callEngine('llmEngine:cancel', { requestId })
    }
}
