import { exportBundle, loadSettings, parseImport, saveSettings } from './lib/settings.js';

const $ = (sel) => document.querySelector(sel);
let settings = {};

function send(message) {
    return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

async function save() {
    const where = await saveSettings(settings);
    $('#status').textContent = where === 'sync' ? 'Saved and synced' : 'Saved locally';
    await send({ type: 'settingsChanged' });
}

function render() {
    for (const key of ['confirmClose', 'showBadge']) $(`#${key}`).checked = !!settings[key];
}

async function init() {
    $('#version').textContent = `v${chrome.runtime.getManifest().version}`;
    settings = (await loadSettings()).settings;
    render();
    for (const key of ['confirmClose', 'showBadge']) {
        $(`#${key}`).addEventListener('change', (e) => { settings[key] = e.target.checked; save(); });
    }
    $('#export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(exportBundle(settings), null, 2)], { type: 'application/json' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'settings.json' });
        document.body.append(a); a.click(); a.remove();
    });
    $('#import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try { settings = parseImport(await file.text()); render(); await save(); }
        catch (err) { $('#status').textContent = err.message; }
        e.target.value = '';
    });
}
init();
