function callEngine(method, payload) {
    return ipc.invoke(method, payload || {})
}

module.exports = {
    getStatus: function () {
        return callEngine('llmEngine:getStatus')
    },
    /* request: { system, prompt, responseFormat } -> { ok, output } | { ok: false, errorCode, errorMessage } */
    complete: function (request) {
        return callEngine('llmEngine:complete', request)
    }
}
