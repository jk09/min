/* pure helpers for the informational content of a tab - no DOM access, so this stays testable */

export const RGB_COLOR: RegExp = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/
export const SAFE_ICON_PROTOCOL: RegExp = /^(https?|data|file|min):/i
export const MAX_LABEL_LENGTH: number = 60

export interface TabLabelOptions {
  abbreviation?: string | null
  domain?: string | null
  title?: string | null
  isNewTab?: boolean
  defaultLabel?: string
}

export interface TabDataColor {
  color?: string
}

export interface TabDataFavicon {
  url?: string
}

export interface TabData {
  themeColor?: TabDataColor | null
  backgroundColor?: TabDataColor | null
  favicon?: TabDataFavicon | null
  [key: string]: any
}

export function abbreviateDomain (domain?: string | null): string {
  if (!domain) {
    return ''
  }
  let result = String(domain).toLowerCase()
  if (result.startsWith('www.') && result.split('.').length > 2) {
    result = result.replace('www.', '')
  }
  return result.substring(0, MAX_LABEL_LENGTH)
}

/*
The label is the shortest meaningful description of the page:
LLM abbreviation > registrable domain > page title > default label
*/
export function getTabLabel ({
  abbreviation,
  domain,
  title,
  isNewTab,
  defaultLabel = ''
}: TabLabelOptions): string {
  if (isNewTab) {
    return defaultLabel
  }
  if (abbreviation && String(abbreviation).trim()) {
    return String(abbreviation).trim().substring(0, MAX_LABEL_LENGTH)
  }
  if (domain) {
    return abbreviateDomain(domain)
  }
  if (title && String(title).trim()) {
    return String(title).trim().substring(0, MAX_LABEL_LENGTH)
  }
  return defaultLabel
}

/* page-provided colors are untrusted, so only exact rgb() values are allowed into a style property */
export function getAccentColor (tabData?: TabData | null): string | null {
  if (!tabData) {
    return null
  }
  const candidates = [tabData.themeColor, tabData.backgroundColor]
  for (const candidate of candidates) {
    if (candidate && typeof candidate.color === 'string' && RGB_COLOR.test(candidate.color)) {
      return candidate.color
    }
  }
  return null
}

export function getFaviconURL (tabData?: TabData | null): string | null {
  if (tabData && tabData.favicon && typeof tabData.favicon.url === 'string' && SAFE_ICON_PROTOCOL.test(tabData.favicon.url)) {
    return tabData.favicon.url
  }
  return null
}

module.exports = {
  abbreviateDomain,
  getTabLabel,
  getAccentColor,
  getFaviconURL
}
