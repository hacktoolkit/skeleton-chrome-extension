// Actions touch the Chrome APIs. Each has an id, name, help text, an optional
// preview() for actions that close or change things, and run().
// Everything here runs in the service worker, never in the popup.

import { isBlankUrl, summarise } from './logic.js';
import { loadSettings } from './settings.js';

function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export const ACTIONS = [
    {
        id: 'count',
        name: 'Count Tabs',
        help: 'Counts tabs across all windows and lists the busiest sites.',
        async run() {
            const tabs = await chrome.tabs.query({});
            const s = summarise(tabs);
            const top = s.hosts.slice(0, 3).map(([h, n]) => `${h} (${n})`).join(', ');
            return { message: `${plural(s.total, 'tab')}, ${s.blank} blank, ${s.pinned} pinned${top ? `. Top: ${top}` : ''}` };
        }
    },
    {
        id: 'closeBlank',
        name: 'Close Blank Tabs',
        help: 'Closes empty new-tab pages, keeping one if a window would otherwise be empty.',
        async preview() {
            const tabs = (await chrome.tabs.query({})).filter((t) => isBlankUrl(t.url) && !t.pinned);
            return {
                title: `${plural(tabs.length, 'blank tab')}`,
                items: tabs.map((t) => ({ id: t.id, title: t.title || 'New tab', url: t.url })),
                confirmLabel: `Close ${plural(tabs.length, 'tab')}`
            };
        },
        async run() {
            const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
            let closed = 0;
            for (const w of windows) {
                const blank = w.tabs.filter((t) => isBlankUrl(t.url) && !t.pinned);
                const ids = blank.length === w.tabs.length ? blank.slice(1) : blank;
                if (ids.length > 0) {
                    await chrome.tabs.remove(ids.map((t) => t.id));
                    closed += ids.length;
                }
            }
            return { message: `Closed ${plural(closed, 'blank tab')}`, closed };
        }
    }
];

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export async function stats() {
    const [tabs, windows, { settings }] = await Promise.all([
        chrome.tabs.query({}),
        chrome.windows.getAll({ windowTypes: ['normal'] }),
        loadSettings()
    ]);
    const s = summarise(tabs);
    return { tabs: s.total, blank: s.blank, pinned: s.pinned, windows: windows.length, settings };
}
