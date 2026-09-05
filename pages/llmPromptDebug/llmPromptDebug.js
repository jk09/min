document.title = 'LLM Prompt debug | Min'

var emptyState = document.getElementById('llm-debug-empty')
var content = document.getElementById('llm-debug-content')
var failureSection = document.getElementById('llm-debug-failure-section')

var fields = {
  instruction: document.getElementById('llm-debug-instruction'),
  ownModel: document.getElementById('llm-debug-own-model'),
  systemPrompt: document.getElementById('llm-debug-system-prompt'),
  modelResponse: document.getElementById('llm-debug-model-response'),
  parsedPlan: document.getElementById('llm-debug-parsed-plan'),
  trace: document.getElementById('llm-debug-trace'),
  failure: document.getElementById('llm-debug-failure')
}

function renderTrace (steps) {
  fields.trace.replaceChildren()
  ;(steps || []).forEach(function (step) {
    var item = document.createElement('li')
    var status = step.ok ? 'ok' : 'failed'
    item.textContent = '[' + status + '] ' + step.tool + ' ' + JSON.stringify(step.args || {}) +
      (step.ok ? (step.result !== undefined ? ' -> ' + JSON.stringify(step.result) : '') : ' -> ' + step.errorMessage)
    fields.trace.appendChild(item)
  })
}

function render (record) {
  if (!record) {
    emptyState.hidden = false
    content.hidden = true
    return
  }

  emptyState.hidden = true
  content.hidden = false

  fields.instruction.textContent = record.instruction || ''
  fields.ownModel.textContent = record.ownModelId || ''
  fields.systemPrompt.textContent = record.systemPrompt || ''
  fields.modelResponse.textContent = record.modelResponse || ''
  fields.parsedPlan.textContent = record.parsedPlan ? JSON.stringify(record.parsedPlan, null, 2) : ''
  renderTrace(record.trace)

  if (record.failureMessage) {
    failureSection.hidden = false
    fields.failure.textContent = record.failureMessage
  } else {
    failureSection.hidden = true
    fields.failure.textContent = ''
  }
}

window.addEventListener('message', function (e) {
  if (e.data && e.data.message === 'receiveLlmDebugData') {
    render(e.data.record)
  }
})

postMessage({ message: 'getLlmDebugData' })
