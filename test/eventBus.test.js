const test = require('node:test')
const assert = require('node:assert')
const EventBus = require('../js/util/eventBus')

test('event bus delivers events to every listener', function () {
  const bus = new EventBus()
  const received = []

  bus.on('tab-selected', id => received.push(['first', id]))
  bus.on('tab-selected', id => received.push(['second', id]))

  assert.equal(bus.emit('tab-selected', 7), true)
  assert.deepEqual(received, [['first', 7], ['second', 7]])
})

test('event bus reports when nothing is listening', function () {
  const bus = new EventBus()

  assert.equal(bus.emit('tab-closed', 1), false)
})

test('event bus removes listeners with off and once', function () {
  const bus = new EventBus()
  const received = []
  const listener = id => received.push(id)

  bus.on('tab-closed', listener)
  bus.off('tab-closed', listener)
  bus.emit('tab-closed', 1)

  bus.once('tab-closed', id => received.push('once-' + id))
  bus.emit('tab-closed', 2)
  bus.emit('tab-closed', 3)

  assert.deepEqual(received, ['once-2'])
})

test('event bus is unaffected by listeners removed while emitting', function () {
  const bus = new EventBus()
  const received = []
  const second = () => received.push('second')

  bus.on('tab-selected', () => {
    bus.off('tab-selected', second)
    received.push('first')
  })
  bus.on('tab-selected', second)

  bus.emit('tab-selected')

  assert.deepEqual(received, ['first', 'second'])
})
