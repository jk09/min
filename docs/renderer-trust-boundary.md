# The renderer trust boundary

How Min's browser chrome is isolated from Node and Electron, and the rules for
adding to the boundary. Implemented by
[the secure renderer specification](../spec/backlog/feat-k9m2rs-secure-renderer-architecture/SPEC.md).

## The shape of it

There are three kinds of code, and they get very different privileges.

| | Runs where | Privileges |
| --- | --- | --- |
| **Main process** (`main/`) | Node | Everything. Owns all filesystem paths, process launching, and Electron APIs. |
| **Preloads** (`js/preload/`) | Isolated world | `require('electron')` only, to build a bridge. Never hands a module to the page. |
| **Renderer** (`js/`, bundled into `dist/bundle.js`) | Page world | Browser APIs plus the `window.min` bridge. No Node, no Electron, no raw IPC. |

The main chrome view is created in `main/windowUtils.js` with
`nodeIntegration: false`, `nodeIntegrationInWorker: false`,
`contextIsolation: true` and `sandbox: true`. Views showing web content get the
same treatment in `main/viewManager.js`, plus the unprivileged
`dist/preload.js`.

## The bridge

`js/preload/browserChrome.js` exposes one object, `window.min`, through
`contextBridge`. It is a fixed set of named capabilities:

`bootstrap`, `window`, `clipboard`, `app`, `permissions`, `tabState`,
`history`, `settings`, `session`, `views`, `menu`, `downloads`, `files`,
`userscripts`, `passwordManager`, `prompt`.

`js/preload/chromeBridgeContract.ts` lists the method names of each group and
is asserted against in `test/chromeBridgeContract.test.js`. `types/globals.d.ts`
carries the types.

The bridge must never expose a generic `ipcRenderer`, `send`, `invoke`,
`require`, a Node or Electron module, a filesystem object, an arbitrary path
operation, a process launcher, or a shell facade. Where the renderer needs to
name something, it names it from a fixed list: `app.onCommand` takes one of
fifteen command channels, `views.callMethod` one of twenty-six `webContents`
methods.

## Rules for adding a capability

1. **Put the privilege in the main process.** The renderer asks for an
   outcome ("back up these bookmarks"), not for a mechanism ("write this
   path").
2. **Validate the sender.** Every chrome-only handler calls
   `getChromeWindow(event)` from `main/chromeCapabilities.js`, which throws
   unless the sender is the owning window's chrome `WebContents`. A handler
   without it is reachable from any renderer in the app.
3. **Validate the payload.** Check types and shapes in the main process, even
   when the preload already does. The preload's allowlist protects a
   well-behaved renderer; the main-process one protects against a compromised
   renderer that reaches the channel directly.
4. **Build paths in the main process.** The renderer never submits a
   filesystem path. Where it must name a file, it names an opaque selection
   (`webUtils.getPathForFile`) or an allowlisted identifier.
5. **Pass data, not Electron objects.** Event subscriptions hand the callback
   the payload only, never the Electron `event`, and return an unsubscribe
   function.
6. **Name a fixed channel.** No API takes a channel name, method name, or
   module name from the renderer without checking it against a frozen list.

## The build

`scripts/buildBrowser.js` bundles the renderer with esbuild. Repo-root- and
`js/`-relative module ids resolve through esbuild's `nodePaths`, a build-time
alias map — renderer code never resolves a module at runtime.

Node and Electron modules are marked `external`, and the build fails if any of
them is reachable from the renderer graph, naming the file that imported it.
That check is the thing that keeps rule 1 honest over time.

`global` is defined as `globalThis` for the browser libraries that expect it.
`process`, `Buffer`, `setImmediate` and friends are deliberately left
undefined: a module reaching for one is a bug to fix at the source, not to
paper over with a shim.

`npm run typecheck` (`tsc --noEmit`) stays separate. esbuild strips types
without checking them, so the build passing means nothing about type safety.

## Verifying it

`test/rendererTrustBoundary.test.js` starts the real app and asserts on a probe
that runs inside the chrome renderer. It checks three separate things:

- the web preferences the view was actually created with. With context
  isolation on, the page world has no Node globals whether or not
  `nodeIntegration` is set, so the runtime checks below cannot see that flag
  regress.
- that `require`, `process`, `Buffer`, `module`, `window.electron`,
  `window.fs`, `window.ipc`, `window.EventEmitter` and `window.globalArgs` are
  all absent.
- that the renderer finished initializing and the bridge arrived with every
  capability group and populated bootstrap data.

The third matters more than it looks. Nothing else in the suite loads the
bundle in a browser, so a renderer that throws on startup passes every other
test — which is exactly what happened for several migration stages, when
context isolation was enabled while the bootstrap still read `process.argv`.

To look at it by hand:

```sh
ELECTRON_RUN_AS_NODE= npx electron . --development-mode --startup-diagnostics --enable-logging
```

Confirm `did-finish-load` for `min://app/index.html`, read the
`[renderer-trust-boundary]` line, and check for errors whose source is
`min://app/dist/bundle.js`.

## Known gaps

- The legacy history export window (`main/main.js`) still runs with
  `nodeIntegration: true` and `contextIsolation: false` to migrate history from
  the old IndexedDB store, and the ungated `history:request` channel exists for
  it. It belongs to `history-sqlite-migration`; retiring that window would let
  the channel go too.
- `main/prompt.js` and the page-translation channel are reachable without a
  chrome sender check, because they serve the prompt window and the web-content
  preload rather than the chrome renderer. They are narrow, but they are not
  sender-validated.
