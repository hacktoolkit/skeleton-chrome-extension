// Pure logic: no Chrome APIs, so it runs under `node --test`.
// Put everything that can be expressed as plain functions over plain data here.

export const BLANK_URLS = new Set([
    'chrome://newtab/',
    'chrome://new-tab-page/',
    'brave://newtab/',
    'edge://newtab/',
    'about:blank',
    ''
]);

export function isBlankUrl(url) {
    return BLANK_URLS.has(url || '');
}

// Hostname for http(s) URLs only; null for chrome://, extension pages and junk.
export function hostOf(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u.hostname.toLowerCase().replace(/^www\./, '') || null;
    } catch (e) {
        return null;
    }
}

// Summarises a list of tabs: total, blank, pinned, and tabs per host.
export function summarise(tabs) {
    const hosts = new Map();
    let blank = 0;
    let pinned = 0;
    for (const t of tabs) {
        if (t.pinned) pinned += 1;
        if (isBlankUrl(t.url)) {
            blank += 1;
            continue;
        }
        const h = hostOf(t.url);
        if (h) hosts.set(h, (hosts.get(h) || 0) + 1);
    }
    const top = [...hosts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return { total: tabs.length, blank, pinned, hosts: top };
}
