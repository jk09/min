const test = require('node:test')
const assert = require('node:assert')
const Module = require('node:module')

function createElement (id) {
  const classes = new Set()
  return {
    id,
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    style: {},
    scrollHeight: 40,
    focused: false,
    listeners: {},
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name))
    },
    addEventListener: function (name, fn) {
      this.listeners[name] = this.listeners[name] || []
      this.listeners[name].push(fn)
    },
    dispatch: function (name, event) {
      (this.listeners[name] || []).forEach(fn => fn(event))
    },
    querySelectorAll: () => [],
    replaceChildren: () => {},
    getBoundingClientRect: () => ({ height: 22, width: 800, top: 0 }),
    focus: function () { this.focused = true }
  }
}

function loadPromptPanel () {
  const ids = [
    'llm-prompt-overlay', 'llm-prompt-scrim', 'llm-prompt-panel', 'status-bar',
    'status-bar-prompt-button', 'llm-prompt-input', 'llm-prompt-send', 'llm-prompt-result',
    'llm-prompt-engine-state', 'llm-prompt-build-info', 'llm-prompt-history'
  ]
  const elements = new Map(ids.map(id => [id, createElement(id)]))
  const bodyClasses = new Set()
  const placeholderRequests = []
  const margins = []

  const previouslyFocused = createElement('page')

  global.document = {
    body: {
      classList: {
        add: name => bodyClasses.add(name),
        remove: name => bodyClasses.delete(name),
        contains: name => bodyClasses.has(name)
      }
    },
    activeElement: previouslyFocused,
    contains: node => node === previouslyFocused,
    getElementById: id => elements.get(id) || null,
    createElement: () => createElement('created')
  }
  global.window = { addEventListener: () => {} }

  const modules = {
    'llmPrompt/engineClient.js': { getStatus: async () => ({ providerConfigured: false }) },
    'llmPrompt/buildInfo.js': { render: () => {} },
    'dist/buildInfo.build.js': { shortCommit: 'abc1234' },
    'llmPrompt/promptRouter.js': { initialize: () => {}, handlePrompt: async () => ({ ok: true, message: 'done' }), toolRegistry: { run: async () => {} } },
    'webviews.js': {
      adjustMargin: delta => margins.push(delta),
      requestPlaceholder: reason => placeholderRequests.push(reason),
      hidePlaceholder: function (reason) {
        const index = placeholderRequests.indexOf(reason)
        if (index !== -1) {
          placeholderRequests.splice(index, 1)
        }
      },
      focus: () => {}
    },
    'places/places.js': { searchPlaces: async () => [] }
  }

  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    return modules[request] || originalLoad.call(this, request, parent, isMain)
  }

  const panelPath = require.resolve('../js/llmPrompt/promptPanel.js')
  delete require.cache[panelPath]
  const promptPanel = require(panelPath)
  Module._load = originalLoad

  return { promptPanel, elements, bodyClasses, placeholderRequests, margins, previouslyFocused }
}

test('getTargetMargins reserves space for the status bar only', function () {
  const { promptPanel } = loadPromptPanel()

  assert.deepStrictEqual(promptPanel.getTargetMargins({ height: 22 }), [0, 0, 22, 0])
})

test('initialize reserves the status bar height as a bottom webview margin', function () {
  const { promptPanel, margins } = loadPromptPanel()

  promptPanel.initialize()

  assert.deepStrictEqual(margins, [[0, 0, 22, 0]])
})

test('the overlay is closed until it is opened, and restores focus on close', function () {
  const { promptPanel, elements, bodyClasses, placeholderRequests, previouslyFocused } = loadPromptPanel()

  promptPanel.initialize()
  assert.strictEqual(promptPanel.isOpen(), false)

  promptPanel.open()
  assert.strictEqual(promptPanel.isOpen(), true)
  assert.strictEqual(elements.get('llm-prompt-overlay').hidden, false)
  assert.strictEqual(bodyClasses.has('llm-prompt-overlay-open'), true)
  assert.deepStrictEqual(placeholderRequests, ['llmPrompt'])
  assert.strictEqual(elements.get('llm-prompt-input').focused, true)

  promptPanel.close()
  assert.strictEqual(promptPanel.isOpen(), false)
  assert.strictEqual(elements.get('llm-prompt-overlay').hidden, true)
  assert.strictEqual(bodyClasses.has('llm-prompt-overlay-open'), false)
  assert.deepStrictEqual(placeholderRequests, [])
  assert.strictEqual(previouslyFocused.focused, true)
})

test('toggle opens and closes the overlay', function () {
  const { promptPanel } = loadPromptPanel()

  promptPanel.initialize()

  promptPanel.toggle()
  assert.strictEqual(promptPanel.isOpen(), true)

  promptPanel.toggle()
  assert.strictEqual(promptPanel.isOpen(), false)
})

test('the overlay does not open while the new tab page is shown', function () {
  const { promptPanel, bodyClasses } = loadPromptPanel()

  promptPanel.initialize()
  bodyClasses.add('is-ntp')

  promptPanel.open()

  assert.strictEqual(promptPanel.isOpen(), false)
})
