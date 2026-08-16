/*
Resolves the page shown at startup when there is no restorable session.
Kept dependency-free so it can be unit tested outside the browser bundle.
*/

const fallbackStartupPageURL = 'https://www.bing.com'

function resolveStartupPageURL (currentSearchEngine) {
  try {
    const url = new URL(currentSearchEngine.searchURL)
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname && !url.hostname.includes('%')) {
      return url.origin
    }
  } catch (e) {}

  return fallbackStartupPageURL
}

module.exports = { resolveStartupPageURL, fallbackStartupPageURL }
