var webviews = require('webviews.js')
var urlParser = require('util/urlParser.js')

const colorExtractorImage = document.createElement('img')
colorExtractorImage.crossOrigin = 'anonymous'
const colorExtractorCanvas = document.createElement('canvas')
const colorExtractorContext = colorExtractorCanvas.getContext('2d')

const textColorNN = require('ext/textColor/textColor.js')

const defaultColors = {
  private: ['rgb(58, 44, 99)', 'white'],
  lightMode: ['rgb(255, 255, 255)', 'black'],
  darkMode: ['rgb(33, 37, 43)', 'white']
}

function getColorFromImage (image) {
  const w = colorExtractorImage.width
  const h = colorExtractorImage.height
  colorExtractorCanvas.width = w
  colorExtractorCanvas.height = h

  const offset = Math.max(1, Math.round(0.00032 * w * h))

  colorExtractorContext.drawImage(colorExtractorImage, 0, 0, w, h)

  const data = colorExtractorContext.getImageData(0, 0, w, h).data

  const pixels = {}

  let d, add, sum

  for (let i = 0; i < data.length; i += 4 * offset) {
    d = Math.round(data[i] / 5) * 5 + ',' + Math.round(data[i + 1] / 5) * 5 + ',' + Math.round(data[i + 2] / 5) * 5

    add = 1
    sum = data[i] + data[i + 1] + data[i + 2]

    // very dark or light pixels shouldn't be counted as heavily
    if (sum < 310) {
      add = 0.35
    }

    if (sum < 50) {
      add = 0.01
    }

    if (data[i] > 210 || data[i + 1] > 210 || data[i + 2] > 210) {
      add = 0.5 - (0.0001 * sum)
    }

    if (pixels[d]) {
      pixels[d] = pixels[d] + add
    } else {
      pixels[d] = add
    }
  }

  // find the largest pixel set
  let largestPixelSet = null
  let ct = 0

  for (const k in pixels) {
    if (k === '255,255,255' || k === '0,0,0') {
      pixels[k] *= 0.05
    }
    if (pixels[k] > ct) {
      largestPixelSet = k
      ct = pixels[k]
    }
  }

  const res = largestPixelSet.split(',')

  for (let i = 0; i < res.length; i++) {
    res[i] = parseInt(res[i])
  }

  return res
}

function getColorFromString (str) {
  colorExtractorContext.clearRect(0, 0, 1, 1)
  colorExtractorContext.fillStyle = str
  colorExtractorContext.fillRect(0, 0, 1, 1)
  const rgb = Array.from(colorExtractorContext.getImageData(0, 0, 1, 1).data).slice(0, 3)

  return rgb
}

function getRGBString (c) {
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
}

function getTextColor (bgColor) {
  const obj = {
    r: bgColor[0] / 255,
    g: bgColor[1] / 255,
    b: bgColor[2] / 255
  }
  const output = textColorNN(obj)
  if (output.black > 0.5) {
    return 'black'
  }
  return 'white'
}

function isLowContrast (color) {
  // is this a color that won't change very much when lightened or darkened?
  // TODO is lowContrast the best name for this?
  return color.filter(i => (i > 235 || i < 15)).length === 3
}

// https://stackoverflow.com/a/596243
function getLuminance (c) {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

function setColor (bg, fg, isLowContrast) {
  document.body.style.setProperty('--theme-background-color', bg)
  document.body.style.setProperty('--theme-foreground-color', fg)

  const backgroundElements = document.getElementsByClassName('theme-background-color')
  const textElements = document.getElementsByClassName('theme-text-color')

  for (let i = 0; i < backgroundElements.length; i++) {
    backgroundElements[i].style.backgroundColor = bg
  }

  for (let i = 0; i < textElements.length; i++) {
    textElements[i].style.color = fg
  }

  if (fg === 'white') {
    document.body.classList.add('dark-theme')
  } else {
    document.body.classList.remove('dark-theme')
  }
  if (isLowContrast) {
    document.body.classList.add('theme-background-low-contrast')
  } else {
    document.body.classList.remove('theme-background-low-contrast')
  }
}

// domain the current color of each tab was taken from, so the color stays the same while browsing a site
const colorSourceDomains = {}

function getTabDomain (tabId) {
  const tab = tabs.get(tabId)
  return tab ? urlParser.getDomain(tab.url) : ''
}

function hasColorForCurrentSite (tabId) {
  return !!colorSourceDomains[tabId] && colorSourceDomains[tabId] === getTabDomain(tabId)
}

const tabColor = {
  initialize: function () {
    webviews.bindEvent('page-favicon-updated', function (tabId, favicons) {
      tabColor.updateFromImage(favicons, tabId, function () {
        if (tabId === tabs.getSelected()) {
          tabColor.updateColors()
        }
      })
    })

    webviews.bindEvent('did-change-theme-color', function (tabId, color) {
      tabColor.updateFromThemeColor(color, tabId)
      if (tabId === tabs.getSelected()) {
        tabColor.updateColors()
      }
    })

    /*
    Reset the color when the tab moves to a different site, so that it won't inherit the color of the previous one.
    Navigating within the same site keeps the color that was picked when the site was first loaded.
     */
    webviews.bindEvent('did-start-navigation', function (tabId, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) {
      if (!isMainFrame || isInPlace) {
        return
      }
      if (colorSourceDomains[tabId] === urlParser.getDomain(url)) {
        return
      }

      delete colorSourceDomains[tabId]
      tabs.update(tabId, {
        themeColor: null,
        backgroundColor: null,
        favicon: null
      })
    })

    tasks.on('tab-destroyed', function (tabId) {
      delete colorSourceDomains[tabId]
    })

    /*
    Always rerender once the page has finished loading
    this is needed to go back to default colors in case this page doesn't specify one
     */
    webviews.bindEvent('did-finish-load', function (tabId) {
      tabColor.updateColors()
    })

    // theme changes can affect the tab colors
    window.addEventListener('themechange', function (e) {
      tabColor.updateColors()
    })

    tasks.on('tab-selected', this.updateColors)
  },
  updateFromThemeColor: function (color, tabId) {
    if (!color || hasColorForCurrentSite(tabId)) {
      return
    }

    const rgb = getColorFromString(color)

    colorSourceDomains[tabId] = getTabDomain(tabId)

    tabs.update(tabId, {
      themeColor: {
        color: getRGBString(rgb),
        textColor: getTextColor(rgb),
        isLowContrast: isLowContrast(rgb)
      }
    })
  },
  updateFromImage: function (favicons, tabId, callback) {
    // private tabs always use a special color, we don't need to get the icon
    if (tabs.get(tabId).private === true) {
      return
    }

    const existingFavicon = tabs.get(tabId).favicon

    // the icon is shown on the tab even if the color can't be extracted from it
    if (!existingFavicon || existingFavicon.url !== favicons[0]) {
      tabs.update(tabId, {
        favicon: {
          url: favicons[0],
          luminance: null
        }
      })
    }

    if (hasColorForCurrentSite(tabId)) {
      return
    }

    requestIdleCallback(function () {
      colorExtractorImage.onload = function (e) {
        const backgroundColor = getColorFromImage(colorExtractorImage)

        colorSourceDomains[tabId] = getTabDomain(tabId)

        tabs.update(tabId, {
          backgroundColor: {
            color: getRGBString(backgroundColor),
            textColor: getTextColor(backgroundColor),
            isLowContrast: isLowContrast(backgroundColor)
          },
          favicon: {
            url: favicons[0],
            luminance: getLuminance(backgroundColor)
          }
        })

        if (callback) {
          callback()
        }
      }
      colorExtractorImage.src = favicons[0]
    }, {
      timeout: 1000
    })
  },
  updateColors: function () {
    const tab = tabs.get(tabs.getSelected())

    /* the browser chrome keeps a uniform color - page colors are only shown on the individual tabs */

    // private tabs have their own color scheme
    if (tab.private) {
      return setColor(defaultColors.private[0], defaultColors.private[1])
    }

    if (window.isDarkMode) {
      return setColor(defaultColors.darkMode[0], defaultColors.darkMode[1])
    }
    return setColor(defaultColors.lightMode[0], defaultColors.lightMode[1])
  }
}

module.exports = tabColor
