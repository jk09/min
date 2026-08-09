const assert = require('assert')
const layoutManager = require('../js/layoutManager')

function createTaskWithTabs (count) {
  const tabs = []
  for (let i = 0; i < count; i++) {
    tabs.push({ id: String(i + 1), title: 'Tab ' + (i + 1) })
  }
  return { tabs: { get: () => tabs, count: () => tabs.length, getAtIndex: index => tabs[index], getSelected: () => null } }
}

function getPresetSlots (layout, count) {
  return layoutManager.getLayoutPresetTabs(layout, createTaskWithTabs(count))
}

(function () {
  const oneTile = getPresetSlots('single', 3)
  assert.strictEqual(oneTile.length, 1)
  assert.strictEqual(oneTile[0].title, 'Tab 1')

  const twoHorizontal = getPresetSlots('two-horizontal', 4)
  assert.strictEqual(twoHorizontal.length, 2)
  assert.deepStrictEqual(twoHorizontal.map(tab => tab.title), ['Tab 1', 'Tab 2'])

  const twoVertical = getPresetSlots('two-vertical', 4)
  assert.strictEqual(twoVertical.length, 2)
  assert.deepStrictEqual(twoVertical.map(tab => tab.title), ['Tab 1', 'Tab 2'])

  const fourTile = getPresetSlots('four-grid', 6)
  assert.strictEqual(fourTile.length, 4)
  assert.deepStrictEqual(fourTile.map(tab => tab.title), ['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4'])

  console.log('layoutManager tests passed')
})()
