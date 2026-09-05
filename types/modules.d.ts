declare module 'dexie' {
  const Dexie: any
  export default Dexie
  export = Dexie
}

declare module 'dragula' {
  const dragula: any
  export = dragula
}

declare module 'expr-eval' {
  export const Parser: any
}

declare module 'pdfjs-dist' {
  const pdfjs: any
  export = pdfjs
}

declare module 'quick-score' {
  export const quickScore: any
}

declare module 'regedit' {
  const regedit: any
  export = regedit
}

declare module 'stemmer' {
  function stemmer(word: string): string
  export = stemmer
}

declare module 'write-file-atomic' {
  function writeFileAtomic(path: string, data: any, options?: any, callback?: Function): void
  export = writeFileAtomic
}

declare module 'electron-squirrel-startup' {
  const startup: boolean
  export = startup
}

declare module '@electron/fuses' {
  export const flipFuses: any
  export const FuseVersion: any
  export const FuseV1Options: any
}

declare module '@browsermt/bergamot-translator' {
  export const TranslationModel: any
}
