const through = require('through2')
const ts = require('typescript')

function tsTransform (file, opts) {
  if (!/\.tsx?$/.test(file)) {
    return through()
  }
  let data = ''
  return through(
    function (buf, enc, next) {
      data += buf.toString('utf8')
      next()
    },
    function (next) {
      try {
        const result = ts.transpileModule(data, {
          fileName: file,
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true
          }
        })
        this.push(result.outputText)
        next()
      } catch (err) {
        next(err)
      }
    }
  )
}

module.exports = tsTransform
