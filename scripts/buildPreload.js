const path = require('path')
const fs = require('fs')
const ts = require('typescript')

const outFile = path.resolve(__dirname, '../dist/preload.js')
const chromeOutFile = path.resolve(__dirname, '../dist/preload-chrome.js')

const modules = [
  'js/preload/default.js',
  'js/preload/textExtractor.js',
  'js/preload/readerDetector.js',
  'js/preload/siteUnbreak.js',
  'js/util/settings/settingsPreload.js',
  'js/preload/passwordFill.js',
  'js/preload/translate.js',
  'js/preload/historyGraphPreload.js',
  'js/llmPrompt/llmDebugPreload.js'
]

function buildPreload () {
  /* concatenate modules */
  let output = ''
  modules.forEach(function (script) {
    const filePath = path.resolve(__dirname, '../', script)
    let content = fs.readFileSync(filePath, 'utf-8')
    if (script.endsWith('.ts')) {
      content = ts.transpileModule(content, {
        fileName: filePath,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022
        }
      }).outputText
    }
    output += content + ';\n'
  })

  fs.writeFileSync(outFile, output, 'utf-8')

  fs.copyFileSync(path.resolve(__dirname, '../js/preload/browserChrome.js'), chromeOutFile)
}

if (module.parent) {
  module.exports = buildPreload
} else {
  buildPreload()
}
