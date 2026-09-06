function shouldSavePage (url, isPrivate, isSearchPage, isNonIndexableInternalPage) {
  if (isPrivate || !url) {
    return false
  }

  return !isNonIndexableInternalPage && !isSearchPage
}

module.exports = { shouldSavePage }
