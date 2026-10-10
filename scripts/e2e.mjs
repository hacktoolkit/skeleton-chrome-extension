// End-to-end smoke test. Launches a headless Chromium-based browser with the
// extension loaded, drives it over the DevTools protocol, and asserts on real
// browser state. Network is blocked so seeded URLs stay exactly as given.
//
//   make e2e
//   BROWSER=/path/to/chromium make e2e
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = process.env.EXT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8')).name;
const CANDIDATES = [process.env.BROWSER, '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/brave-browser'].filter(Boolean);
const CHROME = CANDIDATES.find((c) => existsSync(c));
if (!CHROME) { console.error('No Chromium-based browser found. Set BROWSER=/path/to/binary'); process.exit(2); }
const PORT = Number(process.env.PORT) || 9337;
const HOLODECK = process.env.HOLODECK || join(homedir(), '.holodeck');
mkdirSync(join(HOLODECK, 'tmp'), { recursive: true });
const profile = mkdtempSync(join(HOLODECK, 'tmp', 'e2e-'));

const chrome = spawn(CHROME, [
    `--user-data-dir=${profile}`, `--load-extension=${EXT}`, `--remote-debugging-port=${PORT}`,
    '--headless=new', '--host-resolver-rules=MAP * ~NOTFOUND', '--no-first-run', '--no-default-browser-check',
    ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] : []),
    'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
chrome.stderr.on('data', (d) => { stderr += d; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
async function waitFor(pred, label, tries = 60) {
    for (let i = 0; i < tries; i++) {
        try { const t = (await targets()).find(pred); if (t) return t; } catch (e) { /* not up yet */ }
        await sleep(250);
    }
    throw new Error(`timeout waiting for ${label}`);
}
class CDP {
    constructor(ws) {
        this.ws = ws; this.id = 0; this.pending = new Map();
        ws.addEventListener('message', (m) => {
            const msg = JSON.parse(m.data);
            if (msg.id && this.pending.has(msg.id)) { const { res, rej } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
        });
    }
    static async connect(url) { const ws = new WebSocket(url); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); return new CDP(ws); }
    send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.pending.set(id, { res, rej })); }
    async eval(expression) {
        const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
        return r.result.value;
    }
}
// Browsers ship built-in extensions with service workers of their own, so find
// ours by manifest name rather than by URL shape.
async function findExtensionId() {
    for (let i = 0; i < 60; i++) {
        let list = [];
        try { list = await targets(); } catch (e) { /* not up yet */ }
        for (const t of list.filter((t) => t.type === 'service_worker' && t.url.endsWith('/src/background.js'))) {
            try {
                const cdp = await CDP.connect(t.webSocketDebuggerUrl);
                const name = await cdp.eval('chrome.runtime.getManifest().name');
                cdp.ws.close();
                if (name === NAME) return new URL(t.url).host;
            } catch (e) { /* try the next one */ }
        }
        await sleep(250);
    }
    throw new Error(`timeout waiting for the ${NAME} service worker\n${stderr.split('\n').slice(-5).join('\n')}`);
}

let failures = 0;
function check(label, cond, detail = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
    if (!cond) failures++;
}

try {
    const extId = await findExtensionId();
    const browserInfo = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    const browser = await CDP.connect(browserInfo.webSocketDebuggerUrl);

    // the popup opened as a tab can drive chrome.runtime.sendMessage
    await browser.send('Target.createTarget', { url: `chrome-extension://${extId}/src/popup.html`, newWindow: true });
    const popupT = await waitFor((t) => t.url.endsWith('/src/popup.html'), 'popup');
    const popup = await CDP.connect(popupT.webSocketDebuggerUrl);
    for (let i = 0; i < 40; i++) {
        if (await popup.eval(`typeof chrome !== 'undefined' && !!chrome.windows && location.protocol === 'chrome-extension:'`).catch(() => false)) break;
        await sleep(250);
    }
    const send = (msg) => popup.eval(`new Promise((res, rej) => chrome.runtime.sendMessage(${JSON.stringify(msg)}, (r) => r && r.ok ? res(r.result) : rej(new Error(r ? r.error : chrome.runtime.lastError?.message))))`);
    const tabs = () => popup.eval('chrome.tabs.query({})');

    await popup.eval(`chrome.windows.create({ url: ['https://a.test/1', 'https://a.test/2', 'https://b.test/', 'chrome://newtab/', 'chrome://newtab/'], focused: false })`);
    await sleep(1200);

    const actions = await send({ type: 'actions' });
    check('actions list', actions.length === 2, actions.map((a) => a.id).join(','));

    const s = await send({ type: 'stats' });
    check('stats counts blank tabs', s.blank >= 2, `blank=${s.blank} tabs=${s.tabs}`);

    const count = await send({ type: 'run', action: 'count' });
    check('count reports the busiest host', /a\.test \(2\)/.test(count.message), count.message);

    const preview = await send({ type: 'preview', action: 'closeBlank' });
    check('closeBlank preview lists blank tabs', preview.items.length >= 2, `${preview.items.length} items`);

    const before = (await tabs()).length;
    const closed = await send({ type: 'run', action: 'closeBlank' });
    const after = (await tabs()).length;
    check('closeBlank closes them', closed.closed >= 2 && after === before - closed.closed, closed.message);

    const buttons = await popup.eval(`document.querySelectorAll('.action').length`);
    check('popup renders action buttons', buttons === 2, `${buttons} buttons`);
} catch (e) {
    console.error('E2E ERROR', e);
    failures++;
} finally {
    chrome.kill('SIGKILL');
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED');
    process.exit(failures ? 1 : 0);
}
