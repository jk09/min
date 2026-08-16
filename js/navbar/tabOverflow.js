/* pure layout calculations for the tab bar - no DOM access, so this stays testable */

const DEFAULT_TAB_WIDTH = 140
const MIN_TAB_WIDTH = 80
const MAX_TAB_WIDTH = 400

function clampTabWidth (value) {
  const width = Math.round(Number(value))
  if (!Number.isFinite(width)) {
    return DEFAULT_TAB_WIDTH
  }
  return Math.min(MAX_TAB_WIDTH, Math.max(MIN_TAB_WIDTH, width))
}

/*
Returns the slice of tabs that fits into the tab bar.
The active tab is always part of the returned slice.
*/
function computeVisibleTabs ({ tabCount, activeIndex = 0, containerWidth, tabWidth, labelWidth = 0 }) {
  const width = clampTabWidth(tabWidth)
  const available = Math.max(0, Number(containerWidth) || 0)

  if (tabCount <= 0) {
    return { startIndex: 0, visibleCount: 0, hiddenCount: 0 }
  }

  const fitsWithoutLabel = Math.floor(available / width)

  if (fitsWithoutLabel >= tabCount) {
    return { startIndex: 0, visibleCount: tabCount, hiddenCount: 0 }
  }

  const visibleCount = Math.max(1, Math.min(tabCount, Math.floor(Math.max(0, available - labelWidth) / width)))

  let startIndex = 0
  const active = Math.min(Math.max(0, activeIndex), tabCount - 1)
  if (active >= visibleCount) {
    startIndex = active - visibleCount + 1
  }
  startIndex = Math.min(startIndex, tabCount - visibleCount)

  return {
    startIndex,
    visibleCount,
    hiddenCount: tabCount - visibleCount
  }
}

/* MVP statistics for the tabs that don't fit on the tab bar */
function summarizeHiddenTabs (hiddenTabs = []) {
  const groups = []
  const groupsByDomain = {}
  let loading = 0
  let notLoaded = 0

  hiddenTabs.forEach(function (tab) {
    const domain = tab.domain || ''

    if (!groupsByDomain[domain]) {
      groupsByDomain[domain] = { domain, count: 0, tabs: [] }
      groups.push(groupsByDomain[domain])
    }
    groupsByDomain[domain].count++
    groupsByDomain[domain].tabs.push(tab)

    if (!tab.hasWebContents) {
      notLoaded++
    } else if (!tab.loaded) {
      loading++
    }
  })

  groups.sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))

  return {
    total: hiddenTabs.length,
    loading,
    notLoaded,
    groups
  }
}

module.exports = {
  DEFAULT_TAB_WIDTH,
  MIN_TAB_WIDTH,
  MAX_TAB_WIDTH,
  clampTabWidth,
  computeVisibleTabs,
  summarizeHiddenTabs
}
