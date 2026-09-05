/*
Resolves the page shown at startup when there is no restorable session.
Kept dependency-free so it can be unit tested outside the browser bundle.
*/

export const fallbackStartupPageURL: string = 'https://www.bing.com'

export interface SearchEngineSource {
  searchURL?: string | null
  [key: string]: any
}

export function resolveStartupPageURL (currentSearchEngine?: SearchEngineSource | null): string {
  if (!currentSearchEngine || !currentSearchEngine.searchURL) {
    return fallbackStartupPageURL
  }

  try {
    const url = new URL(currentSearchEngine.searchURL)
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname && !url.hostname.includes('%')) {
      return url.origin
    }
  } catch (e) {}

  return fallbackStartupPageURL
}

module.exports = { resolveStartupPageURL, fallbackStartupPageURL }
