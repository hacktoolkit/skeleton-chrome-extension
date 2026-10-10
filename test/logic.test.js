import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, isBlankUrl, summarise } from '../src/lib/logic.js';

test('isBlankUrl', () => {
    assert.ok(isBlankUrl('chrome://newtab/'));
    assert.ok(isBlankUrl(''));
    assert.ok(!isBlankUrl('https://example.com/'));
});

test('hostOf strips www and tolerates junk', () => {
    assert.equal(hostOf('https://www.Example.com/x'), 'example.com');
    assert.equal(hostOf('not a url'), null);
    assert.equal(hostOf('chrome-extension://abc/popup.html'), null);
});

test('summarise counts and ranks hosts', () => {
    const s = summarise([
        { url: 'https://a.test/1' }, { url: 'https://a.test/2', pinned: true },
        { url: 'https://b.test/' }, { url: 'chrome://newtab/' }
    ]);
    assert.deepEqual(s, { total: 4, blank: 1, pinned: 1, hosts: [['a.test', 2], ['b.test', 1]] });
});
