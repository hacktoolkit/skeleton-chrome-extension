// The popup renders and sends messages. It runs no tab logic itself.
import { loadSettings } from './lib/settings.js';

const $ = (sel) => document.querySelector(sel);
let panelState = null;

export function send(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (!response || !response.ok) reject(new Error(response?.error || 'No response'));
            else resolve(response.result);
        });
    });
}

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) if (c !== null && c !== undefined) node.append(c.nodeType ? c : document.createTextNode(c));
    return node;
}

let toastTimer = null;
function toast(message, error = false) {
    const node = $('#toast');
    node.className = `toast${error ? ' error' : ''}`;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3000);
}

async function refresh() {
    try {
        const s = await send({ type: 'stats' });
        $('#stats').innerHTML = `<b>${s.tabs}</b> tabs · <b>${s.windows}</b> window${s.windows === 1 ? '' : 's'} · <b>${s.blank}</b> blank`;
    } catch (e) {
        $('#stats').textContent = e.message;
    }
}

async function run(action, args = {}) {
    try {
        const result = await send({ type: 'run', action: action.id, args });
        closePanel();
        toast(result.message || 'Done');
        await refresh();
    } catch (e) {
        toast(e.message, true);
    }
}

function closePanel() { $('#panel').hidden = true; panelState = null; }

async function openPreview(action) {
    $('#panel-title').textContent = action.name;
    $('#panel-body').innerHTML = '';
    $('#panel').hidden = false;
    try {
        const preview = await send({ type: 'preview', action: action.id });
        $('#panel-title').textContent = preview.title || action.name;
        const body = $('#panel-body');
        if (!preview.items?.length) body.append(el('div', { class: 'empty', text: 'Nothing matches.' }));
        else {
            const list = el('ul', { class: 'list' });
            for (const it of preview.items) list.append(el('li', {}, [el('span', { class: 't' }, [el('b', { text: it.title || it.url }), el('span', { text: it.url })])]));
            body.append(list);
        }
        $('#panel-confirm').textContent = preview.confirmLabel || 'Confirm';
        $('#panel-confirm').disabled = !preview.items?.length;
        panelState = { action };
    } catch (e) { closePanel(); toast(e.message, true); }
}

async function activate(action) {
    const { settings } = await loadSettings();
    if (action.hasPreview && settings.confirmClose) return openPreview(action);
    return run(action);
}

async function init() {
    $('#panel-close').addEventListener('click', closePanel);
    $('#panel-cancel').addEventListener('click', closePanel);
    $('#panel-confirm').addEventListener('click', () => panelState && run(panelState.action));
    $('#open-options').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
    const actions = await send({ type: 'actions' });
    const root = $('#actions');
    for (const a of actions) {
        root.append(el('button', { class: 'action', 'data-action': a.id, onclick: () => activate(a) }, [
            el('span', { class: 'lbl' }, [el('b', { text: a.name }), el('small', { text: a.help })])
        ]));
    }
    await refresh();
}
init();
