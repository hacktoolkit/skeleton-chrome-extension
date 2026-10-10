// Service worker. Owns every operation so it survives the popup closing
// (Chrome closes the popup whenever a window is created or focused).

import { ACTIONS, ACTION_BY_ID, stats } from './lib/actions.js';
import { loadSettings } from './lib/settings.js';

const MENU_ROOT = 'extensionMenu';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true; // async response
});

async function handleMessage({ type, action: actionId, args = {} } = {}) {
    const action = actionId ? ACTION_BY_ID[actionId] : null;
    switch (type) {
        case 'stats':
            return stats();
        case 'actions':
            return ACTIONS.map(({ id, name, help, preview }) => ({ id, name, help, hasPreview: typeof preview === 'function' }));
        case 'preview':
            if (!action?.preview) throw new Error(`No preview for ${actionId}`);
            return action.preview(args);
        case 'run': {
            if (!action) throw new Error(`Unknown action ${actionId}`);
            const result = await action.run(args);
            scheduleBadge();
            return result;
        }
        case 'settingsChanged':
            scheduleBadge();
            return true;
        default:
            throw new Error(`Unknown message type ${type}`);
    }
}

// ----- context menu and keyboard commands --------------------

let menuBuild = Promise.resolve();
function rebuildContextMenus() {
    menuBuild = menuBuild.then(buildContextMenus, buildContextMenus);
    return menuBuild;
}
async function buildContextMenus() {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: MENU_ROOT, title: chrome.runtime.getManifest().name, contexts: ['all'] });
    for (const a of ACTIONS) {
        chrome.contextMenus.create({ id: a.id, parentId: MENU_ROOT, title: a.name, contexts: ['all'] });
    }
}
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const action = ACTION_BY_ID[info.menuItemId];
    if (action) {
        try { await action.run({ tabId: tab?.id, windowId: tab?.windowId }); } catch (e) { console.error(e); }
        scheduleBadge();
    }
});
chrome.commands.onCommand.addListener(async (command, tab) => {
    const action = ACTION_BY_ID[command];
    if (action) {
        try { await action.run({ tabId: tab?.id, windowId: tab?.windowId }); } catch (e) { console.error(e); }
        scheduleBadge();
    }
});

// ----- badge --------------------

let badgeTimer = null;
function scheduleBadge() {
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(updateBadge, 500);
}
async function updateBadge() {
    try {
        const { settings } = await loadSettings();
        if (!settings.showBadge) return chrome.action.setBadgeText({ text: '' });
        const s = await stats();
        await chrome.action.setBadgeBackgroundColor({ color: '#5b6cff' });
        await chrome.action.setBadgeText({ text: String(s.tabs) });
    } catch (e) { /* ignore */ }
}
chrome.tabs.onCreated.addListener(scheduleBadge);
chrome.tabs.onRemoved.addListener(scheduleBadge);

// ----- lifecycle --------------------

chrome.runtime.onInstalled.addListener(() => { rebuildContextMenus(); scheduleBadge(); });
chrome.runtime.onStartup.addListener(() => { rebuildContextMenus(); scheduleBadge(); });
scheduleBadge();
