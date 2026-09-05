/* pure layout/label calculations for the breadcrumbs bar - no DOM access, so this stays testable */

export const MAX_LABEL_LENGTH: number = 40

export interface BreadcrumbEntry {
  title?: string | null
  url?: string | null
}

export interface VisibleBreadcrumbsOptions {
  itemWidths?: number[]
  containerWidth?: number
  overflowWidth?: number
}

export interface VisibleBreadcrumbsResult {
  startIndex: number
  visibleCount: number
  hiddenCount: number
  visibleIndexes: number[]
}

/*
Derives a short, human-readable label for a navigation history entry.
Prefers the page title, falling back to the URL's hostname, and finally the raw URL.
*/
export function getBreadcrumbLabel (entry?: BreadcrumbEntry | null): string {
  if (!entry) {
    return ''
  }

  const title = entry.title && String(entry.title).trim()
  if (title) {
    return title.length > MAX_LABEL_LENGTH ? title.substring(0, MAX_LABEL_LENGTH) + '\u2026' : title
  }

  const url = entry.url || ''
  try {
    const parsed = new URL(url)
    if (parsed.hostname) {
      return parsed.hostname
    }
  } catch (e) {
    // not a parseable URL (e.g. about:blank) - fall through to the raw value
  }
  return url
}

/*
Decides which breadcrumb items fit in the available width.
When truncation is required, the oldest and newest entries remain visible with an ellipsis between
them. The most recent entries fill any remaining space after the oldest entry is reserved.
*/
export function computeVisibleBreadcrumbs ({
  itemWidths,
  containerWidth,
  overflowWidth = 0
}: VisibleBreadcrumbsOptions): VisibleBreadcrumbsResult {
  const widths = Array.isArray(itemWidths) ? itemWidths : []
  const itemCount = widths.length
  const available = Math.max(0, Number(containerWidth) || 0)

  if (itemCount === 0) {
    return { startIndex: 0, visibleCount: 0, hiddenCount: 0, visibleIndexes: [] }
  }

  const totalWidth = widths.reduce((sum, width) => sum + (Number(width) || 0), 0)
  if (totalWidth <= available) {
    return { startIndex: 0, visibleCount: itemCount, hiddenCount: 0, visibleIndexes: widths.map((width, index) => index) }
  }

  const budget = Math.max(0, available - (Number(overflowWidth) || 0))
  const tailIndexes: number[] = []
  let usedWidth = Number(widths[0]) || 0

  for (let i = itemCount - 1; i > 0; i--) {
    const itemWidth = Number(widths[i]) || 0
    if (usedWidth + itemWidth > budget && tailIndexes.length > 0) {
      break
    }
    usedWidth += itemWidth
    tailIndexes.unshift(i)
  }

  const visibleIndexes = [0].concat(tailIndexes)
  const startIndex = tailIndexes[0] || 0

  return {
    startIndex,
    visibleCount: visibleIndexes.length,
    hiddenCount: itemCount - visibleIndexes.length,
    visibleIndexes
  }
}

module.exports = {
  MAX_LABEL_LENGTH,
  getBreadcrumbLabel,
  computeVisibleBreadcrumbs
}
