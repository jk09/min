export interface TabItem {
  id: string
  url: string
  title: string
  lastActivity?: number
  secure?: boolean
  private?: boolean
  readerable?: boolean
  themeColor?: string
  backgroundColor?: string
  scrollPosition?: number
  selected?: boolean
  muted?: boolean
  loaded?: boolean
  hasAudio?: boolean
  previewImage?: string
  isFileView?: boolean
  hasWebContents?: boolean
  [key: string]: any
}

export interface TabListOptions {
  atEnd?: boolean
}

export interface TabList {
  tabs: TabItem[]
  parentTaskList?: TaskList
  add(tab?: Partial<TabItem>, options?: TabListOptions, emit?: boolean): string
  update(id: string, data: Partial<TabItem>, emit?: boolean): void
  destroy(id: string, emit?: boolean): boolean
  get(id: string): TabItem | undefined
  has(id: string): boolean
  getIndex(id: string): number
  getSelected(): string | null
  getSelectedIndex(): number
  setSelected(id: string, emit?: boolean): boolean
  count(): number
  isEmpty(): boolean
  forEach(fn: (tab: TabItem, index: number) => void): void
  map<U>(fn: (tab: TabItem, index: number) => U): U[]
  filter(fn: (tab: TabItem, index: number) => boolean): TabItem[]
  splice(start: number, deleteCount: number, ...items: TabItem[]): TabItem[]
  getStringified(): TabItem[]
}

export interface TaskItem {
  id: string
  name: string | null
  tabs: TabList
  tabHistory?: any
  collapsed?: boolean
  selectedInWindow?: string | null
  [key: string]: any
}

export interface TaskList {
  tasks: TaskItem[]
  events: Array<{ name: string; fn: Function }>
  on(name: string, fn: Function): void
  emit(name: string, ...data: any[]): void
  add(task?: Partial<TaskItem>, index?: number, emit?: boolean): string
  update(id: string, data: Partial<TaskItem>, emit?: boolean): void
  destroy(id: string, emit?: boolean): boolean
  get(id: string): TaskItem | undefined
  has(id: string): boolean
  getIndex(id: string): number
  getSelected(): TaskItem | undefined
  setSelected(id: string, emit?: boolean): boolean
  getTaskContainingTab(tabId: string): TaskItem | undefined
  forEach(fn: (task: TaskItem, index: number) => void): void
  map<U>(fn: (task: TaskItem, index: number) => U): U[]
  getLength(): number
  getStringified(): any[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export interface ToolResult {
  success: boolean
  result?: any
  error?: string
}

export interface SkillDefinition {
  id: string
  name: string
  description: string
  trigger?: string
  systemPrompt?: string
  template?: string
  tools?: string[]
  run?: (context: any) => Promise<any>
}

export interface SearchEngine {
  name: string
  searchURL: string
  custom?: boolean
}

export interface BuildMetadata {
  commit: string
  branch: string
  dirty: boolean
  buildTime?: string
  version?: string
}
