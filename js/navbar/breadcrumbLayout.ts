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
Items are kept starting from the deepest (last) one, truncating the shallowest (first) ones first,
so the most recently navigated pages always stay visible.
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
    return { startIndex: 0, visibleCount: 0, hiddenCount: 0 }
  }

  const totalWidth = widths.reduce((sum, width) => sum + (Number(width) || 0), 0)
  if (totalWidth <= available) {
    return { startIndex: 0, visibleCount: itemCount, hiddenCount: 0 }
  }

  const budget = Math.max(0, available - (Number(overflowWidth) || 0))
  let visibleCount = 0
  let usedWidth = 0

  for (let i = itemCount - 1; i >= 0; i--) {
    usedWidth += Number(widths[i]) || 0
    if (usedWidth > budget && visibleCount > 0) {
      break
    }
    visibleCount++
  }

  visibleCount = Math.max(1, Math.min(itemCount, visibleCount))

  return {
    startIndex: itemCount - visibleCount,
    visibleCount,
    hiddenCount: itemCount - visibleCount
  }
}

module.exports = {
  MAX_LABEL_LENGTH,
  getBreadcrumbLabel,
  computeVisibleBreadcrumbs
}
