/* Handles messages that get sent from the menu bar in the main process */

var webviews = require('webviews.js')
var webviewGestures = require('webviewGestures.js')
var browserUI = require('browserUI.js')
var focusMode = require('focusMode.js')
var modalMode = require('modalMode.js')
var findinpage = require('findinpage.js')
var PDFViewer = require('pdfViewer.js')
var readerView = require('readerView.js')

module.exports = {
  initialize: function () {
    window.min.app.onCommand('zoomIn', function () {
      webviewGestures.zoomWebviewIn(tabs.getSelected())
    })

    window.min.app.onCommand('zoomOut', function () {
      webviewGestures.zoomWebviewOut(tabs.getSelected())
    })

    window.min.app.onCommand('zoomReset', function () {
      webviewGestures.resetWebviewZoom(tabs.getSelected())
    })

    window.min.app.onCommand('print', function () {
      if (PDFViewer.isPDFViewer(tabs.getSelected())) {
        PDFViewer.printPDF(tabs.getSelected())
      } else if (readerView.isReader(tabs.getSelected())) {
        readerView.printArticle(tabs.getSelected())
      } else if (webviews.placeholderRequests.length === 0) {
        // work around #1281 - calling print() when the view is hidden crashes on Linux in Electron 12
        // TODO figure out why webContents.print() doesn't work in Electron 4
        webviews.callAsync(tabs.getSelected(), 'executeJavaScript', 'window.print()')
      }
    })

    window.min.app.onCommand('findInPage', function () {
      /* Page search is not available in modal mode. */
      if (modalMode.enabled()) {
        return
      }

      findinpage.start()
    })

    window.min.app.onCommand('inspectPage', function () {
      webviews.callAsync(tabs.getSelected(), 'toggleDevTools')
    })

    window.min.app.onCommand('addTab', function (data) {
      /* new tabs can't be created in modal mode */
      if (modalMode.enabled()) {
        return
      }

      /* new tabs can't be created in focus mode */
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      var newTab = tabs.add({
        url: data.url || ''
      })

      browserUI.addTab(newTab, {
        openPrompt: !data.url // only open the prompt if the new tab is empty
      })
    })

    window.min.app.onCommand('saveCurrentPage', async function () {
      var currentTab = tabs.get(tabs.getSelected())

      // new tabs cannot be saved
      if (!currentTab.url) {
        return
      }

      // if the current tab is a PDF, let the PDF viewer handle saving the document
      if (PDFViewer.isPDFViewer(tabs.getSelected())) {
        PDFViewer.savePDF(tabs.getSelected())
        return
      }

      if (tabs.get(tabs.getSelected()).isFileView) {
        webviews.callAsync(tabs.getSelected(), 'downloadURL', [tabs.get(tabs.getSelected()).url])
      } else {
        var savePath = await window.min.app.showSaveDialog(currentTab.title.replace(/[/\\]/g, '_'))

        // savePath will be undefined if the save dialog is canceled
        if (savePath) {
          if (!savePath.endsWith('.html')) {
            savePath = savePath + '.html'
          }
          webviews.callAsync(tabs.getSelected(), 'savePage', [savePath, 'HTMLComplete'])
        }
      }
    })

    window.min.app.onCommand('addPrivateTab', function () {
      /* new tabs can't be created in modal mode */
      if (modalMode.enabled()) {
        return
      }

      /* new tabs can't be created in focus mode */
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      browserUI.addTab(tabs.add({
        private: true
      }))
    })

    window.min.app.onCommand('goBack', function () {
      webviews.callAsync(tabs.getSelected(), 'goBack')
    })

    window.min.app.onCommand('goForward', function () {
      webviews.callAsync(tabs.getSelected(), 'goForward')
    })
  }
}
