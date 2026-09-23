var requestCounter = 0

function createRequestId () {
    requestCounter++
    return 'llm-prompt-' + Date.now() + '-' + requestCounter
}

module.exports = {
    getStatus: function () {
        return window.min.prompt.getStatus()
    },
    /* request: { system, prompt, responseFormat } -> { ok, output } | { ok: false, errorCode, errorMessage } */
    complete: function (request, options = {}) {
        const requestId = options.requestId || createRequestId()
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null
        function progressListener (update) {
            onProgress(update || {})
        }

        if (onProgress) {
            var unsubscribe = window.min.prompt.onProgress(requestId, progressListener)
        }

        return window.min.prompt.complete(Object.assign({}, request, {
            requestId,
            stream: Boolean(onProgress)
        })).finally(function () {
            if (unsubscribe) {
                unsubscribe()
            }
        })
    },
    cancel: function (requestId) {
        return window.min.prompt.cancel(requestId)
    }
}
