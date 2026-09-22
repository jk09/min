const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const buildBrowser = require('../scripts/buildBrowser')

const bundlePath = path.resolve(__dirname, '../dist/bundle.js')
const SOURCE_MAP_MARKER = '//# sourceMappingURL=data:application/json;base64,'

let result = null

function bundle () {
  if (!result) {
    result = buildBrowser()
  }
  return fs.readFileSync(bundlePath, 'utf-8')
}

function sourceMap (content) {
  const index = content.lastIndexOf(SOURCE_MAP_MARKER)
  assert.notEqual(index, -1, 'the bundle must carry an inline source map')
  return JSON.parse(Buffer.from(content.slice(index + SOURCE_MAP_MARKER.length).trim(), 'base64').toString('utf-8'))
}

test('the renderer bundle is built by esbuild to the path index.html loads', function () {
  const content = bundle()

  assert.ok(content.length > 0, 'the bundle must not be empty')

  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8')
  assert.match(html, /<script src="dist\/bundle\.js"><\/script>/)

  // the Browserify module loader must not come back with it
  assert.doesNotMatch(content, /browser-pack/)
})

test('the renderer bundle keeps source maps pointing at the original files', function () {
  const map = sourceMap(bundle())

  // the bundle lives in dist/ but its sources are repo-root-relative
  assert.equal(map.sourceRoot, '../')
  assert.ok(map.sourcesContent && map.sourcesContent.length > 0, 'source content must be embedded for debugging')

  const sources = map.sources.map(source => source.split('\\').join('/'))
  assert.ok(sources.some(source => source.endsWith('js/webviews.js')), 'renderer modules must appear in the source map')
  assert.ok(sources.some(source => source.endsWith('js/navbar/tabOverflow.ts')), 'TypeScript sources must appear in the source map')
})

test('the renderer bundle resolves the repo-root and js/ module aliases', function () {
  const map = sourceMap(bundle())
  const sources = map.sources.map(source => source.split('\\').join('/'))

  // require('ext/textColor/textColor.js') resolves against the repo root,
  // require('util/urlParser.js') against js/ - both through the build-time alias map
  assert.ok(sources.some(source => source.endsWith('ext/textColor/textColor.js')))
  assert.ok(sources.some(source => source.endsWith('js/util/urlParser.js')))
})

test('the renderer bundle contains no Node or Electron dependency', function () {
  const content = bundle()

  // esbuild would leave an unresolved require() in the output for these; the build
  // fails instead, so reaching this point already proves the graph is clean
  assert.doesNotMatch(content, /require\("electron"\)/)
  assert.doesNotMatch(content, /require\("child_process"\)/)
  assert.doesNotMatch(content, /require\("fs"\)/)
})

test('the renderer build rejects a Node dependency reaching the renderer graph', function () {
  const probe = path.resolve(__dirname, '../js/util/nodeDependencyProbe.js')
  const entry = path.resolve(__dirname, '../js/default.js')
  const originalEntry = fs.readFileSync(entry, 'utf-8')

  fs.writeFileSync(probe, "module.exports = require('child_process')\n", 'utf-8')
  fs.writeFileSync(entry, "require('util/nodeDependencyProbe.js')\n" + originalEntry, 'utf-8')

  try {
    assert.throws(() => buildBrowser(), /must not depend on Node or Electron modules/)
  } finally {
    fs.writeFileSync(entry, originalEntry, 'utf-8')
    fs.unlinkSync(probe)
    // leave a good bundle behind for the other suites
    buildBrowser()
  }
})
