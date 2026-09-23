/// <reference types="node" />
/// <reference types="electron" />

import type { TabList, TaskList } from './min'

interface ChromeBridge {
  bootstrap: Readonly<{
    appName: string
    appVersion: string
    developmentMode: boolean
    initialTask: string | null
    initialWindow: boolean
    platform: 'darwin' | 'linux' | 'win32'
    windowId: string
  }>
  window: Readonly<{
    close: () => Promise<void>
    maximize: () => Promise<void>
    minimize: () => Promise<void>
    setFullScreen: (enabled: boolean) => Promise<void>
    unmaximize: () => Promise<void>
    onStateChange: (callback: (state: string) => void) => () => void
  }>
  clipboard: Readonly<{
    readText: () => Promise<string>
    writeBookmark: (data: { text: string, bookmark?: string, html: string }) => Promise<void>
    writeText: (text: string) => Promise<void>
  }>
  app: Readonly<{
    addWordToDictionary: (word: string) => Promise<void>
    getHosts: () => Promise<string[]>
    onBeforeInputEvent: (callback: (input: any) => void) => () => void
    onCommand: (command: string, callback: (data?: any) => void) => () => void
    quit: () => Promise<void>
    setWindowTitle: (title: string) => Promise<void>
    showFocusModeDialog: () => Promise<void>
    showSaveDialog: (defaultPath: string) => Promise<string | undefined>
    showSecondaryMenu: (position: { x: number, y: number }) => Promise<void>
    updateHandoff: (url: string) => Promise<void>
    writeBookmarksBackup: (html: string) => Promise<void>
  }>
  permissions: Readonly<{
    grant: (permissionId: number) => Promise<void>
    onChange: (callback: (requests: any[]) => void) => () => void
  }>
  tabState: Readonly<{
    onChanges: (callback: (data: { sourceWindowId: string, events: any[] }) => void) => () => void
    onReadRequest: (callback: () => void) => () => void
    requestSync: () => Promise<{ tasks: any[] }>
    returnState: (state: any) => void
    sendChanges: (events: any[]) => void
  }>
  history: Readonly<{
    request: (data: { action: string, [key: string]: any }) => Promise<any>
  }>
  settings: Readonly<{
    read: () => Promise<Record<string, any>>
    set: (key: string, value: any) => Promise<void>
    onChanged: (callback: (data: [string, any]) => void) => () => void
  }>
  session: Readonly<{
    backup: (data: string) => Promise<string>
    read: () => Promise<string | null>
    write: (data: string) => Promise<void>
  }>
  views: Readonly<{
    callMethod: (data: { id: string | number, callId?: number, method: string, args: any[] }) => void
    capture: (data: { id: string | number, width: number, height: number }) => void
    create: (data: any) => void
    destroy: (id: string | number) => void
    focus: (id: string | number) => void
    focusMain: () => void
    getNavigationHistory: (id: string | number) => Promise<any>
    hideCurrent: () => void
    loadURL: (data: { id: string | number, url: string }) => void
    setBounds: (data: any) => void
    setCurrent: (data: any) => void
    onAsyncCallResult: (callback: (data: any) => void) => () => void
    onCapture: (callback: (data: any) => void) => () => void
    onEvent: (callback: (data: any) => void) => () => void
    onIPC: (callback: (data: any) => void) => () => void
    onWindowFocus: (callback: () => void) => () => void
  }>
  menu: Readonly<{
    onItemSelected: (callback: (data: { menuId: number, itemId: number }) => void) => () => void
    onWillClose: (callback: (data: { menuId: number }) => void) => () => void
    open: (data: { id: number, template: any[], x: number, y: number }) => void
  }>
  downloads: Readonly<{
    cancel: (path: string) => void
    onInfo: (callback: (data: any) => void) => () => void
    open: (path: string) => Promise<string>
    showInFolder: (path: string) => Promise<void>
    startFileDrag: (path: string) => Promise<void>
  }>
  files: Readonly<{
    toFileURL: (file: File) => string | null
  }>
  userscripts: Readonly<{
    list: () => Promise<Array<{ name: string, content: string }>>
    openDirectory: () => Promise<string>
    watch: () => Promise<void>
    unwatch: () => Promise<void>
    onChanged: (callback: () => void) => () => void
  }>
  passwordManager: Readonly<{
    bitwarden: (operation: string, data: Record<string, string>) => Promise<string>
    checkTool: (manager: 'bitwarden' | 'onepassword') => Promise<boolean>
    installTool: (manager: 'bitwarden' | 'onepassword', file: File) => Promise<void>
    launchInstaller: (manager: 'bitwarden' | 'onepassword', file: File) => Promise<void>
    onePassword: (operation: string, data: Record<string, string>) => Promise<string>
    prompt: (options: Record<string, any>) => any
    readImport: () => Promise<string | null>
    credentials: Readonly<{
      delete: (account: { domain: string, username: string }) => Promise<void>
      getAll: () => Promise<Array<{ domain: string, username: string, password: string }>>
      set: (account: { domain: string, username: string, password: string }) => Promise<void>
      setAll: (accounts: Array<{ domain: string, username: string, password: string }>) => Promise<void>
    }>
  }>
  prompt: Readonly<{
    cancel: (requestId: string) => Promise<any>
    complete: (request: any) => Promise<any>
    getStatus: () => Promise<any>
    onProgress: (requestId: string, callback: (data: any) => void) => () => void
  }>
}

declare global {
  // Global variables attached to window in renderer
  var windowId: string | undefined
  var platformType: 'mac' | 'windows' | 'linux'

  var tabs: TabList
  var tasks: TaskList
  var webviews: any
  var searchbar: any
  var keyMap: any

  // Global utilities declared on window
  function l(stringId: string): string
  function throttle<T extends (...args: any[]) => any>(fn: T, threshold?: number, scope?: any): T
  function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T
  function empty(node: Node | Element | null): void

  interface Window {
    min: ChromeBridge
    windowId: string | undefined
    platformType: 'mac' | 'windows' | 'linux'
    tabs: TabList
    tasks: TaskList
    webviews: any
    searchbar: any
    keyMap: any
    l: (stringId: string) => string
    throttle: <T extends (...args: any[]) => any>(fn: T, threshold?: number, scope?: any) => T
    debounce: <T extends (...args: any[]) => any>(fn: T, delay: number) => T
    empty: (node: Node | Element | null) => void
  }
}

export {}
