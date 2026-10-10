# Tab Counter: notes for AI agents and contributors

Built from the Hacktoolkit Chrome extension skeleton. Vanilla JavaScript, Manifest V3, no build step, no runtime dependencies. Keep it that way.

## Layout

See the tree in README.md. In short: `src/background.js` is the service worker and owns every browser operation; `src/lib/logic.js` is pure and tested; `src/lib/actions.js` is the action registry; the popup only sends messages.

## Rules of the road

- **All browser operations run in the service worker.** The popup renders and sends `chrome.runtime.sendMessage`; it runs no tab logic. Chrome closes the popup when a window is created or focused.
- **Actions are data.** Add an entry to `ACTIONS` with `id`, `name`, `help`, optional `preview()`, and `run()`. The popup, context menu, commands and the e2e harness pick it up without further wiring. Anything destructive exposes a `preview()`.
- **Pure logic lives in `src/lib/logic.js`** and gets a `node --test` case. Chrome API calls stay in `src/lib/actions.js` and `src/background.js`.
- **Settings go through `src/lib/settings.js`** so they sync and export. Add keys to `DEFAULTS`.
- Keep the code style in `.prettierrc`: 4 spaces, single quotes, semicolons.

## Testing

```sh
make test      # unit tests
make e2e       # every action in a real headless browser
make dev       # interactive: the holodeck
```

Browser testing never touches a real profile. Automated and interactive runs use the **holodeck**, a throwaway sandbox at `~/.holodeck/` (override with `HOLODECK=`): `make dev` opens a persistent profile at `~/.holodeck/<browser>/` named "🧪 holodeck"; `make e2e` creates a fresh profile under `~/.holodeck/tmp/` and removes it. Agents may launch, inspect and destroy anything under `~/.holodeck/` without asking. Google Chrome's branded build ignores `--load-extension`; the scripts default to Brave and CI uses Chrome for Testing.

When adding an action, add a `check(...)` for it in `scripts/e2e.mjs`.

## Releasing

Bump `version` in `manifest.json` and `package.json`, `make package`, upload the zip to the Chrome Web Store dashboard.
