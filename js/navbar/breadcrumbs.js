const webviews = require('webviews.js')
const breadcrumbLayout = require('navbar/breadcrumbLayout')

/*
Renders a per-tab breadcrumbs bar below the navbar, built directly from the webview's
navigation history. Electron's navigation history already preserves forward entries after
going back, so it maps naturally onto "deeper levels available to jump forward to".
*/
var breadcrumbs = {
  container: document.getElementById('breadcrumbs-bar'),
  inner: document.getElementById('breadcrumbs-inner'),
  overflowButton: document.getElementById('breadcrumbs-overflow-button'),
  barHeight: 0,
  expandedTabId: null,
  renderToken: 0,
  update: function () {
    var tabId = tabs.getSelected()
    var tab = tabs.get(tabId)
    breadcrumbs.showBar()

    if (!tab) {
      empty(breadcrumbs.inner)
      return
    }

    var fallbackHistory = {
      entries: [{ title: tab.title || l('newTabLabel'), url: tab.url }],
      activeIndex: 0
    }

    if (!tab.url) {
      breadcrumbs.render(tabId, fallbackHistory)
      return
    }

    var token = ++breadcrumbs.renderToken

    webviews.getNavigationHistory(tabId).then(function (history) {
      if (token !== breadcrumbs.renderToken || tabs.getSelected() !== tabId) {
        // a newer update has since been requested, or the user already switched tabs
        return
      }
      if (!history || !history.entries || history.entries.length === 0) {
        breadcrumbs.render(tabId, fallbackHistory)
        return
      }
      breadcrumbs.render(tabId, history)
    }).catch(function () {
      breadcrumbs.render(tabId, fallbackHistory)
    })
  },
  render: function (tabId, history) {
    empty(breadcrumbs.inner)

    history.entries.forEach(function (entry, index) {
      var item = document.createElement('button')
      item.className = 'breadcrumb-item'
      item.setAttribute('role', 'listitem')
      item.textContent = breadcrumbLayout.getBreadcrumbLabel(entry)
      item.title = entry.url

      if (index === history.activeIndex) {
        item.classList.add('current')
        item.setAttribute('aria-current', 'page')
      } else if (index > history.activeIndex) {
        item.classList.add('subdued')
      }

      item.addEventListener('click', function () {
        if (index === history.activeIndex) {
          return
        }
        webviews.callAsync(tabId, 'goToIndex', index)
      })

      breadcrumbs.inner.appendChild(item)
    })

    breadcrumbs.showBar()

    if (breadcrumbs.expandedTabId === tabId) {
      breadcrumbs.container.classList.add('expanded')
      breadcrumbs.overflowButton.hidden = true
      return
    }

    breadcrumbs.container.classList.remove('expanded')
    breadcrumbs.applyTruncation()
  },
  applyTruncation: function () {
    if (breadcrumbs.container.hidden) {
      return
    }

    var items = Array.from(breadcrumbs.inner.children)

    items.forEach(function (item) {
      item.classList.remove('breadcrumb-hidden')
    })
    breadcrumbs.overflowButton.hidden = true

    var itemWidths = items.map(function (item) {
      return item.getBoundingClientRect().width
    })

    var layout = breadcrumbLayout.computeVisibleBreadcrumbs({
      itemWidths: itemWidths,
      containerWidth: breadcrumbs.inner.getBoundingClientRect().width,
      overflowWidth: breadcrumbs.overflowButton.getBoundingClientRect().width || 32
    })

    items.forEach(function (item, index) {
      if (index < layout.startIndex) {
        item.classList.add('breadcrumb-hidden')
      }
    })

    if (layout.hiddenCount > 0) {
      breadcrumbs.overflowButton.hidden = false
      breadcrumbs.overflowButton.textContent = '+' + layout.hiddenCount
      breadcrumbs.overflowButton.setAttribute('aria-label', l('breadcrumbsHiddenLabel').replace('%n', layout.hiddenCount))
    }
  },
  showBar: function () {
    breadcrumbs.container.hidden = false
  },
  hide: function () {
    breadcrumbs.expandedTabId = null
    breadcrumbs.container.classList.remove('expanded')
    empty(breadcrumbs.inner)
  },
  toggleExpanded: function () {
    var tabId = tabs.getSelected()
    breadcrumbs.expandedTabId = breadcrumbs.expandedTabId === tabId ? null : tabId
    breadcrumbs.update()
  },
  initialize: function () {
    breadcrumbs.overflowButton.addEventListener('click', breadcrumbs.toggleExpanded)

    tasks.on('tab-selected', breadcrumbs.update)
    webviews.bindEvent('did-navigate', breadcrumbs.update)
    webviews.bindEvent('did-navigate-in-page', breadcrumbs.update)
    webviews.bindEvent('page-title-updated', breadcrumbs.update)

    window.addEventListener('resize', throttle(function () {
      if (breadcrumbs.expandedTabId !== tabs.getSelected()) {
        breadcrumbs.applyTruncation()
      }
    }, 100))
  }
}

module.exports = breadcrumbs
