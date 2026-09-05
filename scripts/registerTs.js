const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const rootDir = path.resolve(__dirname, '../')
const jsDir = path.resolve(rootDir, 'js')
const candidateBases = [jsDir, rootDir]
const candidateExtensions = ['', '.ts', '.js', '.tsx', '.json']

if (!require.extensions['.ts']) {
  require.extensions['.ts'] = function (module, filename) {
    const content = fs.readFileSync(filename, 'utf-8')
    const compiled = ts.transpileModule(content, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    })
    module._compile(compiled.outputText, filename)
  }
}

if (!require.extensions['.tsx']) {
  require.extensions['.tsx'] = require.extensions['.ts']
}

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options)
  } catch (err) {
    if (typeof request === 'string') {
      if (request.endsWith('.js')) {
        const tsRequest = request.slice(0, -3) + '.ts'
        try {
          return originalResolveFilename.call(this, tsRequest, parent, isMain, options)
        } catch (e) {}
      }

      if (!request.startsWith('.') && !path.isAbsolute(request)) {
        for (const base of candidateBases) {
          const direct = path.join(base, request)
          for (const ext of candidateExtensions) {
            const candidate = direct.endsWith(ext) ? direct : direct + ext
            if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
              return candidate
            }
          }
          if (request.endsWith('.js')) {
            const tsDirect = path.join(base, request.slice(0, -3) + '.ts')
            if (fs.existsSync(tsDirect) && !fs.statSync(tsDirect).isDirectory()) {
              return tsDirect
            }
          }
        }
      }
    }
    throw err
  }
}

module.exports = true
