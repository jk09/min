const chokidar = require('chokidar')
const path = require('path')

const jsDir = path.resolve(__dirname, '../js')
const preloadDir = path.resolve(__dirname, '../js/preload')
const browserStylesDir = path.resolve(__dirname, '../css')

const buildBrowser = require('./buildBrowser.js')
const buildPreload = require('./buildPreload.js')
const buildBrowserStyles = require('./buildBrowserStyles.js')

// main/*.js modules are loaded directly by Node/Electron (no build step needed),
// so main process changes just require restarting Electron instead of a rebuild

chokidar.watch(jsDir, { ignored: preloadDir }).on('change', function () {
  console.log('rebuilding browser')
  try {
    buildBrowser()
  } catch (e) {
    // a build error is usually a typo that is about to be fixed, so report it
    // and keep watching rather than dropping out of the dev loop
    console.warn('\x1b[31m' + 'Error while building: ' + e.message + '\x1b[0m')
  }
})

chokidar.watch(preloadDir).on('change', function () {
  console.log('rebuilding preload script')
  buildPreload()
})

chokidar.watch(browserStylesDir).on('change', function () {
  console.log('rebuilding browser styles')
  buildBrowserStyles()
})
