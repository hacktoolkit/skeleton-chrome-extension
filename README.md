# Tab Counter

<!-- skeleton:start -->
> This is the **Hacktoolkit Chrome extension skeleton**. It ships as a small working extension, Tab Counter, so every piece can be run and tested before you change anything. To start your own extension, see [Using this skeleton](#using-this-skeleton).
<!-- skeleton:end -->

Counts your tabs and closes the blank ones. Manifest V3, vanilla JavaScript, no build step, no dependencies. Works in Chrome, Brave, Edge and other Chromium browsers (Chrome 121 or newer).

<!-- skeleton:start -->
## Using this skeleton

1. Create a repository from this template on GitHub (**Use this template**), or clone it.
2. Run the init script once. It renames everything, resets the version, and deletes itself:
   ```sh
   node scripts/init.mjs "My Extension" "What it does in one line" hacktoolkit/my-extension
   ```
3. Replace `img/icon*.png` with your icon at 16, 32, 48 and 128 pixels.
4. Put your logic in `src/lib/` as pure functions with tests, and your actions in `src/lib/actions.js`.
5. `make test`, `make e2e`, `make dev`.
<!-- skeleton:end -->

## What you get

```
manifest.json          Manifest V3, module service worker, popup, options page, commands
src/background.js      service worker: message router, context menu, shortcuts, badge
src/lib/logic.js       pure logic, no Chrome APIs, unit tested
src/lib/settings.js    chrome.storage.sync with local fallback, export/import
src/lib/actions.js     the action registry: id, name, help, preview(), run()
src/popup.*            toolbar popup that only sends messages
src/options.*          settings page
src/ui.css             design tokens, light and dark
test/                  node --test suites
scripts/e2e.mjs        headless browser test over the DevTools protocol
scripts/dev.mjs        the holodeck: a throwaway dev profile with sample tabs
scripts/init.mjs       one-time rename
Makefile               help, test, check, e2e, dev, dev-clean, package
.github/workflows      CI: unit tests on Node 22 and 24, headless e2e, zip artifact
AGENTS.md              rules of the road for contributors and AI agents (CLAUDE.md imports it)
```

### The pattern

- **All browser operations run in the service worker.** The popup sends `chrome.runtime.sendMessage` and renders what comes back. Chrome closes the popup the moment a window is created or focused, so logic that lives there dies mid-action.
- **Actions are data.** Each entry in `ACTIONS` has an `id`, `name`, `help`, optional `preview()` returning `{ title, items, confirmLabel }`, and `run()` returning `{ message }`. The popup, context menu, keyboard commands and e2e harness all consume the same registry.
- **Pure logic is separate and tested.** Anything expressible as plain functions over plain data goes in `src/lib/logic.js` with a `node --test` case.
- **Settings sync.** `src/lib/settings.js` saves to `chrome.storage.sync`, falls back to local, picks the newer copy on load, and exports and imports JSON.

## Development

```sh
make test      # unit tests, no browser needed
make check     # syntax-check every script
make e2e       # every action in a real headless browser
make dev       # interactive: the holodeck
make package   # <name>-<version>.zip for the Chrome Web Store
```

### The holodeck

Browser testing never touches a real profile. `make dev` opens Brave (or `BROWSER=/path/to/chromium make dev`) on a throwaway profile at `~/.holodeck/<browser>/`, named "🧪 holodeck" in the profile chip, with the extension loaded unpacked and sample tabs. The profile persists between runs; `make dev-clean` deletes it. `make e2e` uses a fresh profile under `~/.holodeck/tmp/` and removes it afterwards. Google Chrome's branded build ignores `--load-extension`, so the scripts default to Brave; CI installs Chrome for Testing.

Loading unpacked into your real profile: `chrome://extensions`, Developer mode, **Load unpacked**, pick this folder.

## Releasing

Bump `version` in `manifest.json` and `package.json`, `make package`, upload the zip to the Chrome Web Store dashboard. CI attaches the same zip to every run.

## License

MIT. See LICENSE.md.
