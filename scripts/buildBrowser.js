require('./registerTs.js')
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const rootDir = path.resolve(__dirname, '../')
const jsDir = path.resolve(__dirname, '../js')

const intermediateOutput = path.resolve(__dirname, '../dist/build.js')
const outFile = path.resolve(__dirname, '../dist/bundle.js')

const fileList = [
  'dist/localization.build.js',
  'js/default.js'
]

/*
Renderer modules address each other by paths relative to the repo root or to
js/ (`require('util/settings/settings.js')`, `require('ext/textColor/textColor.js')`).
Browserify resolved those through its `paths` option; esbuild resolves them
through `nodePaths`, which behaves like NODE_PATH. This is the documented
build-time alias map - renderer code never resolves a module at runtime.
*/
const nodePaths = [rootDir, jsDir]

/*
The chrome renderer is context-isolated and sandboxed, so Node's `global` is
absent. Browser libraries in the bundle (dragula -> crossvent -> custom-event)
expect it. Node globals are deliberately left alone: there is no `process` or
`Buffer` in the renderer, and any module reaching for one is a bug to fix at
the source rather than to paper over with a shim.
*/
const define = {
  global: 'globalThis'
}

/*
Modules that only main-process code pulls in. Nothing in the renderer graph
should reach them; marking them external turns a silent Node dependency into a
build error instead of a bundled copy.
*/
const external = ['electron', 'fs', 'path', 'child_process', 'events', 'write-file-atomic', 'chokidar']

function buildBrowser () {
  // build localization support first, since it is included in the browser bundle
  require('./buildLocalization.js')()

  // generated build metadata is required by the bundle, so it has to exist before bundling
  require('./buildInfo')()

  /* concatenate legacy modules */
  let output = ''
  fileList.forEach(function (script) {
    output += fs.readFileSync(path.resolve(__dirname, '../', script)) + ';\n'
  })

  fs.writeFileSync(intermediateOutput, output, 'utf-8')

  const result = esbuild.buildSync({
    entryPoints: [intermediateOutput],
    outfile: outFile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    nodePaths,
    define,
    external,
    resolveExtensions: ['.js', '.json', '.ts', '.tsx'],
    // the bundle lives in dist/ but its sources are repo-root-relative,
    // so without this the debugger resolves them one directory too deep
    sourceRoot: '../',
    sourcemap: 'inline',
    sourcesContent: true,
    logLevel: 'warning',
    metafile: true
  })

  assertNoNodeDependencies(result.metafile)

  return result
}

/*
esbuild leaves an unresolved `require('fs')` in the output as a runtime call
that throws only when it runs. Failing the build instead keeps a Node
dependency from reaching the renderer unnoticed.
*/
function assertNoNodeDependencies (metafile) {
  const offenders = []

  Object.entries(metafile.inputs).forEach(function ([file, input]) {
    input.imports.forEach(function (imported) {
      if (imported.external && external.includes(imported.path)) {
        offenders.push(file + ' requires ' + imported.path)
      }
    })
  })

  if (offenders.length > 0) {
    throw new Error(
      'the chrome renderer bundle must not depend on Node or Electron modules:\n  ' +
      offenders.join('\n  ') +
      '\nMove the capability into the main process and expose it through window.min.'
    )
  }
}

if (module.parent) {
  module.exports = buildBrowser
} else {
  buildBrowser()
}
