const test = require('node:test')
const assert = require('node:assert')
const { shouldSavePage } = require('../js/places/historyEligibility')

test('does not save internal pages', function () {
  assert.strictEqual(shouldSavePage('min://historyGraph', false, false, true), false)
})

test('does not save search result pages', function () {
  assert.strictEqual(shouldSavePage('https://www.bing.com/search?q=hacker', false, true, false), false)
})

test('does not save pages redirected to the search engine', function () {
  assert.strictEqual(shouldSavePage('https://www.bing.com/search?q=hacker%20news', false, true, false), false)
})

test('saves ordinary non-private pages', function () {
  assert.strictEqual(shouldSavePage('https://news.ycombinator.com/', false, false, false), true)
})
