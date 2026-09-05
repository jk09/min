export const UNKNOWN: string = 'unknown'

export interface BuildInfoData {
  commit?: string
  shortCommit?: string
  branch?: string
  dirty?: boolean
  buildTime?: string
  [key: string]: any
}

export function formatLabel (info?: BuildInfoData | null): string {
  if (!info || !info.shortCommit || info.shortCommit === UNKNOWN) {
    return '#' + UNKNOWN
  }

  return '#' + info.shortCommit + (info.dirty ? '*' : '')
}

export function formatTitle (info?: BuildInfoData | null): string {
  if (!info || !info.commit || info.commit === UNKNOWN) {
    return 'Build commit unknown (built without git metadata)'
  }

  return [
    'Commit: ' + info.commit,
    'Branch: ' + (info.branch || UNKNOWN),
    'Working tree: ' + (info.dirty ? 'modified' : 'clean'),
    'Built: ' + (info.buildTime || UNKNOWN)
  ].join('\n')
}

export function render (element?: HTMLElement | { textContent?: string; title?: string; setAttribute: (name: string, value: string) => void } | null, info?: BuildInfoData | null): void {
  if (!element) {
    return
  }

  const title = formatTitle(info)
  element.textContent = formatLabel(info)
  element.title = title
  element.setAttribute('aria-label', title)
}

module.exports = { UNKNOWN, formatLabel, formatTitle, render }
