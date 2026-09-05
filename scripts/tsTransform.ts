import through from 'through2'
import * as ts from 'typescript'
import type { Transform } from 'stream'

export interface TsTransformOptions {
  [key: string]: any
}

export function tsTransform (file: string, opts?: TsTransformOptions): Transform {
  if (!/\.tsx?$/.test(file)) {
    return through()
  }
  let data: string = ''
  return through(
    function (this: Transform, buf: Buffer, enc: BufferEncoding, next: () => void) {
      data += buf.toString('utf8')
      next()
    },
    function (this: Transform, next: (err?: Error | null) => void) {
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
      } catch (err: any) {
        next(err)
      }
    }
  )
}

module.exports = tsTransform
