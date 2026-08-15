const test = require('node:test')
const assert = require('node:assert')

const { collectBuildInfo } = require('../scripts/buildInfo.js')
const buildInfoView = require('../js/llmPrompt/buildInfo.js')

const fullHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

function gitRunner (responses) {
  return function (args) {
    const key = args.join(' ')
    if (!(key in responses)) {
      throw new Error('unexpected git command: ' + key)
    }
    if (responses[key] instanceof Error) {
      throw responses[key]
    }
    return responses[key]
  }
}

test('collectBuildInfo reads commit, branch and dirty state', function () {
  const info = collectBuildInfo(gitRunner({
    'rev-parse HEAD': fullHash + '\n',
    'rev-parse --abbrev-ref HEAD': 'feat-b7x4qn-build-commit-indicator\n',
    'status --porcelain': ' M index.html\n'
  }), new Date('2026-08-15T18:00:00.000Z'))

  assert.strictEqual(info.commit, fullHash)
  assert.strictEqual(info.shortCommit, 'a1b2c3d')
  assert.strictEqual(info.branch, 'feat-b7x4qn-build-commit-indicator')
  assert.strictEqual(info.dirty, true)
  assert.strictEqual(info.buildTime, '2026-08-15T18:00:00.000Z')
})

test('collectBuildInfo reports a clean tree', function () {
  const info = collectBuildInfo(gitRunner({
    'rev-parse HEAD': fullHash,
    'rev-parse --abbrev-ref HEAD': 'master',
    'status --porcelain': '\n'
  }))

  assert.strictEqual(info.dirty, false)
  assert.strictEqual(info.branch, 'master')
})

test('collectBuildInfo falls back when git is unavailable', function () {
  const info = collectBuildInfo(function () {
    throw new Error('git not found')
  })

  assert.strictEqual(info.commit, 'unknown')
  assert.strictEqual(info.shortCommit, 'unknown')
  assert.strictEqual(info.branch, 'unknown')
  assert.strictEqual(info.dirty, false)
})

test('collectBuildInfo falls back when the commit output is not a hash', function () {
  const info = collectBuildInfo(gitRunner({
    'rev-parse HEAD': 'HEAD\n'
  }))

  assert.strictEqual(info.commit, 'unknown')
})

test('render shows the short hash and full details', function () {
  const element = {
    attributes: {},
    setAttribute: function (name, value) {
      this.attributes[name] = value
    }
  }

  buildInfoView.render(element, {
    commit: fullHash,
    shortCommit: 'a1b2c3d',
    branch: 'master',
    dirty: false,
    buildTime: '2026-08-15T18:00:00.000Z'
  })

  assert.strictEqual(element.textContent, '#a1b2c3d')
  assert.match(element.title, /Commit: a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/)
  assert.match(element.title, /Branch: master/)
  assert.match(element.title, /Working tree: clean/)
  assert.match(element.title, /Built: 2026-08-15T18:00:00.000Z/)
  assert.strictEqual(element.attributes['aria-label'], element.title)
})

test('render marks dirty builds', function () {
  assert.strictEqual(buildInfoView.formatLabel({ shortCommit: 'a1b2c3d', dirty: true }), '#a1b2c3d*')
})

test('render falls back for unknown metadata', function () {
  assert.strictEqual(buildInfoView.formatLabel({ shortCommit: 'unknown' }), '#unknown')
  assert.match(buildInfoView.formatTitle({ commit: 'unknown' }), /unknown/)
})
