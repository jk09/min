function callEngine(method, payload) {
    return ipc.invoke(method, payload || {})
}

module.exports = {
    getStatus: function () {
        return callEngine('llmEngine:getStatus')
    },
    submitPrompt: function (request) {
        return callEngine('llmEngine:submitPrompt', request)
    }
}
