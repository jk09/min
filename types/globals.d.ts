/// <reference types="node" />
/// <reference types="electron" />

import type { IpcRenderer, App, BrowserWindow, WebContents } from 'electron'
import type * as FSType from 'fs'
import type { EventEmitter as NodeEventEmitter } from 'events'
import type { TabList, TaskList } from './min'

interface ChromeBridge {
  bootstrap: Readonly<{
    appVersion: string
    developmentMode: boolean
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
    writeText: (text: string) => Promise<void>
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
  prompt: Readonly<{
    cancel: (requestId: string) => Promise<any>
    complete: (request: any) => Promise<any>
    getStatus: () => Promise<any>
    onProgress: (requestId: string, callback: (data: any) => void) => () => void
  }>
}

declare global {
  // Global variables attached to window in renderer
  var globalArgs: Record<string, any>
  var windowId: string | undefined
  var electron: typeof import('electron')
  var fs: typeof FSType
  var EventEmitter: typeof NodeEventEmitter
  var ipc: IpcRenderer
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
    globalArgs: Record<string, any>
    windowId: string | undefined
    electron: typeof import('electron')
    fs: typeof FSType
    EventEmitter: typeof NodeEventEmitter
    ipc: IpcRenderer
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
