// Settings persistence: chrome.storage.sync with a local fallback, the newer
// copy wins on load, plus JSON export/import. Add your own keys to DEFAULTS.

export const DEFAULTS = {
    confirmClose: true,
    showBadge: true
};

const KEYS = ['settings', 'savedAt'];

function area(name) {
    return globalThis.chrome && chrome.storage && chrome.storage[name] ? chrome.storage[name] : null;
}

async function read(name) {
    const store = area(name);
    if (!store) return {};
    try {
        return await store.get(KEYS);
    } catch (e) {
        return {};
    }
}

async function write(name, data) {
    const store = area(name);
    if (!store) return false;
    try {
        await store.set(data);
        return true;
    } catch (e) {
        return false;
    }
}

export function mergeSettings(stored) {
    return { ...DEFAULTS, ...(stored || {}) };
}

export async function loadSettings() {
    const [sync, local] = await Promise.all([read('sync'), read('local')]);
    const pick = sync.settings && local.settings ? ((local.savedAt || 0) > (sync.savedAt || 0) ? local : sync) : sync.settings ? sync : local;
    return { settings: mergeSettings(pick.settings), source: pick === local ? 'local' : 'sync' };
}

export async function saveSettings(settings) {
    const payload = { settings: mergeSettings(settings), savedAt: Date.now() };
    const ok = await write('sync', payload);
    await write('local', payload);
    return ok ? 'sync' : 'local';
}

export function exportBundle(settings) {
    return { app: 'tab-counter', version: 1, exportedAt: new Date().toISOString(), settings: mergeSettings(settings) };
}

export function parseImport(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`Not valid JSON: ${e.message}`);
    }
    if (!data || typeof data !== 'object' || !data.settings || typeof data.settings !== 'object') {
        throw new Error('Expected an object with a "settings" key');
    }
    return mergeSettings(data.settings);
}
