const test = require('node:test')
const assert = require('node:assert')

const tabOverflow = require('../js/navbar/tabOverflow.js')
const tabLabel = require('../js/navbar/tabLabel.js')

test('tab width is clamped to a usable range', function () {
  assert.strictEqual(tabOverflow.clampTabWidth(140), 140)
  assert.strictEqual(tabOverflow.clampTabWidth(10), tabOverflow.MIN_TAB_WIDTH)
  assert.strictEqual(tabOverflow.clampTabWidth(9000), tabOverflow.MAX_TAB_WIDTH)
  assert.strictEqual(tabOverflow.clampTabWidth('not a number'), tabOverflow.DEFAULT_TAB_WIDTH)
})

test('all tabs are visible when they fit', function () {
  const layout = tabOverflow.computeVisibleTabs({
    tabCount: 4,
    activeIndex: 0,
    containerWidth: 1000,
    tabWidth: 140,
    labelWidth: 120
  })

  assert.deepStrictEqual(layout, { startIndex: 0, visibleCount: 4, hiddenCount: 0 })
})

test('the label width is reserved once tabs overflow', function () {
  const layout = tabOverflow.computeVisibleTabs({
    tabCount: 50,
    activeIndex: 0,
    containerWidth: 1000,
    tabWidth: 140,
    labelWidth: 120
  })

  assert.strictEqual(layout.startIndex, 0)
  assert.strictEqual(layout.visibleCount, 6)
  assert.strictEqual(layout.hiddenCount, 44)
})

test('the visible slice shifts so the active tab is rendered', function () {
  const layout = tabOverflow.computeVisibleTabs({
    tabCount: 50,
    activeIndex: 30,
    containerWidth: 1000,
    tabWidth: 140,
    labelWidth: 120
  })

  assert.strictEqual(layout.startIndex, 25)
  assert.strictEqual(layout.visibleCount, 6)
  assert.strictEqual(layout.hiddenCount, 44)
  assert.ok(layout.startIndex <= 30 && 30 < layout.startIndex + layout.visibleCount)
})

test('at least one tab is rendered in a very narrow window', function () {
  const layout = tabOverflow.computeVisibleTabs({
    tabCount: 10,
    activeIndex: 7,
    containerWidth: 100,
    tabWidth: 140,
    labelWidth: 120
  })

  assert.strictEqual(layout.visibleCount, 1)
  assert.strictEqual(layout.startIndex, 7)
  assert.strictEqual(layout.hiddenCount, 9)
})

test('an empty tab bar has no overflow', function () {
  assert.deepStrictEqual(
    tabOverflow.computeVisibleTabs({ tabCount: 0, containerWidth: 800, tabWidth: 140 }),
    { startIndex: 0, visibleCount: 0, hiddenCount: 0 }
  )
})

test('hidden tabs are summarized by domain and load state', function () {
  const summary = tabOverflow.summarizeHiddenTabs([
    { id: '1', domain: 'example.com', loaded: true, hasWebContents: true },
    { id: '2', domain: 'example.com', loaded: false, hasWebContents: true },
    { id: '3', domain: 'dailymail.com', loaded: false, hasWebContents: false },
    { id: '4', domain: 'example.com', loaded: true, hasWebContents: true }
  ])

  assert.strictEqual(summary.total, 4)
  assert.strictEqual(summary.loading, 1)
  assert.strictEqual(summary.notLoaded, 1)
  assert.strictEqual(summary.groups.length, 2)
  assert.strictEqual(summary.groups[0].domain, 'example.com')
  assert.strictEqual(summary.groups[0].count, 3)
  assert.strictEqual(summary.groups[1].domain, 'dailymail.com')
})

test('the tab label uses the abbreviation, then the domain, then the title', function () {
  const defaultLabel = 'New Tab'

  assert.strictEqual(tabLabel.getTabLabel({
    abbreviation: 'UK news',
    domain: 'dailymail.com',
    title: 'UK Home | Daily Mail Online',
    defaultLabel
  }), 'UK news')

  assert.strictEqual(tabLabel.getTabLabel({
    domain: 'www.dailymail.com',
    title: 'UK Home | Daily Mail Online',
    defaultLabel
  }), 'dailymail.com')

  assert.strictEqual(tabLabel.getTabLabel({
    title: 'A local file',
    defaultLabel
  }), 'A local file')

  assert.strictEqual(tabLabel.getTabLabel({ isNewTab: true, domain: 'min', defaultLabel }), defaultLabel)
  assert.strictEqual(tabLabel.getTabLabel({ defaultLabel }), defaultLabel)
})

test('only exact rgb colors from the page are used as an accent color', function () {
  assert.strictEqual(tabLabel.getAccentColor({ themeColor: { color: 'rgb(12, 34, 56)' } }), 'rgb(12, 34, 56)')
  assert.strictEqual(tabLabel.getAccentColor({ backgroundColor: { color: 'rgb(1,2,3)' } }), 'rgb(1,2,3)')
  assert.strictEqual(tabLabel.getAccentColor({ themeColor: { color: 'red; background: url(evil)' } }), null)
  assert.strictEqual(tabLabel.getAccentColor({}), null)
})

test('only safe favicon urls are used', function () {
  assert.strictEqual(tabLabel.getFaviconURL({ favicon: { url: 'https://example.com/icon.png' } }), 'https://example.com/icon.png')
  assert.strictEqual(tabLabel.getFaviconURL({ favicon: { url: 'javascript:alert(1)' } }), null)
  assert.strictEqual(tabLabel.getFaviconURL({}), null)
})
