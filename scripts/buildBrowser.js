const browserify = require('browserify')
const renderify = require('electron-renderify')
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

function buildBrowser () {
  // build localization support first, since it is included in the browser bundle
  require('./buildLocalization.js')()

  // generated build metadata is required by the bundle, so it has to exist before bundling
  require('./buildInfo.js')()

  /* concatenate legacy modules */
  let output = ''
  fileList.forEach(function (script) {
    output += fs.readFileSync(path.resolve(__dirname, '../', script)) + ';\n'
  })

  fs.writeFileSync(intermediateOutput, output, 'utf-8')

  const instance = browserify(intermediateOutput, {
    paths: [rootDir, jsDir],
    ignoreMissing: false,
    node: true,
    detectGlobals: false,
    debug: true // emit source maps so breakpoints bind to the original js/ files
  })

  instance.exclude('chokidar')
  instance.exclude('write-file-atomic')

  instance.transform(renderify)
  const stream = fs.createWriteStream(outFile, { encoding: 'utf-8' })
  instance.bundle()
    .on('error', function (e) {
      console.warn('\x1b[31m' + 'Error while building: ' + e.message + '\x1b[30m')
    })
    .pipe(stream)

  // the bundle's sources are repo-root-relative, but the bundle itself lives in dist/,
  // so without a sourceRoot the debugger resolves them one directory too deep
  stream.on('finish', function () {
    fixSourceMapRoot(outFile)
  })
}

function fixSourceMapRoot (bundlePath) {
  const marker = '//# sourceMappingURL=data:application/json;charset=utf-8;base64,'
  const content = fs.readFileSync(bundlePath, 'utf-8')
  const markerIndex = content.lastIndexOf(marker)

  if (markerIndex === -1) {
    return
  }

  const base64 = content.slice(markerIndex + marker.length).trim()
  const map = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
  map.sourceRoot = '../'

  const newBase64 = Buffer.from(JSON.stringify(map), 'utf-8').toString('base64')
  const newContent = content.slice(0, markerIndex) + marker + newBase64
  fs.writeFileSync(bundlePath, newContent, 'utf-8')
}

if (module.parent) {
  module.exports = buildBrowser
} else {
  buildBrowser()
}
