import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, exportBundle, mergeSettings, parseImport } from '../src/lib/settings.js';

test('mergeSettings fills defaults', () => {
    assert.deepEqual(mergeSettings(), DEFAULTS);
    assert.equal(mergeSettings({ showBadge: false }).showBadge, false);
});

test('export then import round-trips', () => {
    const bundle = exportBundle({ confirmClose: false });
    assert.equal(parseImport(JSON.stringify(bundle)).confirmClose, false);
    assert.throws(() => parseImport('nope'), /Not valid JSON/);
    assert.throws(() => parseImport('{}'), /"settings"/);
});
