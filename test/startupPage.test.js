const test = require('node:test')
const assert = require('node:assert')

const { resolveStartupPageURL, fallbackStartupPageURL } = require('../js/util/startupPage.js')

test('resolves the home page of the configured search engine', function () {
  assert.strictEqual(
    resolveStartupPageURL({ name: 'DuckDuckGo', searchURL: 'https://duckduckgo.com/?q=%s&t=min' }),
    'https://duckduckgo.com'
  )
  assert.strictEqual(
    resolveStartupPageURL({ name: 'Google', searchURL: 'https://www.google.com/search?q=%s' }),
    'https://www.google.com'
  )
})

test('falls back to bing.com when the search engine has no usable host', function () {
  assert.strictEqual(resolveStartupPageURL({ name: 'none', searchURL: 'http://%s' }), fallbackStartupPageURL)
  assert.strictEqual(resolveStartupPageURL({ name: 'custom', searchURL: 'not a url' }), fallbackStartupPageURL)
})

test('falls back to bing.com when no search engine is available', function () {
  assert.strictEqual(resolveStartupPageURL({}), fallbackStartupPageURL)
  assert.strictEqual(resolveStartupPageURL(undefined), fallbackStartupPageURL)
})

test('falls back to bing.com for non-http search engine URLs', function () {
  assert.strictEqual(resolveStartupPageURL({ searchURL: 'file:///tmp/search?q=%s' }), fallbackStartupPageURL)
})
