/// <reference types="node" />
/// <reference types="electron" />

import type { IpcRenderer, App, BrowserWindow, WebContents } from 'electron'
import type * as FSType from 'fs'
import type { EventEmitter as NodeEventEmitter } from 'events'
import type { TabList, TaskList } from './min'

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
