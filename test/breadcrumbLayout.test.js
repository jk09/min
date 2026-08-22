const test = require('node:test')
const assert = require('node:assert')

const breadcrumbLayout = require('../js/navbar/breadcrumbLayout.js')

test('all breadcrumb items are visible when they fit', function () {
  const layout = breadcrumbLayout.computeVisibleBreadcrumbs({
    itemWidths: [80, 90, 70],
    containerWidth: 400,
    overflowWidth: 32
  })

  assert.deepStrictEqual(layout, { startIndex: 0, visibleCount: 3, hiddenCount: 0 })
})

test('the shallowest breadcrumbs are truncated first, keeping the deepest visible', function () {
  const layout = breadcrumbLayout.computeVisibleBreadcrumbs({
    itemWidths: [100, 100, 100, 100, 100],
    containerWidth: 250,
    overflowWidth: 30
  })

  assert.strictEqual(layout.hiddenCount, 3)
  assert.strictEqual(layout.visibleCount, 2)
  assert.strictEqual(layout.startIndex, 3)
})

test('at least one breadcrumb is always shown, even if it does not fit', function () {
  const layout = breadcrumbLayout.computeVisibleBreadcrumbs({
    itemWidths: [500],
    containerWidth: 100,
    overflowWidth: 30
  })

  assert.deepStrictEqual(layout, { startIndex: 0, visibleCount: 1, hiddenCount: 0 })
})

test('no items produces an empty layout', function () {
  const layout = breadcrumbLayout.computeVisibleBreadcrumbs({
    itemWidths: [],
    containerWidth: 400
  })

  assert.deepStrictEqual(layout, { startIndex: 0, visibleCount: 0, hiddenCount: 0 })
})

test('breadcrumb labels prefer the page title over the URL', function () {
  assert.strictEqual(
    breadcrumbLayout.getBreadcrumbLabel({ title: 'Example Site', url: 'https://example.com/page' }),
    'Example Site'
  )
})

test('breadcrumb labels fall back to the hostname when there is no title', function () {
  assert.strictEqual(
    breadcrumbLayout.getBreadcrumbLabel({ title: '', url: 'https://example.com/page' }),
    'example.com'
  )
})

test('long breadcrumb titles are truncated', function () {
  const longTitle = 'a'.repeat(80)
  const label = breadcrumbLayout.getBreadcrumbLabel({ title: longTitle, url: 'https://example.com' })

  assert.strictEqual(label.length, breadcrumbLayout.MAX_LABEL_LENGTH + 1)
  assert.ok(label.endsWith('\u2026'))
})
