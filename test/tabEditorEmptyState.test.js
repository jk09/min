const test = require('node:test')
const assert = require('node:assert')
const Module = require('node:module')

const originalModuleLoad = Module._load
test.after(function () {
  Module._load = originalModuleLoad
})

function createElement (id) {
  const classes = new Set()
  return {
    id,
    hidden: true,
    value: '',
    style: {},
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name)
    },
    setAttribute: () => {},
    addEventListener: () => {},
    removeAttribute: () => {},
    appendChild: child => child,
    querySelector: () => null,
    getBoundingClientRect: () => ({ x: 0, width: 100 }),
    focus: () => {},
    blur: () => {},
    select: () => {}
  }
}

function loadTabEditor (selectedTab) {
  const elements = new Map([
    ['tab-editor', createElement('tab-editor')],
    ['tab-editor-input', createElement('tab-editor-input')],
    ['webviews', createElement('webviews')]
  ])
  const bodyClasses = new Set()
  const opened = []
  const searchbarCalls = []

  global.document = {
    body: {
      classList: {
        add: name => bodyClasses.add(name),
        remove: name => bodyClasses.delete(name),
        contains: name => bodyClasses.has(name)
      }
    },
    getElementById: id => elements.get(id) || null,
    querySelector: () => null
  }
  global.l = key => key
  global.tabs = {
    get: () => selectedTab,
    count: () => 1
  }

  const modules = {
    'searchbar/searchbar.js': {
      show: () => searchbarCalls.push('show'),
      showResults: () => searchbarCalls.push('showResults'),
      hide: () => searchbarCalls.push('hide')
    },
    'webviews.js': { requestPlaceholder: () => {}, hidePlaceholder: () => {} },
    'modalMode.js': { enabled: () => false },
    'util/urlParser.js': { getSourceURL: url => url },
    'util/keyboardNavigationHelper.js': { addToGroup: () => {} },
    'navbar/bookmarkStar.js': { create: () => createElement('star'), update: () => {} },
    'navbar/contentBlockingToggle.js': { create: () => createElement('toggle'), update: () => {} },
    'llmPrompt/promptPanel.js': { open: () => opened.push('open') }
  }

  // the mock stays installed, because tabEditor requires the prompt panel lazily
  const previousLoad = Module._load
  Module._load = function (request, parent, isMain) {
    return modules[request] || previousLoad.call(this, request, parent, isMain)
  }

  const editorPath = require.resolve('../js/navbar/tabEditor.js')
  delete require.cache[editorPath]
  const tabEditor = require(editorPath)

  return { tabEditor, elements, bodyClasses, opened, searchbarCalls }
}

test('an empty tab opens the prompt instead of the address selector', function () {
  const { tabEditor, elements, opened, searchbarCalls } = loadTabEditor({ url: '' })

  tabEditor.show('tab-1')

  assert.deepStrictEqual(opened, ['open'])
  assert.strictEqual(tabEditor.isShown, false)
  assert.strictEqual(elements.get('tab-editor').hidden, true)
  assert.deepStrictEqual(searchbarCalls, [])
})

test('a tab showing the blank new tab URL also opens the prompt', function () {
  const { tabEditor, opened } = loadTabEditor({ url: 'min://newtab' })

  tabEditor.show('tab-1')

  assert.deepStrictEqual(opened, ['open'])
  assert.strictEqual(tabEditor.isShown, false)
})

test('a tab with a page still opens the address selector', function () {
  const { tabEditor, elements, opened, searchbarCalls } = loadTabEditor({ url: 'https://example.com' })

  tabEditor.show('tab-1')

  assert.deepStrictEqual(opened, [])
  assert.strictEqual(tabEditor.isShown, true)
  assert.strictEqual(elements.get('tab-editor').hidden, false)
  assert.strictEqual(elements.get('tab-editor-input').value, 'https://example.com')
  assert.deepStrictEqual(searchbarCalls, ['show', 'showResults'])
})

test('an explicit search value keeps working on an empty tab', function () {
  const { tabEditor, opened, searchbarCalls } = loadTabEditor({ url: '' })

  tabEditor.show('tab-1', '!bookmarks ')

  assert.deepStrictEqual(opened, [])
  assert.strictEqual(tabEditor.isShown, true)
  assert.deepStrictEqual(searchbarCalls, ['show', 'showResults'])
})
