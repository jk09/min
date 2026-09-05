const test = require('node:test')
const assert = require('node:assert')

require('../scripts/registerTs.js')
const breadcrumbLayout = require('../js/navbar/breadcrumbLayout.js')

test('all breadcrumb items are visible when they fit', function () {
  const layout = breadcrumbLayout.computeVisibleBreadcrumbs({
    itemWidths: [80, 90, 70],
    containerWidth: 400,
    overflowWidth: 32
  })

  assert.deepStrictEqual(layout, { startIndex: 0, visibleCount: 3, hiddenCount: 0, visibleIndexes: [0, 1, 2] })
})

test('truncated breadcrumbs preserve the first and last entries', function () {
  const layout = breadcrumbLayout.computeVisibleBreadcrumbs({
    itemWidths: [100, 100, 100, 100, 100],
    containerWidth: 250,
    overflowWidth: 30
  })

  assert.deepStrictEqual(layout, { startIndex: 4, visibleCount: 2, hiddenCount: 3, visibleIndexes: [0, 4] })
})

test('breadcrumb labels prefer a page title and fall back to the hostname', function () {
  assert.strictEqual(
    breadcrumbLayout.getBreadcrumbLabel({ title: 'Example Site', url: 'https://example.com/page' }),
    'Example Site'
  )
  assert.strictEqual(
    breadcrumbLayout.getBreadcrumbLabel({ title: '', url: 'https://example.com/page' }),
    'example.com'
  )
})
